/**
 * 🧠 LEARNER — v2 OEM Intelligence Engine
 *
 * Self-learning module that saves validated OEM resolutions to the database.
 * Every successful resolution makes the system smarter.
 *
 * Confidence Growth Curve:
 *   1st hit: saved with 0.80
 *   2nd hit: grows to 0.85 (via upsert MAX)
 *   3rd hit: 0.88
 *   5th hit: 0.93+ → becomes instant DB lookup
 *   Dealer confirmed: 0.99 → highest trust
 *
 * Guards:
 *   - Only learns from results with confidence ≥ 0.75
 *   - Must pass brand pattern validation
 *   - Never saves known aftermarket numbers
 *   - Fire-and-forget: errors never affect the main flow
 */

import { OEMResolverRequest, OEMCandidate } from '../types';
import { oemDatabase } from '../oemDatabase';
import { validateOemPattern } from '../brandPatternRegistry';
import { isAftermarketNumber } from '../aftermarketFilter';
import { logger } from '@utils/logger';
import { detectCategory } from './databaseLayer';

// ============================================================================
// Constants
// ============================================================================

const MIN_LEARN_CONFIDENCE = 0.75;
const MAX_INITIAL_CONFIDENCE = 0.90;

// ============================================================================
// Auto-Learn from Resolution
// ============================================================================

/**
 * Save a validated OEM to the database for future instant lookups.
 * Non-blocking: runs async, never throws.
 */
export function learnOem(
  oem: string,
  confidence: number,
  resolvedBy: string,
  req: OEMResolverRequest,
): void {
  // Fire-and-forget
  (async () => {
    try {
      // Guard 1: Minimum confidence
      if (confidence < MIN_LEARN_CONFIDENCE) return;

      // Guard 2: Must have a brand
      const brand = req.vehicle.make?.toUpperCase();
      if (!brand) return;

      // Guard 3: Pattern validation
      const patternScore = validateOemPattern(oem, brand);
      if (patternScore <= 0) return;

      // Guard 4: Not aftermarket
      if (isAftermarketNumber(oem)) return;

      const category = req.partQuery.partCategory || detectCategory(req.partQuery.rawText);
      const learningConf = Math.min(confidence, MAX_INITIAL_CONFIDENCE);

      oemDatabase.upsert({
        oem,
        brand,
        model: req.vehicle.model || undefined,
        modelCode: undefined,
        yearFrom: req.vehicle.year || undefined,
        yearTo: req.vehicle.year || undefined,
        partCategory: category,
        partDescription: req.partQuery.rawText,
        sources: [resolvedBy],
        confidence: learningConf,
        lastVerified: new Date().toISOString(),
        hitCount: 1,
      });

      logger.info('[v2 Learn] 🧠 Saved OEM to database', {
        oem,
        brand,
        model: req.vehicle.model,
        category,
        confidence: learningConf,
        source: resolvedBy,
      });

    } catch (err: any) {
      logger.warn('[v2 Learn] Failed (non-critical)', { error: err?.message });
    }
  })();
}

// ============================================================================
// Dealer Feedback
// ============================================================================

/**
 * Dealer confirms an OEM is correct.
 * Saves with 0.99 confidence (highest trust level).
 */
export function dealerConfirmOem(params: {
  oem: string;
  brand: string;
  model?: string;
  partDescription: string;
  year?: number;
  dealerId?: string;
}): void {
  try {
    const category = detectCategory(params.partDescription);

    oemDatabase.upsert({
      oem: params.oem,
      brand: params.brand.toUpperCase(),
      model: params.model,
      partCategory: category,
      partDescription: params.partDescription,
      sources: ['dealer-verified', ...(params.dealerId ? [`dealer:${params.dealerId}`] : [])],
      confidence: 0.99,
      lastVerified: new Date().toISOString(),
      hitCount: 1,
    });

    logger.info('[v2 Learn] ✅ Dealer confirmed OEM', {
      oem: params.oem,
      brand: params.brand,
      dealerId: params.dealerId,
    });
  } catch (err: any) {
    logger.warn('[v2 Learn] Dealer confirm failed', { error: err?.message });
  }
}

/**
 * Dealer corrects a wrong OEM.
 * Saves the correct one with 0.99 and registers supersession.
 */
export function dealerCorrectOem(params: {
  wrongOem: string;
  correctOem: string;
  brand: string;
  model?: string;
  partDescription: string;
  year?: number;
  dealerId?: string;
}): void {
  try {
    const category = detectCategory(params.partDescription);

    // Save correct OEM
    oemDatabase.upsert({
      oem: params.correctOem,
      brand: params.brand.toUpperCase(),
      model: params.model,
      partCategory: category,
      partDescription: params.partDescription,
      sources: ['dealer-corrected', ...(params.dealerId ? [`dealer:${params.dealerId}`] : [])],
      confidence: 0.99,
      lastVerified: new Date().toISOString(),
      hitCount: 1,
    });

    // Register supersession: wrong → correct
    oemDatabase.registerSupersession(
      params.wrongOem,
      params.correctOem,
      params.brand.toUpperCase(),
      `dealer-correction${params.dealerId ? `:${params.dealerId}` : ''}`,
    );

    logger.info('[v2 Learn] 🔄 Dealer corrected OEM', {
      wrongOem: params.wrongOem,
      correctOem: params.correctOem,
      brand: params.brand,
    });
  } catch (err: any) {
    logger.warn('[v2 Learn] Dealer correction failed', { error: err?.message });
  }
}
