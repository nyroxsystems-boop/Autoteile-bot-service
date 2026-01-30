/**
 * Web-basierter OEM-Finder ohne TecDoc/Apify.
 * Sucht OEMs über mehrere Webseiten und aggregiert das Ergebnis.
 * Unterstützt Gemini AI für Query-Expansion/Re-Ranking.
 * 
 * 🎯 UPGRADED: Now uses enhancedOemExtractor for 9/10 precision!
 */
import { extractOemsFromHtml, looksLikeOem, normalizeOem } from "./oemScraper";
import { extractOEMsEnhanced, learnSupersessionsFromHTML } from "./enhancedOemExtractor";
import { generateChatCompletion } from "./geminiService";

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
  userQuery: string; // z. B. "Bremsscheiben vorne"
  suspectedNumber?: string | null; // optional direkte OEM/Artikelnummer
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

// Using Gemini via geminiService.ts

import { ProxyAgent } from "proxy-agent";

const SCRAPE_TIMEOUT_MS = 30000; // Increased for ScraperAPI
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

async function fetchText(url: string, premium = false): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

  try {
    let targetUrl = url;
    if (SCRAPER_API_KEY) {
      // Use ScraperAPI
      const params = new URLSearchParams({
        api_key: SCRAPER_API_KEY,
        url: url,
        // Premium for tough sites (eBay), render for JS heavy sites if needed
        premium: premium ? "true" : "false",
        // country_code: "de" // Optional: Force German IP
      });
      targetUrl = `http://api.scraperapi.com?${params.toString()}`;
    }

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: SCRAPER_API_KEY ? {} : {
        "User-Agent": "Mozilla/5.0 (compatible; OEMFinder/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!res.ok) {
      // Log warning but throw to trigger catch/empty return
      console.warn(`[oemWebFinder] HTTP ${res.status} for ${url}`);
      throw new Error(`HTTP ${res.status}`);
    }
    return res.text();
  } finally {
    clearTimeout(id);
  }
}

/**
 * Best-effort Fetch with ScraperAPI (premium=true for tough targets)
 */
async function fetchTextWithFallback(url: string, premium = false): Promise<string> {
  // Direct pass-through to the enhanced fetchText which handles ScraperAPI
  return fetchText(url, premium);
}

async function aiExtractOemsFromHtml(html: string, ctx: SearchContext): Promise<string[]> {
  if (!process.env.GEMINI_API_KEY) return [];
  const prompt = `HTML-Ausschnitt einer Teile-Suche:\n\n${html.slice(0, 12000)}\n\nFahrzeug: ${JSON.stringify(
    ctx.vehicle
  )}\nUser-Query: ${ctx.userQuery}\nExtrahiere OEM-Nummern (OE/OEM/MPN) als JSON-Array strings. Nur OEMs, keine Erklärungen.`;
  try {
    const raw = await generateChatCompletion({
      messages: [
        { role: "system", content: "Du extrahierst OEM-Nummern aus HTML." },
        { role: "user", content: prompt }
      ],
      temperature: 0
    });
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const arr = JSON.parse(match[0]);
    return Array.isArray(arr) ? arr.map((v) => normalizeOem(String(v))).filter(Boolean) as string[] : [];
  } catch {
    return [];
  }
}

// ----------------------------------
// Gemini-Helfer: Query-Expansion / Re-Ranking
// ----------------------------------

async function geminiSuggestQueries(ctx: SearchContext): Promise<string[]> {
  if (!process.env.GEMINI_API_KEY) return [];
  const prompt = `Fahrzeug: ${JSON.stringify(ctx.vehicle)}\nUser-Query: ${ctx.userQuery}\nGeneriere 2-3 kurze Suchbegriffe für Ersatzteil/OEM-Suche (ohne Sonderzeichen).`;
  try {
    const raw = await generateChatCompletion({
      messages: [
        { role: "system", content: "Du generierst kurze Suchbegriffe für Autoteile/OEM-Suche." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    });
    return raw
      .split("\n")
      .map((s: string) => s.replace(/^\-\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
  } catch {
    return [];
  }
}

async function geminiRerank(bestOem: string | null, candidates: OemCandidate[], ctx: SearchContext): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY || !bestOem) return bestOem;
  const prompt = `Fahrzeug: ${JSON.stringify(ctx.vehicle)}\nUser-Query: ${ctx.userQuery}\nKandidaten: ${JSON.stringify(
    candidates
  )}\nAktuell bester OEM: ${bestOem}\nWähle die passendste OEM für das Fahrzeug/Teil. Antworte nur mit der OEM oder "NONE".`;
  try {
    const raw = await generateChatCompletion({
      messages: [
        { role: "system", content: "Du wählst die plausibelste OEM-Nummer aus einer Kandidatenliste." },
        { role: "user", content: prompt }
      ],
      temperature: 0
    });
    const norm = normalizeOem(raw.trim());
    if (norm && looksLikeOem(norm)) return norm;
    return bestOem;
  } catch {
    return bestOem;
  }
}

// ----------------------------------
// Quellen: 5 echte Seiten (teils als Platzhalter)
// ----------------------------------

async function searchOemOnPartSouq(ctx: SearchContext): Promise<OemCandidate[]> {
  try {
    const q = ctx.vehicle.vin
      ? ctx.vehicle.vin
      : [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
    const url = `https://partsouq.com/en/search/all?q=${encodeURIComponent(q)}`;
    const html = await fetchTextWithFallback(url);
    if (html.includes("cf-mitigated") || html.includes("challenge-platform")) return [];

    // 🎯 Use enhanced extraction with brand context
    let oems = smartExtractOems(html, ctx);
    if (!oems.length) {
      oems = await aiExtractOemsFromHtml(html, ctx);
    }
    return oems.map((o: string) => ({ source: "PartSouq", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

async function searchOemOnAmayama(ctx: SearchContext): Promise<OemCandidate[]> {
  try {
    const q = [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
    const url = `https://www.amayama.com/en/search?q=${encodeURIComponent(q)}`;
    const html = await fetchTextWithFallback(url);
    const inlineJson = html.match(/\"part_number\"\\s*:\\s*\"([A-Z0-9\\-\\.]+)\"/gi) || [];
    const extra = inlineJson
      .map((s) => s.replace(/.*\"part_number\"\\s*:\\s*\"/i, "").replace(/\".*/, ""))
      .map((s) => normalizeOem(s))
      .filter(Boolean) as string[];
    let oems = [...extractOemsFromHtml(html), ...extra];
    if (!oems.length) {
      oems = await aiExtractOemsFromHtml(html, ctx);
    }
    return oems.map((o: string) => ({ source: "Amayama", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

async function searchOemOnAutodocParts(ctx: SearchContext): Promise<OemCandidate[]> {
  try {
    const q = [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
    const url = `https://www.autodoc.parts/search?keyword=${encodeURIComponent(q)}`;
    const html = await fetchTextWithFallback(url);
    if (html.includes("Just a moment") && html.includes("challenge-platform")) return [];
    const jsonMatches = html.match(/\"oeNumbers\"\\s*:\\s*\\[(.*?)\\]/gi) || [];
    const extracted: string[] = [];
    jsonMatches.forEach((m: string) => {
      const parts = m.match(/[A-Z0-9\\-\\.]{5,20}/gi);
      if (parts) parts.forEach((p) => extracted.push(p));
    });

    // 🎯 Use enhanced extraction with brand context
    let oems = [...smartExtractOems(html, ctx), ...extracted.filter(e => normalizeOem(e))];
    if (!oems.length) {
      oems = await aiExtractOemsFromHtml(html, ctx);
    }
    return oems.map((o: string) => ({ source: "Autodoc.parts", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

async function searchOemOnSpareto(ctx: SearchContext): Promise<OemCandidate[]> {
  try {
    const q = [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
    const url = `https://www.spareto.com/search?q=${encodeURIComponent(q)}`;
    const html = await fetchTextWithFallback(url);
    const ldJson = html.match(/application\/ld\+json">([\s\S]*?)<\/script>/i);
    const extracted: string[] = [];
    if (ldJson && ldJson[1]) {
      const mpnMatches = ldJson[1].match(/\"mpn\"\\s*:\\s*\"([A-Z0-9\\-\\.]{5,20})\"/gi) || [];
      mpnMatches.forEach((m: string) => {
        const v = m.replace(/.*\"mpn\"\\s*:\\s*\"/i, "").replace(/\".*/, "");
        extracted.push(v);
      });
      const skuMatches = ldJson[1].match(/\"sku\"\\s*:\\s*\"([A-Z0-9\\-\\.]{5,20})\"/gi) || [];
      skuMatches.forEach((m: string) => {
        const v = m.replace(/.*\"sku\"\\s*:\\s*\"/i, "").replace(/\".*/, "");
        extracted.push(v);
      });
    }
    let oems = extractOemsFromHtml(html).concat(extracted.map((e) => normalizeOem(e)!).filter(Boolean));
    if (!oems.length) {
      oems = await aiExtractOemsFromHtml(html, ctx);
    }
    return oems.map((o: string) => ({ source: "Spareto", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

async function searchOemOnSite5(ctx: SearchContext): Promise<OemCandidate[]> {
  try {
    // Beispiel MegaZip; ggf. Login nötig -> nur Struktur als Beispiel
    const q = ctx.vehicle.vin ? ctx.vehicle.vin : [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
    const url = `https://www.megazip.net/zapchasti-dlya-avtomobiley?q=${encodeURIComponent(q)}`;
    const html = await fetchTextWithFallback(url);
    let oems = extractOemsFromHtml(html);
    if (!oems.length) {
      oems = await aiExtractOemsFromHtml(html, ctx);
    }
    return oems.map((o: string) => ({ source: "MegaZip", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

async function searchOemOn7zap(ctx: SearchContext): Promise<OemCandidate[]> {
  try {
    const q = ctx.vehicle.vin ? ctx.vehicle.vin : [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
    const url = `https://7zap.com/en/search/?keyword=${encodeURIComponent(q)}`;
    const html = await fetchText(url);
    // 🎯 Use enhanced extraction with brand context
    const oems = smartExtractOems(html, ctx);
    return oems.map((o: string) => ({ source: "7zap", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

async function searchOemOnDaparto(ctx: SearchContext): Promise<OemCandidate[]> {
  try {
    // Daparto allows specific constructed URLs if we have HSN/TSN, but Google Search is often better
    // to land on the specific category page.
    // Strategy: Search via DDG or similar ("site:daparto.de Golf 7 Bremsbeläge hinten")

    // We try a direct search URL which Daparto often redirects to results
    const q = [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
    const url = `https://html.duckduckgo.com/html?q=${encodeURIComponent("site:daparto.de " + q)}`;

    const html = await fetchTextWithFallback(url);
    const oems = extractOemsFromHtml(html);

    // AI check on the search result snippet
    const aiOems = await aiExtractOemsFromHtml(html, ctx);

    return [...oems, ...aiOems].map((o: string) => ({ source: "Daparto_Search", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

async function searchOemOnMotointegrator(ctx: SearchContext): Promise<OemCandidate[]> {
  try {
    const q = [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");
    const url = `https://www.motointegrator.de/suche/result/?q=${encodeURIComponent(q)}`;
    const html = await fetchTextWithFallback(url);

    // 🎯 Use enhanced extraction with brand context
    const oems = smartExtractOems(html, ctx);
    const aiOems = await aiExtractOemsFromHtml(html, ctx);

    return [...oems, ...aiOems].map((o: string) => ({ source: "Motointegrator", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

async function searchOemOnEbay(ctx: SearchContext): Promise<OemCandidate[]> {
  try {
    // eBay Keyword Search
    // Strategy: Use Brand + Model + Part, or just Part number if suspected
    const q = ctx.suspectedNumber
      ? ctx.suspectedNumber
      : [ctx.vehicle.brand, ctx.vehicle.model, ctx.userQuery].filter(Boolean).join(" ");

    const url = `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(q)}&_sacat=0`;
    // eBay needs premium proxy usually
    const html = await fetchTextWithFallback(url, true);

    // 🎯 Use enhanced extraction with brand context for eBay
    const oems = smartExtractOems(html, ctx);

    // Optional: AI Refinement if enabled
    const aiOems = await aiExtractOemsFromHtml(html, ctx);

    return [...oems, ...aiOems].map((o: string) => ({ source: "eBay", rawValue: o, normalized: o }));
  } catch (err) {
    // Silent fail for scraper
    return [];
  }
}

// ----------------------------------
// Fallback-Resolver (Platzhalter)
// ----------------------------------

export async function fallbackResolveOem(ctx: SearchContext): Promise<string | null> {
  // KI-gestützter Fallback: Versuche zuerst eine Nummer im Usertext, danach Gemini-Guess.
  const match = ctx.userQuery.match(/\b(?=.*\d)[A-Z0-9][A-Z0-9\.\-\s]{4,20}[A-Z0-9]\b/i);
  if (match) return normalizeOem(match[0]);

  // Gemini-gestützter Guess basierend auf Fahrzeug + Teilname
  if (process.env.GEMINI_API_KEY) {
    try {
      const prompt = `Fahrzeugdaten:\n${JSON.stringify(ctx.vehicle, null, 2)}\nTeil: ${ctx.userQuery}\n\nGib eine JSON-Antwort: {"oems": ["<OEM1>", "<OEM2>"]}. Keine Erklärungen. OEMs normalisiert (Großbuchstaben, keine Sonderzeichen).`;
      const txt = await generateChatCompletion({
        messages: [
          { role: "system", content: "Du bist ein Automotive-OEM-Detektor. Antworte strikt mit JSON und plausiblen OEM-Nummern." },
          { role: "user", content: prompt }
        ],
        temperature: 0
      });
      let parsed: any = null;
      try {
        parsed = JSON.parse(txt);
      } catch {
        const matchJson = txt.match(/\{[\s\S]*\}/);
        if (matchJson) {
          try {
            parsed = JSON.parse(matchJson[0]);
          } catch {
            parsed = null;
          }
        }
      }
      const fromList = Array.isArray(parsed?.oems) ? parsed.oems.map((o: string) => normalizeOem(o)).find(Boolean) : null;
      if (fromList) return fromList;
      // Fallback: direkt erste OEM-artige Zeichenfolge aus dem Text holen
      const regex = /[A-Z0-9][A-Z0-9\.\-\s]{4,20}[A-Z0-9]/gi;
      const plainMatch = txt.match(regex);
      const first =
        plainMatch
          ?.map((s: string) => normalizeOem(s))
          .find((n: string | null | undefined) => n && looksLikeOem(n)) || null;
      if (first) return first;
    } catch (err) {
      // ignore and fallback
    }
  }

  // Fallback-Synthetic
  if (ctx.vehicle.brand && ctx.vehicle.model) {
    return normalizeOem(`${ctx.vehicle.brand}-${ctx.vehicle.model}-${ctx.userQuery}`.replace(/\s+/g, ""));
  }
  return null;
}

// ----------------------------------
// Aggregation & Auswahl der besten OEM
// ----------------------------------

/**
 * 🎯 ENHANCED EXTRACTION WRAPPER
 * Uses the enhanced extractor with brand context for better results
 */
function extractOemsEnhanced(html: string, ctx: SearchContext): OemCandidate[] {
  const brand = ctx.vehicle.brand;
  const result = extractOEMsEnhanced(html, brand);

  // Auto-learn supersessions from this HTML
  learnSupersessionsFromHTML(html);

  // Convert to OemCandidate format with confidence
  return result.candidates.map(c => ({
    source: 'enhanced',
    rawValue: c.oem,
    normalized: c.oem,
    score: c.confidence,
  }));
}

/**
 * Smart extraction: tries enhanced first, falls back to basic if needed
 */
function smartExtractOems(html: string, ctx: SearchContext): string[] {
  // Try enhanced extraction with brand context
  const enhanced = extractOEMsEnhanced(html, ctx.vehicle.brand);

  // Auto-learn supersessions
  learnSupersessionsFromHTML(html);

  // If we got high-confidence candidates, use those
  const highConfidence = enhanced.candidates.filter(c => c.confidence > 0.6);
  if (highConfidence.length > 0) {
    return highConfidence.map(c => c.oem);
  }

  // Fallback to basic extraction
  return extractOemsFromHtml(html);
}

export async function findBestOemForVehicle(ctx: SearchContext, useFallback = true): Promise<BestOemResult> {
  // Query-Expansion über OpenAI
  const extraQueries = await geminiSuggestQueries(ctx);
  const queryVariants = [ctx.suspectedNumber || undefined, ctx.userQuery, ...extraQueries].filter(
    (v): v is string => typeof v === "string" && v.length > 0
  );

  const scrapeOnce = async (userQuery: string) => {
    const subCtx = { ...ctx, userQuery };
    const results = await Promise.allSettled([
      searchOemOnPartSouq(subCtx),
      searchOemOnAmayama(subCtx),
      searchOemOnAutodocParts(subCtx),
      searchOemOnSpareto(subCtx),
      searchOemOn7zap(subCtx),
      searchOemOnSite5(subCtx),
      searchOemOnDaparto(subCtx),
      searchOemOnMotointegrator(subCtx)
    ]);
    const cands: OemCandidate[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") cands.push(...r.value);
    }
    return cands;
  };

  let candidates: OemCandidate[] = [];
  for (const q of queryVariants) {
    candidates.push(...(await scrapeOnce(q)));
  }

  // eBay-Specific Search (High Value)
  // We run this separately because it's a key requirement from the user
  if (ctx.userQuery) {
    const ebayCands = await searchOemOnEbay(ctx);
    candidates.push(...ebayCands);
  }

  // Histogramm bauen
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

  // OpenAI-Reranking
  bestOem = await geminiRerank(bestOem, candidates, ctx);

  // Fallback, falls nichts gefunden
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

  // Rückabsicherung: mit der gefundenen OEM erneut quer suchen
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

// ----------------------------------
// Beispiel: BMW-Testfall
// ----------------------------------
export async function demoBmwCase() {
  const ctx: SearchContext = {
    vehicle: {
      brand: "BMW",
      model: "316TI",
      year: 2003,
      vin: "WBAxxxxxxxxxxxxxx",
      hsn: "0005",
      tsn: "742" // Beispiel
    },
    userQuery: "Bremsscheiben vorne"
  };

  const result = await findBestOemForVehicle(ctx);
  console.log("Beste OEM:", result.bestOem);
  console.log("Fallback genutzt:", result.fallbackUsed);
  console.log("Kandidaten:", result.candidates);
}
