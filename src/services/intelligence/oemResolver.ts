import { OEMResolverRequest, OEMResolverResult, OEMCandidate } from "./types";
import { logger } from "@utils/logger";
// REMOVED: cacheSource - always returns empty []
// REMOVED: shopSearchSource - placeholder, always returns []
import { webScrapeSource } from "./sources/webScrapeSource";
import { llmHeuristicSource } from "./sources/llmHeuristicSource";
import { filterByPartMatch, resolveAftermarketToOEM } from "./sources/partMatchHelper";
import { clampConfidence } from "./sources/baseSource";
import { backsearchOEM } from "./backsearch";
import { motointegratorSource } from "./sources/motointegratorSource";
// REMOVED: autodocSource - fake wrapper for webScrapeSource
import { autodocWebSource } from "./sources/autodocWebSource";
import { sepZapWebSource } from "./sources/sepZapWebSource";
// PRODUCTION SOURCES (Schema-Fixed)
import { kfzteile24Source } from "./sources/kfzteile24Source";
import { oscaroSource } from "./sources/oscaroSource";
import { pkwteileSource } from "./sources/pkwteileSource";
import { openaiVisionSource } from "./sources/openaiVisionSource";
import { calculateConsensus, applyBrandPatternBoost } from "./consensusEngine";
import { performEnhancedValidation } from "./enhancedValidation";
// 10/10 Deep OEM Resolution
import { performDeepResolution, applySupersession } from "./deepOemResolver";
// NEW: Premium OEM Catalog Sources
import { realOemSource } from "./sources/realOemSource";
import { mercedesEpcSource } from "./sources/mercedesEpcSource";
import { vagEtkaSource } from "./sources/vagEtkaSource";
// 🏆 ENTERPRISE: Database Source (Priority 1)
import { databaseSource } from "./sources/databaseSource";
// 🔥 NEW: TecDoc Cross-Reference (Aftermarket→OEM mapping)
import { tecDocCrossRefSource } from "./sources/tecDocCrossRefSource";
// 🛡️ P0: Aftermarket filter — removes known aftermarket numbers before consensus
import { filterAftermarketCandidates } from './aftermarketFilter';
import { validateOemPatternInt } from './brandPatternRegistry';
import { filterSourcesByMode, reportSourceHealth } from './scraperFallback';
import { recordOemResolution } from './oemMetrics';
// 🚨 P0: Alert tracking for OEM resolution failures
import { trackOemResolutionResult } from "@core/alertService";


// PRODUCTION SOURCES ONLY - Fake/empty sources removed to prevent
// Multi-Source confidence inflation
const SOURCES = [
  // 🏆 ENTERPRISE DATABASE (instant, highest priority)
  databaseSource,            // SQLite database - 0ms response, 0.95+ confidence
  // 🔥 TECDOC CROSS-REFERENCE (Aftermarket→OEM mapping)
  tecDocCrossRefSource,      // Cross-reference database - instant local lookup
  // PREMIUM CATALOG SOURCES (brand-specific, high accuracy)
  realOemSource,          // BMW OEM catalog (RealOEM.com)
  mercedesEpcSource,      // Mercedes EPC catalog
  vagEtkaSource,          // VAG ETKA catalog (VW/Audi/Skoda/Seat)
  // GENERAL WEB SCRAPERS
  webScrapeSource,        // Integrates oemWebFinder with 8 web scrapers
  llmHeuristicSource,     // Premium AI OEM inference with TecDoc knowledge
  motointegratorSource,   // Direct web scraper
  autodocWebSource,       // Direct Autodoc scraper
  sepZapWebSource,        // 7zap scraper
  kfzteile24Source,       // German platform (schema-fixed)
  pkwteileSource,         // German platform (schema-fixed)
  openaiVisionSource,     // AI-powered extraction (schema-fixed)
  oscaroSource            // French platform (schema-fixed)
];

const CONFIDENCE_THRESHOLD_VETTED = 0.90;
const CONFIDENCE_THRESHOLD_RELIABLE = 0.70; // K2 FIX: Was 0.75, now consistent with resolveOEM accept threshold

function mergeCandidates(candidates: OEMCandidate[]): OEMCandidate[] {
  const map = new Map<string, OEMCandidate & { sources: Set<string> }>();
  for (const c of candidates) {
    const key = c.oem.trim().toUpperCase();
    if (!map.has(key)) {
      map.set(key, { ...c, oem: key, sources: new Set([c.source]) });
    } else {
      const existing = map.get(key)!;
      // combine confidence: 1 - product of (1 - conf)
      const combined = 1 - (1 - existing.confidence) * (1 - c.confidence);
      existing.confidence = clampConfidence(combined);
      if (c.brand && !existing.brand) existing.brand = c.brand;
      existing.sources.add(c.source);

      // Preserve critical meta-flags from special sources
      if (c.source.includes("aftermarket_reverse_lookup")) {
        existing.sources.add("aftermarket_reverse_lookup");
      }

      existing.meta = { ...(existing.meta || {}), ...(c.meta || {}) };
    }
  }
  return Array.from(map.values()).map((c) => ({
    oem: c.oem,
    brand: c.brand,
    source: Array.from(c.sources).join("+"),
    confidence: c.confidence,
    meta: c.meta,
    sourceCount: c.sources.size
  }));
}

function pickPrimary(candidates: any[]): { primaryOEM?: string; note?: string; overall: number } {
  if (!candidates.length) return { primaryOEM: undefined, note: "Keine OEM-Kandidaten gefunden.", overall: 0 };
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);
  const best = sorted[0];
  const overall = best.confidence;

  // STRICT VALIDATION: Multi-source check
  const isMultiSource = best.sourceCount >= 2;
  const isExtremelyStable = best.sourceCount >= 3;

  if (best.confidence >= CONFIDENCE_THRESHOLD_VETTED && isMultiSource) {
    return { primaryOEM: best.oem, note: "Validiert (Multi-Source + High Confidence).", overall };
  }

  if (best.confidence >= CONFIDENCE_THRESHOLD_RELIABLE) {
    return {
      primaryOEM: best.oem,
      note: isMultiSource ? "Vorausgewählt (Prüfung empfohlen)." : "Unsicherer Treffer (Single-Source). Manuelle Prüfung zwingend.",
      overall: isMultiSource ? overall : overall * 0.9 // Penalty for single source
    };
  }

  return {
    primaryOEM: undefined,
    note: "Trefferquote unter 70%. Eskalation an Experten.",
    overall
  };
}

export async function resolveOEM(req: OEMResolverRequest): Promise<OEMResolverResult> {
  const allCandidates: OEMCandidate[] = [];
  let deepResolutionMetadata: any = {};

  // =========================================================================
  // 🎯 10/10 DEEP OEM RESOLUTION - Premium Intelligence Layer
  // Called FIRST to add high-confidence candidates based on:
  // - VIN decoding (motorcode, year extraction)
  // - PR-Codes (brake/suspension variants)
  // - Motorcode (engine-specific parts)
  // - Facelift detection (pre/post FL)
  // - Supersession tracking (old→current OEM)
  // =========================================================================
  try {
    const deepResult = await performDeepResolution(req);

    // Add deep resolution candidates (highest priority)
    if (deepResult.candidates.length > 0) {
      allCandidates.push(...deepResult.candidates);
      logger.info("[OEM Resolver] 🎯 Deep resolution added candidates", {
        count: deepResult.candidates.length,
        prCodeUsed: deepResult.metadata.prCodeUsed,
        motorcodeUsed: deepResult.metadata.motorcodeUsed,
      });
    }

    // Use enriched request for scraper calls
    req = deepResult.enrichedRequest;
    deepResolutionMetadata = deepResult.metadata;
  } catch (err: any) {
    logger.warn("[OEM Resolver] Deep resolution failed, continuing with scrapers", {
      error: err?.message,
    });
  }

  // =========================================================================
  // Standard Scraper Sources (with health monitoring)
  // =========================================================================
  const { isSourceDisabled, recordSuccess, recordFailure, getConfidenceWeight } = await import('./sourceHealthMonitor');

  const results = await Promise.all(
    SOURCES.map(async (source) => {
      const sourceName = (source as any).name || "unknown";

      // Skip disabled sources
      if (isSourceDisabled(sourceName)) {
        logger.debug("OEM source skipped (disabled)", { source: sourceName });
        return [];
      }

      try {
        const res = await source.resolveCandidates(req);
        recordSuccess(sourceName);

        // Apply confidence weight based on source health
        const weight = getConfidenceWeight(sourceName);
        if (weight < 1.0) {
          res.forEach((c: any) => { c.confidence *= weight; });
        }

        return res;
      } catch (err: any) {
        recordFailure(sourceName, err?.message || "Unknown error");
        logger.warn("OEM source failed", {
          source: sourceName,
          error: err?.message
        });
        return [];
      }
    })
  );

  results.forEach((arr: OEMCandidate[]) => allCandidates.push(...arr));

  // Smart Reverse Lookup (High Quality Hint)
  try {
    const aftermarketCandidates = await resolveAftermarketToOEM(req);
    if (aftermarketCandidates.length > 0) {
      allCandidates.push(...aftermarketCandidates);
    }
  } catch (err: any) {
    logger.warn("Aftermarket reverse lookup failed", { error: err?.message });
  }

  // REMOVED: oemWebFinder duplicate call
  // oemWebFinder is already called via webScrapeSource (line 25)
  // Having it twice inflates Multi-Source confidence incorrectly

  // 🛡️ P0: Remove known aftermarket numbers BEFORE consensus
  const aftermarketFiltered = filterAftermarketCandidates(allCandidates);

  // AI-Filter for semantic match (Part Description vs OEM)
  const filtered = await filterByPartMatch(aftermarketFiltered, req);

  const merged = mergeCandidates(filtered);

  // BRAND-SPECIFIC SCHEMA FILTER (The Firewall) — S7 FIX: Uses brandPatternRegistry
  const brand = req.vehicle.make?.toUpperCase() || "";
  const schemaFiltered = merged.filter(c => {
    // Allow if it's explicitly from a high-trust source
    if (c.source.includes("aftermarket_reverse_lookup")) return true;

    // Use the consolidated brand pattern registry
    const patternScore = validateOemPatternInt(c.oem, brand);
    if (patternScore > 0) return true;

    // Default fallback: Length 5-14, has a digit
    return c.oem.length >= 5 && c.oem.length <= 14 && /\d/.test(c.oem);
  });

  // Vehicle matching boost
  for (const c of schemaFiltered) {
    const meta = c.meta || {};
    const yearMatch = meta.year && req.vehicle.year && meta.year === req.vehicle.year;
    const kwMatch = meta.kw && req.vehicle.kw && meta.kw === req.vehicle.kw;
    if (yearMatch) c.confidence = clampConfidence(c.confidence + 0.05);
    if (kwMatch) c.confidence = clampConfidence(c.confidence + 0.05);
  }

  // Sort by (SchemaMatchScore DESC, Confidence DESC)
  const sorted = schemaFiltered.sort((a, b) => {
    const scoreA = checkBrandSchema(a.oem, brand);
    const scoreB = checkBrandSchema(b.oem, brand);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return b.confidence - a.confidence;
  });

  // Variables for final result
  let primaryOEM: string | undefined;
  let overall = 0;
  let note = "";

  // P0: Limit to max 3 candidates (was 10) with 15s global timeout
  const MAX_VALIDATION_CANDIDATES = 3;
  const VALIDATION_TIMEOUT_MS = 15000;
  const topCandidates = sorted.slice(0, MAX_VALIDATION_CANDIDATES);
  let bestResult: { oem?: string, confidence: number, note: string } = { confidence: 0, note: "" };

  // If no candidates, fall through
  if (topCandidates.length === 0) {
    primaryOEM = undefined;
    overall = 0;
    note = "Keine Kandidaten.";
  } else {
    // P0 Early Exit: If consensus has 3+ sources AND >90% confidence, validate only 1 candidate
    const consensus = calculateConsensus(filtered);
    const earlyExitMode = consensus.sourceCount >= 3 && consensus.confidence >= 0.90;
    const candidatesToValidate = earlyExitMode ? topCandidates.slice(0, 1) : topCandidates;

    if (earlyExitMode) {
      logger.info('[OEMResolver] High-confidence early exit: validating only top candidate', {
        sourceCount: consensus.sourceCount,
        confidence: consensus.confidence,
        oem: candidatesToValidate[0]?.oem
      });
    }

    // Wrap the entire validation loop in a global timeout
    const validationPromise = (async () => {
      for (const candidate of candidatesToValidate) {
        let currentConf = candidate.confidence;
        let currentNote = "";

        // MANDATORY BACKSEARCH for Validation
        try {
          const confirm = await backsearchOEM(candidate.oem, req);

          // Map to enhanced validation format
          const backsearchResult = {
            ...confirm,
            totalHits: Object.values(confirm).filter(v => v === true).length
          };

          // Enhanced Validation (AI layer controlled by feature flag)
          const validation = await performEnhancedValidation(
            candidate.oem,
            aftermarketFiltered,
            req.vehicle.make || "",
            req.vehicle.model || "",
            req.partQuery.rawText,
            backsearchResult,
            {
              enableAIVerification: !!process.env.OPENAI_API_KEY,
              openaiApiKey: process.env.OPENAI_API_KEY,
              minConfidence: 0.97
            }
          );

          currentConf = validation.finalConfidence;
          currentNote = validation.reasoning;

          // Update candidate confidence in list
          candidate.confidence = currentConf;
          candidate.meta = { ...(candidate.meta || {}), validationNote: currentNote, validationLayers: validation.layers };

          // Check if we found a winner or a better result
          if (currentConf > bestResult.confidence) {
            bestResult = { oem: candidate.oem, confidence: currentConf, note: currentNote };
          }

          // Early exit if we have found a vetted Primary
          if (validation.validated) {
            break;
          }
        } catch (err: any) {
          logger.warn("OEM validation flow failed", { oem: candidate.oem, error: err?.message });
          currentConf *= 0.5;
          currentNote = "Fehler bei der Validierung.";
        }
      }
    })();

    // P0: Global 15s timeout for the entire validation loop
    try {
      await Promise.race([
        validationPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Validation timeout')), VALIDATION_TIMEOUT_MS)
        )
      ]);
    } catch (err: any) {
      if (err.message === 'Validation timeout') {
        logger.warn('[OEMResolver] Validation timed out after 15s, using best result so far', {
          bestOem: bestResult.oem,
          bestConfidence: bestResult.confidence
        });
      }
    }

    primaryOEM = bestResult.confidence >= CONFIDENCE_THRESHOLD_RELIABLE ? bestResult.oem : undefined; // K2 FIX: was hardcoded 0.85
    overall = bestResult.confidence;
    note = bestResult.note || "Keine ausreichende Validierung aller Kandidaten.";
  }

  // P0: Track OEM resolution success/failure for alerting
  trackOemResolutionResult(!!primaryOEM);

  // M6: Record metrics for dashboard
  recordOemResolution({
    brand: req.vehicle.make || 'UNKNOWN',
    success: !!primaryOEM,
    confidence: overall,
    latencyMs: Date.now() - (req as any)._startTime || 0,
    sources: merged.map(c => c.source.split('+')[0]),
  });

  return {
    primaryOEM,
    candidates: merged,
    overallConfidence: overall,
    notes: note
  };
}

/**
 * Assigns a score (0-2) based on how well the OEM matches the brand's typical pattern.
 * Delegates to the consolidated brandPatternRegistry.
 */
function checkBrandSchema(oem: string, brand: string): number {
  return validateOemPatternInt(oem, brand);
}
