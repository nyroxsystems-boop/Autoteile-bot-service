/**
 * 🔍 Backsearch Module - OEM Validation via Web Scrapers
 * 
 * Validates found OEM numbers by re-querying multiple independent web sources
 * and checking for explicit vehicle compatibility.
 * 
 * K1 FIX: Uses fetchText (ScraperAPI-proxied) instead of raw fetch
 */
import { fetchText } from './oemWebFinder';
import { logger } from "@utils/logger";
import { OEMResolverRequest } from "./types";

export type BacksearchResult = {
  webHit: boolean;      // 7zap
  autodocHit: boolean;  // Autodoc.de
  dapartoHit: boolean;  // Daparto.de
  ebayHit: boolean;     // eBay.de
  totalHits: number;
  errors: string[];     // Track errors for observability
};

const BACKSEARCH_TIMEOUT_MS = 5000;

/**
 * Validate a found OEM by re-querying multiple independent sources 
 * and checking for explicit vehicle compatibility.
 */
export async function backsearchOEM(oem: string, req: OEMResolverRequest): Promise<BacksearchResult> {
  const result: BacksearchResult = {
    webHit: false,
    autodocHit: false,
    dapartoHit: false,
    ebayHit: false,
    totalHits: 0,
    errors: []
  };

  const tasks: Promise<void>[] = [];
  const normalizedOEM = oem.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  // Extract significant keywords from vehicle info
  const make = (req.vehicle.make || "").toLowerCase();
  const modelWords = (req.vehicle.model || "").toLowerCase().split(/[\s\-]/).filter(w => w.length > 2);

  // Add common brand synonyms
  const synonyms: Record<string, string[]> = {
    'volkswagen': ['vw'],
    'mercedes-benz': ['mercedes', 'benz', 'mb'],
    'bmw': ['bayerische'],
    'mitsubishi': ['mitsu'],
    'porsche': ['porsche ag'],
    'audi': ['audi ag']
  };

  const keywords = [make, ...modelWords, ...(synonyms[make] || [])].filter(k => k.length > 0);

  const checkCompliance = (html: string): boolean => {
    const lowerHtml = html.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!lowerHtml.includes(normalizedOEM)) return false;

    // Check if at least one significant vehicle keyword is present
    const originalLowerHtml = html.toLowerCase();
    return keywords.some(k => originalLowerHtml.includes(k));
  };

  // 1. 7zap / Web Check — via ScraperAPI
  tasks.push((async () => {
    const source = "7zap";
    try {
      const url = `https://7zap.com/en/search/?keyword=${encodeURIComponent(oem)}`;
      const html = await fetchText(url);
      if (checkCompliance(html)) {
        result.webHit = true;
        logger.info(`[Backsearch] ✅ ${source} confirmed OEM`, { oem });
      }
    } catch (err: any) {
      const errMsg = `${source}: ${err?.message || 'Unknown error'}`;
      result.errors.push(errMsg);
      logger.warn(`[Backsearch] ${source} failed`, { oem, error: err?.message });
    }
  })());

  // 2. TecDoc Catalog Search — via ScraperAPI
  tasks.push((async () => {
    const source = "tecdoc";
    try {
      const url = `https://www.tecdoc.net/search?q=${encodeURIComponent(oem)}`;
      const html = await fetchText(url);
      if (checkCompliance(html)) {
        result.autodocHit = true;
        logger.info(`[Backsearch] ✅ ${source} confirmed OEM`, { oem });
      }
    } catch (err: any) {
      const errMsg = `${source}: ${err?.message || 'Unknown error'}`;
      result.errors.push(errMsg);
      logger.warn(`[Backsearch] ${source} failed`, { oem, error: err?.message });
    }
  })());

  // 3. PartsGateway — via ScraperAPI
  tasks.push((async () => {
    const source = "partsgateway";
    try {
      const url = `https://www.partsgateway.co.uk/car-parts?q=${encodeURIComponent(oem)}`;
      const html = await fetchText(url);
      if (checkCompliance(html)) {
        result.dapartoHit = true;
        logger.info(`[Backsearch] ✅ ${source} confirmed OEM`, { oem });
      }
    } catch (err: any) {
      const errMsg = `${source}: ${err?.message || 'Unknown error'}`;
      result.errors.push(errMsg);
      logger.warn(`[Backsearch] ${source} failed`, { oem, error: err?.message });
    }
  })());

  // 4. eBay — via ScraperAPI (premium for anti-bot)
  tasks.push((async () => {
    const source = "ebay";
    try {
      const url = `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(oem)}&_sacat=6028`;
      const html = await fetchText(url, true); // premium=true for eBay
      if (checkCompliance(html) && !html.toLowerCase().includes("0 ergebnisse")) {
        result.ebayHit = true;
        logger.info(`[Backsearch] ✅ ${source} confirmed OEM`, { oem });
      }
    } catch (err: any) {
      const errMsg = `${source}: ${err?.message || 'Unknown error'}`;
      result.errors.push(errMsg);
      logger.warn(`[Backsearch] ${source} failed`, { oem, error: err?.message });
    }
  })());

  await Promise.all(tasks);

  // Calculate total hits
  let hits = 0;
  if (result.webHit) hits++;
  if (result.autodocHit) hits++;
  if (result.dapartoHit) hits++;
  if (result.ebayHit) hits++;
  result.totalHits = hits;

  logger.info("[Backsearch] Completed", {
    oem,
    totalHits: result.totalHits,
    sources: {
      webHit: result.webHit,
      autodocHit: result.autodocHit,
      dapartoHit: result.dapartoHit,
      ebayHit: result.ebayHit
    },
    errorCount: result.errors.length
  });

  return result;
}
