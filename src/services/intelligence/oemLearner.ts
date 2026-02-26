/**
 * 🧠 OEM SELF-LEARNING MODULE
 *
 * Automatically saves validated OEM resolutions back to the database.
 * Every successful OEM resolution makes the system smarter:
 * - First hit: saves with 0.80 confidence
 * - Repeated hits: confidence grows via upsert (hit_count + 1, MAX(confidence))
 * - After 5+ hits: becomes 0.95+ (enterprise-grade, instant lookup)
 *
 * Guards:
 * - Only saves OEMs that pass validation (≥0.70 confidence)
 * - Only saves OEMs with valid brand pattern match
 * - Never saves AI-only results (requires at least 1 web/DB source)
 * - Non-blocking: errors don't affect the resolution flow
 */

import { oemDatabase } from './oemDatabase';
import { OEMCandidate, OEMResolverRequest } from './types';
import { validateOemPattern } from './brandPatternRegistry';
import { logger } from '@utils/logger';

/** Minimum confidence required to learn from a resolution */
const MIN_LEARN_CONFIDENCE = 0.70;

/** Sources that are NOT sufficient on their own to learn from */
const UNRELIABLE_SOLO_SOURCES = new Set([
    'premium_ai_oem_resolver',
    'ai_inference_unverified',
    'Document-OCR',
]);

/**
 * Map a raw part query to a standardized category for DB storage.
 */
function inferCategory(partText: string): string {
    const q = partText.toLowerCase();
    if (/brems|brake|scheibe|disc|belag|pad|sattel|caliper/i.test(q)) return 'brake';
    if (/filter|öl|oil|luft|air|kraftstoff|fuel|pollen|cabin/i.test(q)) return 'filter';
    if (/fahrwerk|suspension|stoßdämpfer|shock|feder|spring|querlenker/i.test(q)) return 'suspension';
    if (/kühl|cool|wasser|water|thermostat|radiator/i.test(q)) return 'cooling';
    if (/motor|engine|zylinder|kolben|zahnriemen|timing|turbo/i.test(q)) return 'engine';
    if (/elektr|batterie|licht|light|sensor|steuer/i.test(q)) return 'electrical';
    if (/auspuff|exhaust|katalysator|catalyst|dpf/i.test(q)) return 'exhaust';
    if (/kupplung|clutch/i.test(q)) return 'clutch';
    if (/lenkung|steering|spurstange/i.test(q)) return 'steering';
    if (/getriebe|transmission|gear/i.test(q)) return 'transmission';
    return 'other';
}

/**
 * Learn from a successful OEM resolution.
 * Called non-blocking after the resolution completes.
 */
export function learnFromResolution(
    primaryOEM: string,
    confidence: number,
    candidates: OEMCandidate[],
    req: OEMResolverRequest
): void {
    // Run async but don't await — this is fire-and-forget
    (async () => {
        try {
            // Guard 1: Minimum confidence
            if (confidence < MIN_LEARN_CONFIDENCE) {
                logger.debug('[OEM Learner] Skipping — confidence too low', { oem: primaryOEM, confidence });
                return;
            }

            // Guard 2: Must have a brand
            const brand = req.vehicle.make?.toUpperCase();
            if (!brand) {
                logger.debug('[OEM Learner] Skipping — no brand');
                return;
            }

            // Guard 3: Brand pattern validation (returns 0-2 score)
            const patternScore = validateOemPattern(primaryOEM, brand);
            if (patternScore <= 0) {
                logger.debug('[OEM Learner] Skipping — fails brand pattern', { oem: primaryOEM, brand });
                return;
            }

            // Guard 4: Must come from at least one non-AI source
            const matchingCandidates = candidates.filter(c => c.oem === primaryOEM);
            const sources = matchingCandidates.map(c => c.source);
            const hasReliableSource = sources.some(s => {
                for (const unreliable of UNRELIABLE_SOLO_SOURCES) {
                    if (s.includes(unreliable)) return false;
                }
                return true;
            });

            if (!hasReliableSource) {
                logger.debug('[OEM Learner] Skipping — AI-only sources', { oem: primaryOEM, sources });
                return;
            }

            // Build the record
            const category = inferCategory(req.partQuery.rawText);
            const learningConfidence = Math.min(confidence, 0.90); // Cap initial learning conf

            oemDatabase.upsert({
                oem: primaryOEM,
                brand,
                model: req.vehicle.model || undefined,
                modelCode: undefined,  // Could be extracted from model in the future
                yearFrom: req.vehicle.year || undefined,
                yearTo: req.vehicle.year || undefined,
                partCategory: category,
                partDescription: req.partQuery.rawText,
                sources: [...new Set(sources)],
                confidence: learningConfidence,
                lastVerified: new Date().toISOString(),
                hitCount: 1,
            });

            logger.info('[OEM Learner] 🧠 Saved validated OEM to database', {
                oem: primaryOEM,
                brand,
                model: req.vehicle.model,
                category,
                confidence: learningConfidence,
                sources: [...new Set(sources)],
            });

        } catch (err: any) {
            // Non-blocking — log and continue
            logger.warn('[OEM Learner] Failed to save OEM', { error: err?.message });
        }
    })();
}

// ============================================================================
// DEALER-FEEDBACK-LOOP: Every dealer interaction = exponential improvement
// ============================================================================

/**
 * Dealer confirms OEM is correct.
 * Saves with 0.99 confidence (dealer-verified, highest trust level).
 */
export function confirmOem(params: {
    oem: string;
    brand: string;
    model?: string;
    partDescription: string;
    year?: number;
    dealerId?: string;
}): void {
    try {
        const category = inferCategory(params.partDescription);

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

        logger.info('[OEM Learner] ✅ Dealer confirmed OEM', {
            oem: params.oem,
            brand: params.brand,
            model: params.model,
            dealerId: params.dealerId,
        });
    } catch (err: any) {
        logger.warn('[OEM Learner] Failed to save dealer confirmation', { error: err?.message });
    }
}

/**
 * Dealer corrects a wrong OEM → saves the correct one and flags the wrong one.
 * The wrong OEM gets a supersession pointing to the correct one.
 */
export function correctOem(params: {
    wrongOem: string;
    correctOem: string;
    brand: string;
    model?: string;
    partDescription: string;
    year?: number;
    dealerId?: string;
}): void {
    try {
        const category = inferCategory(params.partDescription);

        // Save the correct OEM with highest confidence
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

        // Register the wrong→correct supersession
        oemDatabase.registerSupersession(
            params.wrongOem,
            params.correctOem,
            params.brand.toUpperCase(),
            `dealer-correction${params.dealerId ? `:${params.dealerId}` : ''}`
        );

        logger.info('[OEM Learner] 🔄 Dealer corrected OEM', {
            wrongOem: params.wrongOem,
            correctOem: params.correctOem,
            brand: params.brand,
            dealerId: params.dealerId,
        });
    } catch (err: any) {
        logger.warn('[OEM Learner] Failed to save dealer correction', { error: err?.message });
    }
}
