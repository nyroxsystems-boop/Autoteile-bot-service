// Wir versuchen cheerio dynamisch zu laden, nutzen aber einen Fallback ohne cheerio,
// falls das Modul nicht installiert ist (verhindert Test-/Build-Abbrüche).
// @ts-ignore
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cheerio = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("cheerio");
  } catch {
    return null as any;
  }
})();

export interface VehicleData {
  vin?: string;
  brand?: string;
  model?: string;
  year?: number;
  engineCode?: string;
  hsn?: string;
  tsn?: string;
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
  confirmed?: boolean;
  confirmationCount?: number;
}

// ------------------------
// Normalisierung & Erkennung
// ------------------------

export function normalizeOem(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toUpperCase().replace(/[\s\.\-]+/g, "");
  if (!cleaned) return null;
  if (!/^[A-Z0-9]+$/.test(cleaned)) return null;
  if (!/[0-9]/.test(cleaned)) return null; // muss mindestens eine Ziffer enthalten
  const digits = (cleaned.match(/[0-9]/g) || []).length;
  const letters = (cleaned.match(/[A-Z]/g) || []).length;
  const total = cleaned.length;
  if (digits < 2) return null; // mindestens zwei Ziffern
  if (letters === 0) return null; // mindestens ein Buchstabe
  const letterRatio = letters / total;
  if (total > 10 && letterRatio > 0.8) return null; // zu "wortartig"
  const stopWords = ["POWEREDBY", "HOMEPAGE", "SEARCH", "ENGINE", "EMAIL", "EXAMPLE", "WEBADDRESS", "SHOP"];
  if (stopWords.some((w) => cleaned.includes(w))) return null;
  if (cleaned.length < 6 || cleaned.length > 18) return null;
  return cleaned;
}

export function looksLikeOem(str: string): boolean {
  const n = normalizeOem(str);
  return n !== null;
}

export function extractOemsFromHtml(html: string): string[] {
  let text: string;
  if (cheerio) {
    const $ = cheerio.load(html);
    text = $("body").text() || "";
  } else {
    // Fallback: Verwende kompletten HTML-String
    text = html || "";
  }
  const regex = /[A-Z0-9][A-Z0-9\.\-\s]{4,20}[A-Z0-9]/gi;
  const candidates = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    if (looksLikeOem(raw)) {
      const norm = normalizeOem(raw);
      if (norm) candidates.add(norm);
    }
  }
  return Array.from(candidates);
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

// ------------------------
// Quell-spezifische Suchfunktionen
// ------------------------

// Pflicht: PartSouq
export async function searchOemOnPartSouq(vehicle: VehicleData): Promise<OemCandidate[]> {
  try {
    let url: string;
    if (vehicle.vin) {
      url = `https://partsouq.com/vin/${encodeURIComponent(vehicle.vin)}`;
    } else {
      const q = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ");
      url = `https://partsouq.com/en/search/all?q=${encodeURIComponent(q || "brake disc")}`;
    }
    const html = await fetchText(url);
    const oems = extractOemsFromHtml(html);
    return oems.map((o) => ({ source: "PartSouq", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

// Placeholder: Amayama
export async function searchOemOnSiteA(vehicle: VehicleData): Promise<OemCandidate[]> {
  try {
    // TODO: Passen Sie diese URL und das HTML-Parsing an die echte Seite an.
    const q = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ");
    const url = `https://www.amayama.com/en/search?q=${encodeURIComponent(q || "brake disc")}`;
    const html = await fetchText(url);
    const oems = extractOemsFromHtml(html);
    return oems.map((o) => ({ source: "Amayama", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

// Placeholder: Autodoc.parts (Katalog, nicht Shop)
export async function searchOemOnSiteB(vehicle: VehicleData): Promise<OemCandidate[]> {
  try {
    // TODO: Passen Sie diese URL und das HTML-Parsing an die echte Seite an.
    const q = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ");
    const url = `https://www.autodoc.parts/search?keyword=${encodeURIComponent(q || "brake disc")}`;
    const html = await fetchText(url);
    const oems = extractOemsFromHtml(html);
    return oems.map((o) => ({ source: "Autodoc.parts", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

// Placeholder: Spareto
export async function searchOemOnSiteC(vehicle: VehicleData): Promise<OemCandidate[]> {
  try {
    // TODO: Passen Sie diese URL und das HTML-Parsing an die echte Seite an.
    const q = [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ");
    const url = `https://spareto.com/search?q=${encodeURIComponent(q || "brake disc")}`;
    const html = await fetchText(url);
    const oems = extractOemsFromHtml(html);
    return oems.map((o) => ({ source: "Spareto", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

// Placeholder: PartsLink24 (öffentliche Teileansicht)
export async function searchOemOnSiteD(vehicle: VehicleData): Promise<OemCandidate[]> {
  try {
    // TODO: Passen Sie diese URL und das HTML-Parsing an die echte Seite an.
    const q = vehicle.vin
      ? `vin=${encodeURIComponent(vehicle.vin)}`
      : [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ");
    const url = `https://www.partslink24.com/search?query=${encodeURIComponent(q || "brake disc")}`;
    const html = await fetchText(url);
    const oems = extractOemsFromHtml(html);
    return oems.map((o) => ({ source: "PartsLink24", rawValue: o, normalized: o }));
  } catch {
    return [];
  }
}

// ------------------------
// Aggregation & Auswahl der besten OEM
// ------------------------

export async function findBestOemForVehicle(vehicle: VehicleData): Promise<BestOemResult> {
  const results = await Promise.allSettled([
    searchOemOnPartSouq(vehicle),
    searchOemOnSiteA(vehicle),
    searchOemOnSiteB(vehicle),
    searchOemOnSiteC(vehicle),
    searchOemOnSiteD(vehicle)
  ]);

  const candidates: OemCandidate[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      candidates.push(...r.value);
    } else {
      // Fehler einer Quelle ignorieren (hier könnte geloggt werden)
    }
  }

  const histogram: Record<string, number> = {};
  for (const c of candidates) {
    histogram[c.normalized] = (histogram[c.normalized] || 0) + 1;
  }

  let bestOem: string | null = null;
  if (candidates.length > 0) {
    const sorted = Object.entries(histogram).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]; // Häufigkeit
      return b[0].length - a[0].length;     // Länge als sekundärer Faktor
    });
    bestOem = sorted[0]?.[0] ?? null;
  }

  // Rückabsicherung: Best-OEM erneut quer suchen und Vorkommen zählen
  let confirmed = false;
  let confirmationCount = 0;
  if (bestOem) {
    confirmationCount = await confirmOemAcrossSources(bestOem, vehicle);
    confirmed = confirmationCount > 0; // mindestens eine Bestätigung
  }

  return { bestOem, candidates, histogram, confirmed, confirmationCount };
}

// ------------------------
// Rückbestätigung: gezielte Suche mit der gefundenen OEM
// ------------------------

async function searchByOemDirect(source: string, q: string): Promise<string[]> {
  try {
    let url = "";
    switch (source) {
      case "PartSouq":
        url = `https://partsouq.com/en/search/all?q=${encodeURIComponent(q)}`;
        break;
      case "Amayama":
        url = `https://www.amayama.com/en/search?q=${encodeURIComponent(q)}`;
        break;
      case "Autodoc.parts":
        url = `https://www.autodoc.parts/search?keyword=${encodeURIComponent(q)}`;
        break;
      case "Spareto":
        url = `https://spareto.com/search?q=${encodeURIComponent(q)}`;
        break;
      case "PartsLink24":
        url = `https://www.partslink24.com/search?query=${encodeURIComponent(q)}`;
        break;
      default:
        return [];
    }
    const html = await fetchText(url);
    return extractOemsFromHtml(html);
  } catch {
    return [];
  }
}

export async function confirmOemAcrossSources(oem: string, vehicle: VehicleData): Promise<number> {
  const normalized = normalizeOem(oem);
  if (!normalized) return 0;
  const sources = ["PartSouq", "Amayama", "Autodoc.parts", "Spareto", "PartsLink24"];
  const results = await Promise.allSettled(sources.map((s) => searchByOemDirect(s, normalized)));
  let hits = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.some((v) => v === normalized)) {
      hits += 1;
    }
  }
  return hits;
}

// ------------------------
// Beispiel-Integration (ersetze TecDoc/Apify-Aufrufe)
// ------------------------
// Hier könnte bisherige TecDoc-Logik entfernt und durch findBestOemForVehicle ersetzt werden.
export async function demoOemLookup() {
  const vehicle: VehicleData = {
    vin: "W0L0ZCF6931033634",
    brand: "Opel",
    model: "Astra",
    year: 2009,
    engineCode: "Z16XEP",
    hsn: "0039",
    tsn: "AAB"
  };

  const result = await findBestOemForVehicle(vehicle);
  console.log("Beste OEM:", result.bestOem);
  console.log("Alle Kandidaten:", result.candidates);
  console.log("Histogramm:", result.histogram);
}
