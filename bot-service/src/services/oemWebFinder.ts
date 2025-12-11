import { extractOemsFromHtml, looksLikeOem, normalizeOem } from "./oemScraper";
import { ProxyAgent } from "proxy-agent";

export interface VehicleData {
  vin?: string;
  brand?: string;
  model?: string;
  year?: number;
  engineCode?: string;
  hsn?: string;
  tsn?: string;
}

export interface SearchContext {
  vehicle: VehicleData;
  userQuery: string;
  suspectedNumber?: string | null;
}

export interface OemCandidate {
  source: string;
  rawValue: string;
  normalized: string;
  score?: number;
}

export interface BestOemResult {
  bestOem: string | null;
  candidates: OemCandidate[];
  histogram: Record<string, number>;
  fallbackUsed: boolean;
  confirmationHits?: number;
  confirmationSources?: string[];
}

const SCRAPE_TIMEOUT_MS = 8000;
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.SCRAPE_PROXY_URL;
const proxyAgent = proxyUrl ? new ProxyAgent({ getProxyForUrl: () => proxyUrl }) : undefined;

// Lazy-load OpenAI client to avoid hard dependency when KEY fehlt
let openAiModule: any = null;
async function getOpenAiClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (openAiModule) return openAiModule;
  try {
    openAiModule = await import("./openAiService");
    return openAiModule;
  } catch (err) {
    console.error("OpenAI client load failed", (err as any)?.message || err);
    return null;
  }
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // @ts-ignore agent is supported in node-fetch runtime
      agent: proxyAgent,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OEMFinder/2.0; +https://autoteile-assistent.local)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en,de;q=0.9"
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.text();
  } finally {
    clearTimeout(id);
  }
}

async function fetchTextWithFallback(url: string): Promise<string> {
  try {
    return await fetchText(url);
  } catch {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    return fetchText(proxyUrl);
  }
}

function extractStrictOems(html: string): string[] {
  const fromGeneric = extractOemsFromHtml(html);
  const unique = new Set<string>();
  for (const raw of fromGeneric) {
    const norm = normalizeOem(raw);
    if (!norm) continue;
    if (!looksLikeOem(norm)) continue;
    unique.add(norm);
  }
  return Array.from(unique);
}

function buildGenericSearchString(ctx: SearchContext): string {
  const { brand, model, year } = ctx.vehicle;
  const parts: string[] = [];
  if (brand) parts.push(brand);
  if (model) parts.push(model);
  if (year) parts.push(String(year));
  parts.push(ctx.userQuery);
  return parts.filter(Boolean).join(" ");
}

// --------------------------
// OpenAI-gestützte Filter (kein OEM-Guessing!)
// --------------------------

async function aiFilterHtmlForContext(html: string, ctx: SearchContext): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return html;
  if (!html) return "";
  const client = await getOpenAiClient();
  if (!client?.generateChatCompletion) return html;

  const prompt = `
Gesuchtes Teil: ${ctx.userQuery}
Fahrzeug: ${ctx.vehicle.brand ?? ""} ${ctx.vehicle.model ?? ""} ${ctx.vehicle.year ?? ""}

HTML (gekürzt):
${html.slice(0, 15000)}

Extrahiere NUR die HTML-Segmente, die Teilelisten oder OEM/MPN-Nummern enthalten
und thematisch zum gesuchten Teil passen. Gib ausschließlich Original-HTML-Auszüge zurück.
KEINE neuen Inhalte erzeugen.`;

  try {
    const res = await client.generateChatCompletion({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "Gib nur relevante HTML-Auszüge zurück, nichts hinzufügen oder verändern." },
        { role: "user", content: prompt }
      ]
    });
    return res || html;
  } catch (err) {
    console.error("aiFilterHtmlForContext failed", (err as any)?.message || err);
    return html;
  }
}

async function aiFilterRelevantOems(oems: string[], ctx: SearchContext): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) return oems;
  if (!oems || oems.length === 0) return [];
  const client = await getOpenAiClient();
  if (!client?.generateChatCompletion) return oems;

  const prompt = `
Fahrzeug: ${ctx.vehicle.brand ?? ""} ${ctx.vehicle.model ?? ""} ${ctx.vehicle.year ?? ""}
Gesuchtes Teil: ${ctx.userQuery}

OEM-Kandidaten:
${JSON.stringify(oems)}

Markiere jede OEM als "relevant" oder "irrelevant".
ANTWORTE NUR IN JSON:
{"relevant": [...], "irrelevant": [...]}
Erfinde KEINE neuen OEMs. Nutze nur die gegebenen.`;

  try {
    const res = await client.generateChatCompletion({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }]
    });
    const txt = res || "";
    const match = txt.match(/\{[\s\S]*\}/);
    if (!match) return oems;
    const parsed = JSON.parse(match[0]);
    const rel = Array.isArray(parsed?.relevant) ? parsed.relevant : [];
    const filtered = rel.filter((x: any) => typeof x === "string" && oems.includes(x));
    return filtered.length > 0 ? filtered : oems;
  } catch (err) {
    console.error("aiFilterRelevantOems failed", (err as any)?.message || err);
    return oems;
  }
}

async function searchOemOnPartSouq(ctx: SearchContext): Promise<OemCandidate[]> {
  try {
    const q = ctx.vehicle.vin ? ctx.vehicle.vin : buildGenericSearchString(ctx);
    const url = `https://partsouq.com/en/search/all?q=${encodeURIComponent(q)}`;
    const html = await fetchTextWithFallback(url);
    if (html.includes("cf-mitigated") || html.includes("challenge-platform")) return [];
    const filteredHtml = await aiFilterHtmlForContext(html, ctx);
    const oems = extractStrictOems(filteredHtml || html);
    const relevant = await aiFilterRelevantOems(oems, ctx);
    return relevant.map((o) => ({ source: "PartSouq", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

async function searchOemOnAmayama(ctx: SearchContext): Promise<OemCandidate[]> {
  try {
    const q = ctx.vehicle.vin ? ctx.vehicle.vin : buildGenericSearchString(ctx);
    const url = `https://www.amayama.com/en/search?q=${encodeURIComponent(q)}`;
    const html = await fetchTextWithFallback(url);
    const filteredHtml = await aiFilterHtmlForContext(html, ctx);
    const inlineJson = (filteredHtml || html).match(/"part_number"\s*:\s*"([A-Z0-9\-\.]+)"/gi) || [];
    const extra: string[] = inlineJson
      .map((s) => s.replace(/.*"part_number"\s*:\s*"/i, "").replace(/".*/, "").trim())
      .map((s) => normalizeOem(s))
      .filter(Boolean) as string[];

    const oems = [
      ...extractStrictOems(filteredHtml || html),
      ...extra.filter((o) => looksLikeOem(o))
    ];
    const relevant = await aiFilterRelevantOems(oems, ctx);
    const unique = [...new Set(oems)];
    return unique
      .filter((o) => relevant.includes(o))
      .map((o) => ({ source: "Amayama", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

async function searchOemOnAutodocParts(ctx: SearchContext): Promise<OemCandidate[]> {
  try {
    const q = buildGenericSearchString(ctx);
    const url = `https://www.autodoc.parts/search?keyword=${encodeURIComponent(q)}`;
    const html = await fetchTextWithFallback(url);
    const filteredHtml = await aiFilterHtmlForContext(html, ctx);
    if (html.includes("Just a moment") && html.includes("challenge-platform")) return [];

    const jsonMatches = (filteredHtml || html).match(/"oeNumbers"\s*:\s*\[(.*?)\]/gi) || [];
    const extracted: string[] = [];
    jsonMatches.forEach((m) => {
      const parts = m.match(/[A-Z0-9\-\._]{5,20}/gi);
      if (parts) parts.forEach((p) => extracted.push(p));
    });

    const oems = [
      ...extractStrictOems(filteredHtml || html),
      ...extracted.map((v) => normalizeOem(v)).filter((v) => v && looksLikeOem(v)) as string[]
    ];

    const relevant = await aiFilterRelevantOems(oems, ctx);
    const unique = [...new Set(oems)];
    return unique
      .filter((o) => relevant.includes(o))
      .map((o) => ({ source: "Autodoc.parts", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

async function searchOemOnSpareto(ctx: SearchContext): Promise<OemCandidate[]> {
  try {
    const q = buildGenericSearchString(ctx);
    const url = `https://www.spareto.com/search?q=${encodeURIComponent(q)}`;
    const html = await fetchTextWithFallback(url);
    const filteredHtml = await aiFilterHtmlForContext(html, ctx);
    const ldJson = (filteredHtml || html).match(/application\/ld\+json">([\s\S]*?)<\/script>/i);
    const extracted: string[] = [];

    if (ldJson && ldJson[1]) {
      const mpnMatches = ldJson[1].match(/"mpn"\s*:\s*"([A-Z0-9\-\._]{5,20})"/gi) || [];
      mpnMatches.forEach((m) => {
        const v = m.replace(/.*"mpn"\s*:\s*"/i, "").replace(/".*/, "").trim();
        extracted.push(v);
      });
      const skuMatches = ldJson[1].match(/"sku"\s*:\s*"([A-Z0-9\-\._]{5,20})"/gi) || [];
      skuMatches.forEach((m) => {
        const v = m.replace(/.*"sku"\s*:\s*"/i, "").replace(/".*/, "").trim();
        extracted.push(v);
      });
    }

    const oems = [
      ...extractStrictOems(filteredHtml || html),
      ...extracted.map((v) => normalizeOem(v)).filter((v) => v && looksLikeOem(v)) as string[]
    ];

    const relevant = await aiFilterRelevantOems(oems, ctx);
    const unique = [...new Set(oems)];
    return unique
      .filter((o) => relevant.includes(o))
      .map((o) => ({ source: "Spareto", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

async function searchOemOn7zap(ctx: SearchContext): Promise<OemCandidate[]> {
  try {
    const q = ctx.vehicle.vin ? ctx.vehicle.vin : buildGenericSearchString(ctx);
    const url = `https://7zap.com/en/search/?keyword=${encodeURIComponent(q)}`;
    const html = await fetchTextWithFallback(url);
    const filteredHtml = await aiFilterHtmlForContext(html, ctx);
    const oems = extractStrictOems(filteredHtml || html);
    const relevant = await aiFilterRelevantOems(oems, ctx);
    return relevant.map((o) => ({ source: "7zap", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

const GENERIC_EPC_SITES: Array<{ name: string; urlTemplate: string }> = [
  { name: "daparto", urlTemplate: "https://www.daparto.de/Teilenummernsuche/{q}" },
  { name: "autodoc", urlTemplate: "https://www.autodoc.de/search?keyword={q}" }
];

async function searchOemOnGenericSites(ctx: SearchContext): Promise<OemCandidate[]> {
  const q = ctx.vehicle.vin ? ctx.vehicle.vin : buildGenericSearchString(ctx);
  const limitedQ = q.slice(0, 80);

  const tasks = GENERIC_EPC_SITES.map(async (site) => {
    const url = site.urlTemplate.replace("{q}", encodeURIComponent(limitedQ));
    try {
      const html = await fetchTextWithFallback(url);
      const filteredHtml = await aiFilterHtmlForContext(html, ctx);
      const oems = extractStrictOems(filteredHtml || html);
      if (oems.length === 0) return [];
      const relevant = await aiFilterRelevantOems(oems, ctx);
      return relevant.map((o) => ({ source: site.name, rawValue: o, normalized: o }));
    } catch {
      return [];
    }
  });

  const results = await Promise.allSettled(tasks);
  const candidates: OemCandidate[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") candidates.push(...r.value);
  }
  return candidates;
}

function getScrapeTasksForBrand(ctx: SearchContext): Array<(subCtx: SearchContext) => Promise<OemCandidate[]>> {
  const brand = (ctx.vehicle.brand || "").toUpperCase();

  if (brand === "BMW") {
    return [searchOemOnAutodocParts, searchOemOnSpareto, searchOemOnGenericSites];
  }

  if (["TOYOTA", "LEXUS", "NISSAN", "HONDA", "MAZDA", "MITSUBISHI", "SUBARU"].includes(brand)) {
    return [searchOemOnPartSouq, searchOemOnAmayama, searchOemOnGenericSites];
  }

  if (["VW", "VOLKSWAGEN", "AUDI", "SEAT", "ŠKODA", "SKODA"].includes(brand)) {
    return [searchOemOn7zap, searchOemOnAutodocParts, searchOemOnGenericSites];
  }

  return [searchOemOnAutodocParts, searchOemOnSpareto, searchOemOnGenericSites];
}

export async function fallbackResolveOem(ctx: SearchContext): Promise<string | null> {
  const match = ctx.userQuery.match(/\b(?=.*\d)[A-Z0-9][A-Z0-9\.\-\s]{4,20}[A-Z0-9]\b/i);
  if (match) {
    const norm = normalizeOem(match[0]);
    if (norm && looksLikeOem(norm)) return norm;
  }
  return null;
}

export async function findBestOemForVehicle(ctx: SearchContext, useFallback = true): Promise<BestOemResult> {
  const scrapeOnce = async (userQuery: string) => {
    const subCtx = { ...ctx, userQuery };
    const tasks = getScrapeTasksForBrand(subCtx).map((fn) => fn(subCtx));
    const results = await Promise.allSettled(tasks);
    const cands: OemCandidate[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") cands.push(...r.value);
    }
    return cands;
  };

  let candidates: OemCandidate[] = [];
  candidates.push(...(await scrapeOnce(ctx.userQuery)));
  if (ctx.suspectedNumber) {
    candidates.push(...(await scrapeOnce(ctx.suspectedNumber)));
  }

  const histogram: Record<string, number> = {};
  for (const c of candidates) {
    histogram[c.normalized] = (histogram[c.normalized] || 0) + 1;
  }

  let bestOem: string | null = null;
  if (candidates.length > 0) {
    const sorted = Object.entries(histogram).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0].length - a[0].length;
    });
    bestOem = sorted[0]?.[0] ?? null;
  }

  let fallbackUsed = false;
  if (!bestOem && useFallback) {
    const fb = await fallbackResolveOem(ctx);
    if (fb) {
      fallbackUsed = true;
      bestOem = fb;
      candidates.push({ source: "fallback-resolver", rawValue: fb, normalized: fb, score: 1 });
      histogram[fb] = (histogram[fb] || 0) + 1;
    }
  }

  let confirmationHits = 0;
  const confirmationSources: string[] = [];
  if (bestOem) {
    const confirmCands = await scrapeOnce(bestOem);
    confirmCands.forEach((c) => {
      candidates.push(c);
      histogram[c.normalized] = (histogram[c.normalized] || 0) + 1;
      if (c.normalized === bestOem) {
        confirmationHits += 1;
        confirmationSources.push(c.source);
      }
    });
  }

  return { bestOem, candidates, histogram, fallbackUsed, confirmationHits, confirmationSources };
}

export async function demoBmwCase() {
  const ctx: SearchContext = {
    vehicle: {
      brand: "BMW",
      model: "316TI",
      year: 2003,
      vin: "WBAxxxxxxxxxxxxxx",
      hsn: "0005",
      tsn: "742"
    },
    userQuery: "Bremsscheiben vorne"
  };

  const result = await findBestOemForVehicle(ctx);
  console.log("Beste OEM:", result.bestOem);
  console.log("Fallback genutzt:", result.fallbackUsed);
  console.log("Bestätigungs-Treffer:", result.confirmationHits, result.confirmationSources);
  console.log("Histogramm:", result.histogram);
}
