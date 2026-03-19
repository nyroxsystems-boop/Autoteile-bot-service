/**
 * 💾 DATABASE LAYER — v2 OEM Intelligence Engine
 *
 * Optimized SQLite lookup using the existing oem-data/oem-database.sqlite.
 * Provides instant (<10ms) lookups for previously resolved OEMs.
 *
 * Strategy:
 * 1. Exact brand + normalized category + model fuzzy match
 * 2. FTS search on part description
 * 3. Supersession chain resolution
 * 4. Hit-count tracking (for self-learning confidence growth)
 */

import { OEMResolverRequest, OEMCandidate } from '../types';
import { oemDatabase } from '../oemDatabase';
import { validateOemPattern } from '../brandPatternRegistry';
import { logger } from '@utils/logger';

// ============================================================================
// Constants
// ============================================================================

/** DB hit with this confidence or higher → skip AI search entirely */
export const DB_SKIP_AI_THRESHOLD = 0.93;

/** Minimum DB confidence to include as candidate */
const DB_MIN_CONFIDENCE = 0.50;

// ============================================================================
// Part Category Detection
// ============================================================================

const CATEGORY_PATTERNS: Array<{ category: string; patterns: RegExp }> = [
  { category: 'brake', patterns: /brems|brake|scheibe|disc|belag|pad|sattel|caliper/i },
  { category: 'filter', patterns: /filter|öl|oil|luft|air|kraftstoff|fuel|pollen|cabin|innenraum/i },
  { category: 'suspension', patterns: /fahrwerk|suspension|stoßdämpfer|shock|feder|spring|querlenker|traggelenk|koppelstange/i },
  { category: 'cooling', patterns: /kühl|cool|wasser|water|thermostat|radiator|wasserpumpe/i },
  { category: 'engine', patterns: /motor|engine|zylinder|kolben|zahnriemen|timing|turbo|zündkerze|spark/i },
  { category: 'exhaust', patterns: /auspuff|exhaust|kat|catalyst|dpf|lambda/i },
  { category: 'clutch', patterns: /kupplung|clutch/i },
  { category: 'steering', patterns: /lenkung|steering|spurstange|tie.?rod/i },
  { category: 'electrical', patterns: /elektr|batterie|licht|light|sensor|steuer/i },
  { category: 'transmission', patterns: /getriebe|transmission|gear/i },
];

export function detectCategory(partText: string): string {
  const lower = partText.toLowerCase();
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.test(lower)) return category;
  }
  return 'other';
}

// ============================================================================
// Main Lookup
// ============================================================================

export interface DbLookupResult {
  candidates: OEMCandidate[];
  /** Whether a high-confidence hit was found (AI search can be skipped) */
  highConfidenceHit: boolean;
  /** Best candidate from DB */
  topCandidate?: OEMCandidate;
}

/**
 * Look up OEM candidates from the local SQLite database.
 * Returns candidates sorted by confidence.
 */
export function lookupFromDatabase(req: OEMResolverRequest): DbLookupResult {
  const startTime = Date.now();
  const brand = req.vehicle.make?.toUpperCase() || '';
  const model = req.vehicle.model || '';
  const partText = req.partQuery.rawText;
  const category = req.partQuery.partCategory || detectCategory(partText);
  const year = req.vehicle.year;

  const candidates: OEMCandidate[] = [];

  try {
    // Strategy 1: Structured lookup (brand + category + model)
    const structuredResults = oemDatabase.lookup({
      brand: brand || undefined,
      model: model || undefined,
      category: category !== 'other' ? category : undefined,
      year,
      limit: 10,
    });

    for (const result of structuredResults) {
      // Validate pattern match
      const patternScore = validateOemPattern(result.oem, brand);

      // Resolve supersessions
      const currentOem = oemDatabase.resolveSupersession(result.oem);
      const wasSuperseded = currentOem !== result.oem.toUpperCase();

      const confidence = Math.min(
        result.confidence * (patternScore >= 0.9 ? 1.0 : 0.8),
        0.99,
      );

      candidates.push({
        oem: currentOem,
        brand: brand || undefined,
        source: 'v2_database',
        confidence,
        meta: {
          description: result.description,
          superseded: wasSuperseded,
          originalOem: wasSuperseded ? result.oem : undefined,
          patternScore,
          dbSource: true,
        },
      });
    }

    // Strategy 2: FTS search (if structured gave few results)
    if (candidates.length < 3 && partText.length >= 3) {
      try {
        // Build FTS query from meaningful words
        const ftsQuery = buildFtsQuery(partText, brand, model);
        if (ftsQuery) {
          const ftsResults = oemDatabase.search(ftsQuery, 5);
          for (const result of ftsResults) {
            // Avoid duplicates
            if (candidates.some(c => c.oem === result.oem.toUpperCase())) continue;

            const currentOem = oemDatabase.resolveSupersession(result.oem);
            const patternScore = validateOemPattern(currentOem, brand);

            // FTS results get slightly lower confidence than structured
            const confidence = Math.min(
              result.confidence * 0.9 * (patternScore >= 0.9 ? 1.0 : 0.7),
              0.95,
            );

            if (confidence >= DB_MIN_CONFIDENCE) {
              candidates.push({
                oem: currentOem,
                brand: brand || undefined,
                source: 'v2_database_fts',
                confidence,
                meta: {
                  description: result.description,
                  patternScore,
                  dbSource: true,
                },
              });
            }
          }
        }
      } catch (err) {
        logger.debug('[v2 DB] FTS query failed (non-critical)', { error: err });
      }
    }

    // Sort by confidence descending
    candidates.sort((a, b) => b.confidence - a.confidence);

    // Filter below minimum
    const filtered = candidates.filter(c => c.confidence >= DB_MIN_CONFIDENCE);

    const topCandidate = filtered[0];
    const highConfidenceHit = !!topCandidate && topCandidate.confidence >= DB_SKIP_AI_THRESHOLD;

    const elapsed = Date.now() - startTime;
    logger.info('[v2 DB] Lookup complete', {
      brand,
      model,
      category,
      resultCount: filtered.length,
      topOem: topCandidate?.oem,
      topConf: topCandidate?.confidence,
      highConfidenceHit,
      elapsed,
    });

    return {
      candidates: filtered.slice(0, 5), // Max 5 from DB
      highConfidenceHit,
      topCandidate: highConfidenceHit ? topCandidate : undefined,
    };

  } catch (err: any) {
    logger.warn('[v2 DB] Lookup failed', { error: err?.message });
    return { candidates: [], highConfidenceHit: false };
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build an FTS5 query from natural language.
 * Extracts meaningful words and combines with brand/model.
 */
function buildFtsQuery(partText: string, brand: string, model: string): string | null {
  const stopWords = new Set([
    'für', 'für', 'von', 'am', 'an', 'der', 'die', 'das', 'ein', 'eine',
    'und', 'oder', 'mit', 'bei', 'zum', 'zur', 'vom', 'im', 'ins',
    'for', 'the', 'and', 'with', 'from', 'in', 'on', 'at',
    'bitte', 'brauche', 'suche', 'benötige', 'need', 'want',
    'mein', 'meinem', 'meinen', 'meiner',
  ]);

  const words = partText
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w));

  if (words.length === 0) return null;

  // Combine with brand for better specificity
  const queryParts = [];
  if (brand) queryParts.push(brand.toLowerCase());
  if (model) queryParts.push(model.toLowerCase().split(/\s+/)[0]);
  queryParts.push(...words.slice(0, 3)); // Max 3 part words

  return queryParts.join(' ');
}
