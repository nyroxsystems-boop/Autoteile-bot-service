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

/**
 * Normalisiert eine OEM-/Teilenummer:
 * - trimmt
 * - Großbuchstaben
 * - entfernt Leerzeichen, Punkte, Bindestriche
 * - filtert offensichtlichen Müll
 */
export function normalizeOem(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toUpperCase().replace(/[\s\.\-]+/g, "");
  if (!cleaned) return null;

  // Nur A–Z / 0–9 zulassen
  if (!/^[A-Z0-9]+$/.test(cleaned)) return null;

  // Mindestens eine Ziffer
  if (!/[0-9]/.test(cleaned)) return null;

  const digits = (cleaned.match(/[0-9]/g) || []).length;
  const letters = (cleaned.match(/[A-Z]/g) || []).length;
  const total = cleaned.length;

  if (digits < 2) return null; // mindestens zwei Ziffern
  if (letters === 0) return null; // mindestens ein Buchstabe

  const letterRatio = letters / total;
  if (total > 10 && letterRatio > 0.8) return null; // zu "wortartig"

  const stopWords = [
    "POWEREDBY",
    "HOMEPAGE",
    "SEARCH",
    "ENGINE",
    "EMAIL",
    "EXAMPLE",
    "WEBADDRESS",
    "SHOP",
    "COOKIE",
    "CONSENT",
    "PRIVACY",
    "GOOGLE",
    "ANALYTICS"
  ];
  if (stopWords.some((w) => cleaned.includes(w))) return null;

  // typische OEM-Längen grob eingrenzen
  if (cleaned.length < 6 || cleaned.length > 18) return null;

  return cleaned;
}

/**
 * Schnelle Prüfung, ob ein String nach OEM aussieht.
 */
export function looksLikeOem(str: string): boolean {
  const n = normalizeOem(str);
  return n !== null;
}

/**
 * Extrahiert OEM-artige Strings aus HTML.
 * - Verwendet cheerio (wenn vorhanden), um nur Text aus <body> zu ziehen
 * - Sucht mit Regex nach Buchstaben/Zahlen-Mustern
 * - Normalisiert & filtert Dubletten
 */
export function extractOemsFromHtml(html: string): string[] {
  let text: string;

  if (cheerio) {
    const $ = cheerio.load(html);
    // nur Text aus dem Body (keine <script>/<style>)
    $("script,style,noscript").remove();
    text = $("body").text() || "";
  } else {
    // Fallback: gesamtes HTML (inkl. Tags)
    text = html || "";
  }

  const regex = /[A-Z0-9][A-Z0-9\.\-\s]{4,20}[A-Z0-9]/gi;
  const candidates = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const norm = normalizeOem(raw);
    if (norm) {
      candidates.add(norm);
    }
  }

  return Array.from(candidates);
}
