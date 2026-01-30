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


// PRODUCTION SOURCES ONLY - Fake/empty sources removed to prevent
// Multi-Source confidence inflation
const SOURCES = [
  // 🏆 ENTERPRISE DATABASE (instant, highest priority)
  databaseSource,            // SQLite database - 0ms response, 0.95+ confidence
  // PREMIUM CATALOG SOURCES (brand-specific, high accuracy)
  realOemSource,          // BMW OEM catalog (RealOEM.com)
  mercedesEpcSource,      // Mercedes EPC catalog
  vagEtkaSource,          // VAG ETKA catalog (VW/Audi/Skoda/Seat)
  // GENERAL WEB SCRAPERS
  webScrapeSource,        // Integrates oemWebFinder with 8 web scrapers
  llmHeuristicSource,     // GPT-based OEM inference
  motointegratorSource,   // Direct web scraper
  autodocWebSource,       // Direct Autodoc scraper
  sepZapWebSource,        // 7zap scraper
  kfzteile24Source,       // German platform (schema-fixed)
  pkwteileSource,         // German platform (schema-fixed)
  openaiVisionSource,     // AI-powered extraction (schema-fixed)
  oscaroSource            // French platform (schema-fixed)
];

const CONFIDENCE_THRESHOLD_VETTED = 0.90; // Lowered from 96% - was unreachable in practice
const CONFIDENCE_THRESHOLD_RELIABLE = 0.75; // Lowered from 85% - allow more matches with dealer review

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
    note: "Trefferquote unter Schwellenwert (<85%). Eskalation an Experten.",
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
  // Standard Scraper Sources
  // =========================================================================
  const results = await Promise.all(
    SOURCES.map(async (source) => {
      try {
        const res = await source.resolveCandidates(req);
        return res;
      } catch (err: any) {
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
  } catch (e) { /* ignore */ }

  // REMOVED: oemWebFinder duplicate call
  // oemWebFinder is already called via webScrapeSource (line 25)
  // Having it twice inflates Multi-Source confidence incorrectly

  // AI-Filter for semantic match (Part Description vs OEM)
  const filtered = await filterByPartMatch(allCandidates, req);

  const merged = mergeCandidates(filtered);

  // BRAND-SPECIFIC SCHEMA FILTER (The Firewall)
  // Eliminate junk that doesn't look like an OEM for this brand.
  const brand = req.vehicle.make?.toUpperCase() || "";
  const schemaFiltered = merged.filter(c => {
    // Allow if it's explicitly from a high-trust source (like our reverse lookup)
    if (c.source.includes("aftermarket_reverse_lookup")) return true;

    const oem = c.oem;

    // VAG Group (VW, Audi, Seat, Skoda)
    if (["VOLKSWAGEN", "AUDI", "SEAT", "SKODA", "VW"].some(b => brand.includes(b))) {
      // VAG OEMs are typically 9-11 alphanumeric (e.g. 1K0698151A)
      // We strictly limit length to avoid CSS artifacts.
      return oem.length >= 7 && oem.length <= 12 && /\d/.test(oem);
    }

    // BMW
    if (brand.includes("BMW")) {
      // BMW uses 11 digit (mostly numeric) or 7 digit (short) codes
      // Example: 64 31 9 142 115 (11 digits)
      const digits = oem.replace(/\D/g, "");
      return digits.length === 7 || digits.length === 11 || (oem.length >= 7 && oem.length <= 11);
    }

    // Mercedes
    if (brand.includes("MERCEDES") || brand.includes("BENZ")) {
      // A 000 421 ... often starts with A
      // Standard is roughly 10-12 chars.
      return (oem.startsWith("A") || (oem.length >= 10)) && oem.length <= 13 && /\d/.test(oem);
    }

    // Default: Length 5-14, has number
    return oem.length >= 5 && oem.length <= 14 && /\d/.test(oem);
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

  // Try to validate the top 10 candidates to find the best reliable one
  const topCandidates = sorted.slice(0, 10);
  let bestResult: { oem?: string, confidence: number, note: string } = { confidence: 0, note: "" };

  // If no candidates, fall through
  if (topCandidates.length === 0) {
    primaryOEM = undefined;
    overall = 0;
    note = "Keine Kandidaten.";
  } else {
    for (const candidate of topCandidates) {
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

        // NEW: Enhanced 5-Layer Validation
        const validation = await performEnhancedValidation(
          candidate.oem,
          allCandidates,
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

        // Early exit if we have found a vetted Primary (97%+)
        if (validation.validated) {
          break;
        }
      } catch (err: any) {
        logger.warn("OEM validation flow failed", { oem: candidate.oem, error: err?.message });
        currentConf *= 0.5;
        currentNote = "Fehler bei der Validierung.";
      }
    }

    primaryOEM = bestResult.confidence >= 0.85 ? bestResult.oem : undefined; // Lowered from 97% - now matches with dealer review
    overall = bestResult.confidence;
    note = bestResult.note || "Keine ausreichende Validierung aller Kandidaten.";
  }

  return {
    primaryOEM,
    candidates: merged,
    overallConfidence: overall,
    notes: note
  };
}

/**
 * Assigns a score (0-2) based on how well the OEM matches the brand's typical pattern.
 * Used for sorting candidates.
 */
function checkBrandSchema(oem: string, brand: string): number {
  if (!oem || !brand) return 0;
  oem = oem.replace(/\s+/g, "").toUpperCase();
  brand = brand.toUpperCase();

  // VAG (VW, Audi, Seat, Skoda)
  if (["VOLKSWAGEN", "AUDI", "SEAT", "SKODA", "VW"].some(b => brand.includes(b))) {
    // Pattern: 3 chars + 3 numbers + 3 numbers + (opt A) -> e.g. 1K0698151A
    if (/^[A-Z0-9]{3}[0-9]{3}[A-Z0-9]{3,6}$/.test(oem)) return 2;
    if (oem.length >= 9 && oem.length <= 12) return 1;
  }

  // BMW / Mini
  if (brand.includes("BMW") || brand.includes("MINI")) {
    const digits = oem.replace(/\D/g, "");
    if (digits.length === 11 || digits.length === 7) return 2;
    if (oem.length >= 7 && oem.length <= 11) return 1;
  }

  // Mercedes / Smart
  if (brand.includes("MERCEDES") || brand.includes("BENZ") || brand.includes("SMART")) {
    // Starts with A, B, W, N ... or just digits
    if (oem.startsWith("A") && oem.length >= 10 && oem.length <= 13) return 2;
    if (/^[0-9]{10,12}$/.test(oem)) return 2;
    if (oem.length >= 10 && oem.length <= 13) return 1;
  }

  // Additional brands
  // HONDA – typically 8‑digit numeric or alphanumeric like "1234‑AB12"
  if (brand.includes("HONDA")) {
    if (/^[0-9]{8}$/.test(oem)) return 2;
    if (/^[0-9]{4}-[A-Z0-9]{4}$/.test(oem)) return 2;
    if (oem.length >= 7 && oem.length <= 12) return 1;
  }

  // SUBARU – often 7‑8 digit numeric, sometimes with leading "S"
  if (brand.includes("SUBARU")) {
    if (/^S?[0-9]{7,8}$/.test(oem)) return 2;
    if (oem.length >= 7 && oem.length <= 12) return 1;
  }

  // MITSUBISHI – 7‑9 digit numeric, sometimes prefixed with "M"
  if (brand.includes("MITSUBISHI")) {
    if (/^M?[0-9]{7,9}$/.test(oem)) return 2;
    if (oem.length >= 7 && oem.length <= 12) return 1;
  }

  // PORSCHE – 7‑10 alphanumeric, often starts with "P" or numeric block
  if (brand.includes("PORSCHE")) {
    if (/^[Pp][0-9]{6,9}$/.test(oem)) return 2;
    if (/^[A-Z0-9]{7,10}$/.test(oem)) return 2;
    if (oem.length >= 7 && oem.length <= 12) return 1;
  }

  // DODGE / RAM – 7‑8 digit numeric or pattern like "8V21‑1125‑AB"
  if (brand.includes("DODGE") || brand.includes("RAM")) {
    if (/^[0-9]{7,8}$/.test(oem)) return 2;
    if (/^[A-Z0-9]{4}-[A-Z0-9]{4,6}-[A-Z]{1,2}$/.test(oem)) return 2;
    if (oem.length >= 7 && oem.length <= 15) return 1;
  }

  // CHEVROLET / GM (already covered under Opel/GM but add explicit)
  if (brand.includes("CHEVROLET")) {
    if (/^[0-9]{7,8}$/.test(oem)) return 2;
    if (oem.length >= 7 && oem.length <= 12) return 1;
  }

  // FORD
  if (brand.includes("FORD")) {
    // Ford has 7-digit FINIS (e.g. 1234567) or Engineering (e.g. 6G91-2M008-AA)
    if (/^[0-9]{7}$/.test(oem)) return 2; // FINIS
    if (/^[A-Z0-9]{4}-[A-Z0-9]{4,6}-[A-Z]{1,2}$/.test(oem)) return 2; // Engineering
    if (oem.length >= 7 && oem.length <= 15) return 1;
  }

  // OPEL / GM
  if (brand.includes("OPEL") || brand.includes("VAUXHALL") || brand.includes("CHEVROLET")) {
    // Opel uses 7-digit catalog or 8-digit GM numbers
    if (/^[0-9]{7,8}$/.test(oem)) return 2;
    if (oem.length >= 6 && oem.length <= 10) return 1;
  }

  // RENAULT / DACIA / NISSAN
  if (brand.includes("RENAULT") || brand.includes("DACIA") || brand.includes("NISSAN")) {
    // Often 10 digits or 5+5 alphanumeric (Nissan)
    if (/^[0-9R]{10}$/.test(oem)) return 2; // Renault
    if (/^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(oem)) return 2; // Nissan
    if (oem.length >= 8 && oem.length <= 12) return 1;
  }

  // FIAT / ALFA / LANCIA
  if (brand.includes("FIAT") || brand.includes("ALFA") || brand.includes("LANCIA") || brand.includes("CHRYSLER")) {
    // Often 8 digits
    if (/^[0-9]{8}$/.test(oem)) return 2;
    if (oem.length >= 7 && oem.length <= 10) return 1;
  }

  // TOYOTA / LEXUS
  if (brand.includes("TOYOTA") || brand.includes("LEXUS")) {
    // Pattern: 5 + 5 digits (e.g. 12345-12345)
    if (/^[0-9]{5}-[0-9]{5}$/.test(oem.replace(/\s/g, ""))) return 2;
    if (/^[0-9]{10}$/.test(oem)) return 2;
    if (oem.length >= 9 && oem.length <= 12) return 1;
  }

  // HYUNDAI / KIA
  if (brand.includes("HYUNDAI") || brand.includes("KIA")) {
    // Pattern: 5 + 5 alphanumeric
    if (/^[A-Z0-9]{5}[A-Z0-9]{5}$/.test(oem)) return 2;
    if (oem.length >= 9 && oem.length <= 12) return 1;
  }

  // PSA (PEUGEOT / CITROEN)
  if (brand.includes("PEUGEOT") || brand.includes("CITROEN") || brand.includes("PSA")) {
    // Often 10 digits or 4+6 format
    if (/^[0-9]{10}$/.test(oem)) return 2;
    if (/^[A-Z0-9]{4}\.[A-Z0-9]{6}$/.test(oem)) return 2;
    if (oem.length >= 4 && oem.length <= 12) return 1;
  }

  return 0;
}
