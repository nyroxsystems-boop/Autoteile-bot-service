import { normalizeOem, looksLikeOem } from "./oemScraper";

// Sehr einfache OEM-Erkennung als Platzhalter.
// In einem echten Bot würdest du hier ein Modell / Regex + Wissensbasis nutzen.

export async function detectOemFromUserMessage(message: string): Promise<string | null> {
  const regex = /\b[A-Z0-9][A-Z0-9\.\-\s]{4,20}[A-Z0-9]\b/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(message)) !== null) {
    const norm = normalizeOem(match[0]);
    if (norm && looksLikeOem(norm)) return norm;
  }
  return null;
}
