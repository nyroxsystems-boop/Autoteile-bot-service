import { OEMResolverRequest, OEMResolverResult, OEMCandidate } from "./types";
import { logger } from "@utils/logger";
// REMOVED: cacheSource - always returns empty []
// REMOVED: shopSearchSource - placeholder, always returns []
import { webScrapeSource } from "./sources/webScrapeSource";
import { llmHeuristicSource } from "./sources/llmHeuristicSource";
import { filterByPartMatch, resolveAftermarketToOEM } from "./sources/partMatchHelper";
import { clampConfidence } from "./sources/baseSource";
import { detectVariants } from './variantDetector';
import { backsearchOEM } from "./backsearch";
// REMOVED: motointegratorSource - 35 lines, 0.6 flat conf, zero value
// REMOVED: autodocSource - fake wrapper for webScrapeSource
import { autodocWebSource } from "./sources/autodocWebSource";
// DELETED: sepZapWebSource - copy-paste duplicate, 7zap covered by vagEtkaSource
// PRODUCTION SOURCES (Schema-Fixed)
import { kfzteile24Source } from "./sources/kfzteile24Source";
import { oscaroSource } from "./sources/oscaroSource";
import { pkwteileSource } from "./sources/pkwteileSource";
// RE-ENABLED: openaiVisionSource - now OCR pipeline (only runs with image data)
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
// REMOVED: tecDocCrossRefSource - fake API endpoints, static 25-entry DB
// 🛡️ P0: Aftermarket filter — removes known aftermarket numbers before consensus
import { filterAftermarketCandidates } from './aftermarketFilter';
import { validateOemPatternInt } from './brandPatternRegistry';
import { filterSourcesByMode, reportSourceHealth } from './scraperFallback';
import { recordOemResolution } from './oemMetrics';
// 🚨 P0: Alert tracking for OEM resolution failures
import { trackOemResolutionResult } from "@core/alertService";
import { learnFromResolution } from "./oemLearner";
// NEW: Google Search + eBay OEM Mining (10/10 super-sources)
import { googleSearchSource } from "./sources/googleSearchSource";
import { ebayOemSource } from "./sources/ebayOemSource";
// 🆓 FREE FALLBACK: Direct fetch when ScraperAPI down/exhausted
import { directFetchSource } from "./sources/directFetchSource";
// 📊 ACCURACY: Real measurement instead of guessing
import { trackResolution } from "./accuracyTracker";
// 🏆 TECDOC: Industry-standard cross-reference database (optional, needs RapidAPI key)
import { tecDocSource } from "./sources/tecDocSource";
// 🌐 GEMINI GROUNDED: AI with live Google Search — 0 extra cost, replaces ScraperAPI
import { geminiGroundedOemSource } from "./sources/geminiGroundedOemSource";


// PRODUCTION SOURCES ONLY - Fake/empty sources removed to prevent
// Multi-Source confidence inflation
const SOURCES = [
  // 🏆 ENTERPRISE DATABASE (instant, highest priority)
  databaseSource,            // SQLite database - 0ms response, 0.95+ confidence
  // 🌐 GEMINI GROUNDED (AI + live Google Search — PRIMARY SOURCE for 96% accuracy)
  geminiGroundedOemSource,   // Gemini searches web during inference, 0 extra API cost
  // 🏆 TECDOC (optional, needs TECDOC_RAPIDAPI_KEY)
  tecDocSource,              // TecDoc Catalog API via RapidAPI (optional)
  // PREMIUM CATALOG SOURCES (brand-specific, high accuracy)
  realOemSource,          // BMW OEM catalog (RealOEM.com)
  mercedesEpcSource,      // Mercedes EPC catalog
  vagEtkaSource,          // VAG ETKA catalog (VW/Audi/Skoda/Seat)
  // GENERAL WEB SCRAPERS
  webScrapeSource,        // Integrates oemWebFinder with 8 web scrapers
  googleSearchSource,     // 🔍 Google as super-scraper (1 API call = all shops)
  ebayOemSource,          // 🛒 eBay structured OEM/Vergleichsnummer extraction
  llmHeuristicSource,     // AI OEM inference (Triple-Lock cross-validation)
  autodocWebSource,       // Direct Autodoc scraper
  kfzteile24Source,       // German platform
  pkwteileSource,         // German platform
  oscaroSource,           // French platform
  // 🆓 FREE FALLBACK (no ScraperAPI needed)
  directFetchSource,      // Direct fetch: daparto, autoteile-markt, teilehaber (0 credits)
  // 🔬 DOCUMENT OCR (only activates when image data present)
  openaiVisionSource,     // Fahrzeugschein + Part Label OCR via Gemini Vision
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
      // combine confidence: 1 - product of (1 - conf), but CAPPED to prevent inflation
      const combined = 1 - (1 - existing.confidence) * (1 - c.confidence);
      // CAP: merged confidence cannot exceed max single-source confidence + 0.15
      // This prevents 3 mediocre scraper results (0.60) from inflating to 0.94
      const maxSingleSource = Math.max(existing.confidence, c.confidence);
      existing.confidence = clampConfidence(Math.min(combined, maxSingleSource + 0.15));
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

// NOTE: pickPrimary() was dead code (never called). Removed in audit cleanup.

export async function resolveOEM(req: OEMResolverRequest): Promise<OEMResolverResult> {
  // #11 FIX: Set _startTime for latency metrics (was never set, always 0)
  (req as any)._startTime = Date.now();

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
  // 💰 EARLY-EXIT: If DB or TecDoc has high-confidence answer → skip scrapers
  // Saves 15-25 ScraperAPI credits per request
  // =========================================================================
  const highConfCandidates = allCandidates.filter(c => c.confidence >= 0.90);
  if (highConfCandidates.length > 0) {
    const topSource = highConfCandidates[0].source;
    logger.info('[OEM Resolver] 💰 EARLY-EXIT: High-confidence answer found, skipping scrapers', {
      topOem: highConfCandidates[0].oem,
      confidence: highConfCandidates[0].confidence,
      source: topSource,
      creditsSaved: '15-25',
    });
    // Skip directly to consensus with just DB/TecDoc + deep resolution candidates
    // Still runs aftermarket filter, consensus, validation, variant detection below
  } else {
    // =========================================================================
    // Standard Scraper Sources (with health monitoring)
    // =========================================================================
    const { isSourceDisabled, recordSuccess, recordFailure, getConfidenceWeight } = await import('./sourceHealthMonitor');

    // #6 FIX: Filter sources by current health mode (degraded → skip web scrapers)
    const activeSources = filterSourcesByMode(SOURCES as any[]);

    const results = await Promise.all(
      activeSources.map(async (source) => {
        const sourceName = (source as any).name || "unknown";

        // Skip disabled sources
        if (isSourceDisabled(sourceName)) {
          logger.debug("OEM source skipped (disabled)", { source: sourceName });
          return [];
        }

        try {
          const res = await source.resolveCandidates(req);
          recordSuccess(sourceName);
          // #14 FIX: Feed source health to scraperFallback strategy
          reportSourceHealth(sourceName, true);

          // Apply confidence weight based on source health
          const weight = getConfidenceWeight(sourceName);
          if (weight < 1.0) {
            res.forEach((c: any) => { c.confidence *= weight; });
          }

          return res;
        } catch (err: any) {
          recordFailure(sourceName, err?.message || "Unknown error");
          // #14 FIX: Feed source health to scraperFallback strategy
          reportSourceHealth(sourceName, false);
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
  } // end of early-exit else block

  // REMOVED: oemWebFinder duplicate call
  // oemWebFinder is already called via webScrapeSource (line 25)
  // Having it twice inflates Multi-Source confidence incorrectly

  // 🛡️ P0: Remove known aftermarket numbers BEFORE consensus
  const aftermarketFiltered = filterAftermarketCandidates(allCandidates);

  // =======================================================================
  // 🔄 SECOND PASS: Aftermarket → OEM Reverse Cascade
  // If no high-confidence OEM found, use aftermarket numbers as bridge
  // =======================================================================
  const hasHighConfidence = aftermarketFiltered.some(c => c.confidence >= 0.75);
  if (!hasHighConfidence && allCandidates.length > aftermarketFiltered.length) {
    // There were aftermarket numbers that got filtered — use them!
    try {
      const { reverseAftermarketToOem } = await import('./sources/aftermarketCrossRef');
      const removedAftermarket = allCandidates.filter(
        c => !aftermarketFiltered.includes(c) && c.oem.length >= 5
      );

      if (removedAftermarket.length > 0) {
        logger.info('[OEMResolver] 🔄 Triggering aftermarket reverse cascade', {
          aftermarketCount: removedAftermarket.length,
          topAftermarket: removedAftermarket[0]?.oem,
        });

        const reverseOems = await reverseAftermarketToOem(
          removedAftermarket,
          req.vehicle.make || '',
          req.vehicle.model || '',
        );

        if (reverseOems.length > 0) {
          aftermarketFiltered.push(...reverseOems);
          logger.info('[OEMResolver] 🔄 Reverse cascade found OEMs', {
            count: reverseOems.length,
            topOem: reverseOems[0]?.oem,
            topConf: reverseOems[0]?.confidence,
          });
        }
      }
    } catch (err: any) {
      logger.warn('[OEMResolver] Reverse cascade failed', { error: err?.message });
    }
  }

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

  // 🧠 SELF-LEARNING: Save validated OEM to database (non-blocking)
  if (primaryOEM && overall >= 0.70) {
    learnFromResolution(primaryOEM, overall, merged, req);
  }

  // M6: Record metrics for dashboard
  recordOemResolution({
    brand: req.vehicle.make || 'UNKNOWN',
    success: !!primaryOEM,
    confidence: overall,
    latencyMs: Date.now() - (req as any)._startTime || 0,
    sources: merged.map(c => c.source.split('+')[0]),
  });

  // 🔀 VARIANT DETECTION: Ask instead of guess
  const variantResult = detectVariants(merged, req);

  // 📊 ACCURACY TRACKING: Log every resolution for real accuracy measurement
  try {
    trackResolution({
      orderId: (req as any).orderId || 'unknown',
      brand: req.vehicle.make || 'UNKNOWN',
      model: req.vehicle.model || '',
      partQuery: req.partQuery.rawText,
      primaryOem: primaryOEM || null,
      confidence: overall,
      sourcesUsed: [...new Set(merged.map(c => c.source.split('+')[0]))],
      candidateCount: merged.length,
      durationMs: Date.now() - ((req as any)._startTime || Date.now()),
      variantDetected: variantResult.hasVariants,
      deepResolutionUsed: !!deepResolutionMetadata.vinDecoded || !!deepResolutionMetadata.prCodeUsed,
    });
  } catch (err: any) {
    logger.debug('[AccuracyTracker] Failed to track', { error: err?.message });
  }

  return {
    primaryOEM: variantResult.hasVariants ? undefined : primaryOEM,
    candidates: merged,
    overallConfidence: variantResult.hasVariants ? 0 : overall,
    notes: variantResult.hasVariants ? 'Mehrere Varianten erkannt — Kundenrückfrage erforderlich.' : note,
    variantDetected: variantResult.hasVariants,
    variants: variantResult.hasVariants ? variantResult.variants.map(v => ({
      oem: v.oem,
      description: v.description,
      differentiator: v.differentiator,
      confidence: v.confidence,
    })) : undefined,
    variantQuestion: variantResult.question,
  };
}

/**
 * Assigns a score (0-2) based on how well the OEM matches the brand's typical pattern.
 * Delegates to the consolidated brandPatternRegistry.
 */
function checkBrandSchema(oem: string, brand: string): number {
  return validateOemPatternInt(oem, brand);
}
