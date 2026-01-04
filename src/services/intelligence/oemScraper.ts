// Minimal helper for extracting OEM-like strings from HTML/text.

const BLACKLIST = new Set([
  "DETAILS", "SCHEINWERFER", "FILTER", "BREMSSCHEIBE", "BREMSBELAG", "ZÜNDKERZE",
  "LINKS", "RECHTS", "VORNE", "HINTEN", "OBEN", "UNTEN", "SATZ", "KIT", "SET",
  "MWST", "EXKL", "INKL", "VERSAND", "PREIS", "LAGER", "SOFORT", "LIEFERBAR",
  "BOSCH", "ATE", "MANN", "MAHLE", "VALEO", "HELLA", "TRW", "TEXTAR", "FEBI", "BILSTEIN",
  "PR-NUMMER", "OEM", "OE", "ARTIKEL", "NUMMER", "VERGLEICH", "PASST", "FÜR",
  "MODELLE", "BAUJAHR", "AB", "BIS", "KW", "PS", "CCM", "MOTOR", "DESCRIPTION",
  "ADDITIONAL", "INFORMATION", "PRODUCT", "VIEW", "MORE", "LESS", "SEARCH", "RESULTS",
  "FOUND", "MATCHING", "YOUR", "VEHICLE", "CART", "ACCOUNT", "LOGIN", "REGISTER",
  "CONTACT", "ABOUT", "US", "TERMS", "PRIVACY", "POLICY", "IMPRESSUM", "AGB",
  "DATENSCHUTZ", "WIDERRUF", "VERSANDART", "ZAHLUNG", "KATEGORIE", "HERSTELLER",
  "MARKE", "MODELL", "TYP", "MOTORCODE", "100", "200", "NULL", "UNDEFINED", "TRUE", "FALSE",
  // HTML/WEB JUNK
  "DOCTYPE", "HTML", "HEAD", "BODY", "TITLE", "META", "LINK", "SCRIPT", "STYLE",
  "DIV", "SPAN", "CLASS", "WIDTH", "HEIGHT", "HREF", "SRC", "ALT", "UTF8", "CHARSET",
  "HEADER", "FOOTER", "NAV", "MAIN", "SECTION", "ARTICLE", "ASIDE", "INPUT", "BUTTON",
  "FORM", "LABEL", "SELECT", "OPTION", "TEXTAREA", "IMG", "SVG", "PATH", "CANVAS",
  "IFRAME", "STRONG", "SMALL", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "UL", "OL", "LI",
  "JSON", "XML", "HTTP", "HTTPS", "WWW", "COM", "NET", "ORG", "DE", "PHP", "ASP", "ASPX",
  "JSP", "HTML5", "CSS", "JS", "JQUERY", "AJAX", "API", "SDK", "URI", "URL", "URN",
  "WOFF", "WOFF2", "TTF", "EOT", "OTF", "JPG", "JPEG", "PNG", "GIF", "BMP", "ICO", "ICON",
  "FONT", "PFADE", "MEDIA", "UPLOADS", "CONTENT", "ASSETS",
  "ANOMALY", "MODAL", "TILE", "WEBFONT", "GLYPH", "SPRITE", "SVG", "PATH", "DATA",
  "EU", "INFO", "BIZ", "CO", "AT", "CH", "FR", "IT", "RU", "CN", "JP"
]);

export function normalizeOem(input: string | null | undefined): string | null {
  if (!input) return null;
  // Entferne Leerzeichen, Bindestriche, Punkte -> reiner alphanumerischer String
  const clean = input.toString().toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Strenge Plausibilität
  if (clean.length < 5 || clean.length > 18) return null; // OEMs meist 7-13, minimal 5

  // HTML Junk-Check (Pure Caps Words sind gefährlich)
  if (/^[A-Z]+$/.test(clean)) {
    // Wenn es nur Buchstaben sind, muss es sehr spezifisch sein.
    // Echte OEMs haben fast immer Zahlen (VAG: 1K0..., BMW: 1234..., MB: A123...).
    // Reine Buchstaben-Codes sind extrem selten (evtl. alte US-Teile).
    // Wir blockieren reine Buchstaben-Strings < 8 Zeichen, da meistens Müll ("SEARCH").
    if (clean.length < 8) return null;

    if (BLACKLIST.has(clean)) return null;
  }

  if (BLACKLIST.has(clean) || BLACKLIST.has(input.trim().toUpperCase())) return null;

  // Specific Junk Prefixes
  if (clean.startsWith("ICON") || clean.startsWith("WOFF") || clean.startsWith("FONT")) return null;

  // Muss mindestens eine Ziffer enthalten? Viele OEMs tun das.
  // Audi: 8V0... (Ja)
  // BMW: 1234567 (Ja)
  // MB: A123... (Ja)
  // Es gibt kaum OEMs ohne Ziffern.
  // Safety Rule: Wenn keine Ziffer, dann verwerfen.
  if (!/\d/.test(clean)) return null;

  return clean;
}

export function looksLikeOem(s: string): boolean {
  return !!normalizeOem(s);
}

export function extractOemsFromHtml(html: string): string[] {
  if (!html) return [];
  const candidates = new Set<string>();
  // find sequences of uppercase letters/numbers with length 4-20
  const re = /\b[A-Z0-9][A-Z0-9\-\.]{3,18}[A-Z0-9]\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const norm = normalizeOem(m[0]);
    if (norm) candidates.add(norm);
  }
  return Array.from(candidates);
}
