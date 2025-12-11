import { OEMResolverRequest, OEMResolverResult, OEMCandidate } from "./types";
import { logger } from "../../utils/logger";
import { cacheSource } from "./sources/cacheSource";
import { tecdocLightSource } from "./sources/tecdocLightSource";
import { tecdocVinRestSource } from "./sources/tecdocVinRestSource";
import { tecdocNumberSource } from "./sources/tecdocNumberSource";
import { shopSearchSource } from "./sources/shopSearchSource";
import { webScrapeSource } from "./sources/webScrapeSource";
import { aiGuessSource } from "./sources/aiGuessSource";
import { llmHeuristicSource } from "./sources/llmHeuristicSource";
import { clampConfidence, OEMSource } from "./sources/baseSource";
import { backsearchOEM } from "./backsearch";
import { filterByPartMatch } from "./sources/partMatchHelper";

const SOURCES: OEMSource[] = [
  cacheSource,
  tecdocNumberSource,
  tecdocVinRestSource,
  tecdocLightSource,
  shopSearchSource,
  webScrapeSource,
  aiGuessSource,
  llmHeuristicSource
];

function mergeCandidates(candidates: OEMCandidate[]): OEMCandidate[] {
  const map = new Map<string, OEMCandidate & { sources: Set<string> }>();
  for (const c of candidates) {
    const key = c.oem.trim();
    if (!map.has(key)) {
      map.set(key, { ...c, sources: new Set([c.source]) });
    } else {
      const existing = map.get(key)!;
      // combine confidence: 1 - product of (1 - conf)
      const combined = 1 - (1 - existing.confidence) * (1 - c.confidence);
      existing.confidence = clampConfidence(combined);
      if (c.brand && !existing.brand) existing.brand = c.brand;
      existing.sources.add(c.source);
      existing.meta = { ...(existing.meta || {}), ...(c.meta || {}) };
    }
  }
  return Array.from(map.values()).map((c) => ({
    oem: c.oem,
    brand: c.brand,
    source: Array.from(c.sources).join("+"),
    confidence: c.confidence,
    meta: c.meta
  }));
}

function pickPrimary(candidates: OEMCandidate[]): { primaryOEM?: string; note?: string; overall: number } {
  if (!candidates.length) return { primaryOEM: undefined, note: "Keine OEM-Kandidaten gefunden.", overall: 0 };
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const best = sorted[0];
  const overall = best.confidence;
  if (best.confidence >= 0.9) {
    return { primaryOEM: best.oem, note: undefined, overall };
  }
  if (best.confidence >= 0.7) {
    return {
      primaryOEM: best.oem,
      note: "Manuelle Prüfung empfohlen (Confidence < 0.9).",
      overall
    };
  }
  return {
    primaryOEM: undefined,
    note: "Unsicher (<0.7). Bitte an Menschen eskalieren.",
    overall
  };
}

/**
 * Central entry point for OEM resolution.
 * The bot flow should call ONLY this function (no direct TecDoc/Shop/LLM calls).
 * Additional sources (TecDoc-Light, Shop-Scraper, LLM-Heuristik, Cache) will be orchestrated here.
 */
export async function resolveOEM(req: OEMResolverRequest): Promise<OEMResolverResult> {
  const allCandidates: OEMCandidate[] = [];

  const results: OEMCandidate[][] = await Promise.all(
    SOURCES.map(async (source) => {
      try {
        logger.debug?.("OEM resolver: calling source", { source: source.name, orderId: req.orderId });
        const res = await source.resolveCandidates(req);
        logger.info("OEM resolver source result", { source: source.name, count: res.length, orderId: req.orderId });
        return res;
      } catch (err: any) {
        logger.warn("OEM resolver source failed", { source: source.name, error: err?.message, orderId: req.orderId });
        return [];
      }
    })
  );

  results.forEach((arr: OEMCandidate[]) => allCandidates.push(...arr));

  // Teil-Plausibilität prüfen (verwirft OEMs, die nicht zum Teiltext passen)
  const filtered = await filterByPartMatch(allCandidates, req);

  const merged = mergeCandidates(filtered);

  // Boost confidence if vehicle meta matches exactly (kw/year) in candidate meta
  for (const c of merged) {
    const meta = c.meta || {};
    const yearMatch = meta.year && req.vehicle.year && meta.year === req.vehicle.year;
    const kwMatch = meta.kw && req.vehicle.kw && meta.kw === req.vehicle.kw;
    if (yearMatch) c.confidence = clampConfidence(c.confidence + 0.05);
    if (kwMatch) c.confidence = clampConfidence(c.confidence + 0.05);
  }

  const { primaryOEM, note, overall } = pickPrimary(merged);
  if (primaryOEM) {
    logger.info("OEM resolver chose primary", { orderId: req.orderId, oem: primaryOEM, confidence: overall });

    // Backsearch to confirm the OEM via Rapid TecDoc and web (e.g., 7zap/PartSouq)
    try {
      const confirm = await backsearchOEM(primaryOEM, req);
      if (confirm.tecdocHit || confirm.webHit) {
        // Boost confidence of the chosen candidate slightly if confirmed
        const idx = merged.findIndex((c) => c.oem === primaryOEM);
        if (idx >= 0) merged[idx].confidence = clampConfidence(merged[idx].confidence + 0.1);
      } else {
        logger.warn("OEM backsearch found no confirmation", { orderId: req.orderId, oem: primaryOEM });
      }
    } catch (err: any) {
      logger.warn("OEM backsearch failed", { orderId: req.orderId, oem: primaryOEM, error: err?.message });
    }
  } else {
    logger.warn("OEM resolver no confident primary", { orderId: req.orderId, overallConfidence: overall });
  }

  return {
    primaryOEM,
    candidates: merged,
    overallConfidence: overall,
    notes: note
  };
}
