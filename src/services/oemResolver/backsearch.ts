import fetch from "node-fetch";
import { logger } from "../../utils/logger";
import { OEMResolverRequest } from "./types";

type BacksearchResult = {
  tecdocHit: boolean;
  webHit: boolean;     // 7zap
  autodocHit: boolean;
  dapartoHit: boolean;
  ebayHit: boolean;
  totalHits: number;
};

const RAPID_KEY = process.env.TECDOC_API_KEY || process.env.RAPIDAPI_KEY || "";
const RAPID_HOST = process.env.TECDOC_RAPID_API_HOST || process.env.RAPIDAPI_HOST || "tecdoc-catalog.p.rapidapi.com";
const BACKSEARCH_TIMEOUT_MS = 6000; // slightly shorter per request to run in parallel

/**
 * Validate a found OEM by re-querying multiple independent sources 
 * and checking for explicit vehicle compatibility.
 */
export async function backsearchOEM(oem: string, req: OEMResolverRequest): Promise<BacksearchResult> {
  const result: BacksearchResult = {
    tecdocHit: false,
    webHit: false,
    autodocHit: false,
    dapartoHit: false,
    ebayHit: false,
    totalHits: 0
  };

  const tasks = [];
  const normalizedOEM = oem.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  // Extract significant keywords from vehicle info
  const make = (req.vehicle.make || "").toLowerCase();
  const modelWords = (req.vehicle.model || "").toLowerCase().split(/[\s\-]/).filter(w => w.length > 2);

  // Add common brand synonyms
  const synonyms: Record<string, string[]> = {
    'volkswagen': ['vw'],
    'mercedes-benz': ['mercedes', 'benz', 'mb'],
    'bmw': ['bayerische'],
    'mitsubishi': ['mitsu']
  };

  const keywords = [make, ...modelWords, ...(synonyms[make] || [])].filter(k => k.length > 0);

  const checkCompliance = (html: string) => {
    const lowerHtml = html.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!lowerHtml.includes(normalizedOEM)) return false;

    // Check if at least one significant vehicle keyword is present in the original HTML
    const originalLowerHtml = html.toLowerCase();
    return keywords.some(k => originalLowerHtml.includes(k));
  };

  // 1. 7zap / Web Check
  tasks.push((async () => {
    try {
      const url = `https://7zap.com/en/search/?keyword=${encodeURIComponent(oem)}`;
      const res = await fetch(url, { method: "GET", timeout: 8000 });
      if (res.ok) {
        const html = await res.text();
        if (checkCompliance(html)) result.webHit = true;
      }
    } catch (err) { /* ignore */ }
  })());

  // 2. Autodoc
  tasks.push((async () => {
    try {
      const url = `https://www.autodoc.de/search?keyword=${encodeURIComponent(oem)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
      });
      if (res.ok) {
        const html = await res.text();
        if (checkCompliance(html)) result.autodocHit = true;
      }
    } catch (err) { /* ignore */ }
  })());

  // 3. Daparto
  tasks.push((async () => {
    try {
      const url = `https://www.daparto.de/Teilenummern-Suche/Teile/Alle-Hersteller/${encodeURIComponent(oem)}`;
      const res = await fetch(url, { method: "GET", timeout: 8000 });
      if (res.ok) {
        const html = await res.text();
        if (checkCompliance(html)) result.dapartoHit = true;
      }
    } catch (err) { /* ignore */ }
  })());

  // 4. eBay
  tasks.push((async () => {
    try {
      const url = `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(oem)}`;
      const res = await fetch(url, { method: "GET", timeout: 8000 });
      if (res.ok) {
        const html = await res.text();
        if (checkCompliance(html) && !html.toLowerCase().includes("0 ergebnisse")) result.ebayHit = true;
      }
    } catch (err) { /* ignore */ }
  })());

  await Promise.all(tasks);

  let hits = 0;
  if (result.webHit) hits++;
  if (result.autodocHit) hits++;
  if (result.dapartoHit) hits++;
  if (result.ebayHit) hits++;
  result.totalHits = hits;

  logger.info("Deep Backsearch finished", { oem, hits: result.totalHits });
  return result;
}
