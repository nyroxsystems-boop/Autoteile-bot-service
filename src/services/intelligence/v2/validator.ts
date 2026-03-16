/**
 * ✅ VALIDATOR — v2 OEM Intelligence Engine
 *
 * Local-first validation with optional AI reverse-verify.
 * Replaces the old multi-layer validation + Claude adversary.
 *
 * Layer 1 (local, <1ms):
 *   - Brand pattern matching
 *   - Aftermarket detection
 *   - Confidence scoring from grounding quality
 *
 * Layer 2 (optional AI, 2-3s):
 *   - Reverse OEM verification via Gemini Grounded
 *   - Only triggered when confidence is in the "gray zone" (0.55-0.85)
 */

import { OEMCandidate, OEMResolverRequest } from '../types';
import { generateGroundedCompletion } from '../geminiService';
import { validateOemPattern } from '../brandPatternRegistry';
import { isAftermarketNumber } from '../aftermarketFilter';
import { logger } from '@utils/logger';
import { ReverseVerifyResult, ConfidenceBreakdown } from './types';

// ============================================================================
// Constants
// ============================================================================

/** Confidence range that triggers reverse verification */
const REVERSE_VERIFY_MIN = 0.55;
const REVERSE_VERIFY_MAX = 0.85;

/** Minimum final confidence to accept an OEM */
export const ACCEPT_THRESHOLD = 0.70;

/** Reverse verify timeout */
const REVERSE_TIMEOUT_MS = 8000;

// ============================================================================
// Local Validation
// ============================================================================

/**
 * Validate a candidate locally (no AI call).
 * Returns adjusted confidence and breakdown.
 */
export function validateLocally(
  candidate: OEMCandidate,
  brand: string,
): { confidence: number; breakdown: ConfidenceBreakdown; isValid: boolean } {
  const breakdown: ConfidenceBreakdown = {
    base: candidate.confidence,
    patternBonus: 0,
    groundingBonus: 0,
    trustedSourceBonus: 0,
    selfConfidenceBonus: 0,
    aftermarketPenalty: 0,
    reverseVerifyBonus: 0,
    final: candidate.confidence,
  };

  let conf = candidate.confidence;

  // 1. Aftermarket check — instant reject
  if (isAftermarketNumber(candidate.oem)) {
    breakdown.aftermarketPenalty = -1;
    breakdown.final = 0;
    return { confidence: 0, breakdown, isValid: false };
  }

  // 2. Brand pattern validation
  const patternScore = validateOemPattern(candidate.oem, brand);
  if (patternScore >= 0.9) {
    breakdown.patternBonus = 0.05;
    conf += 0.05;
  } else if (patternScore < 0.3) {
    breakdown.patternBonus = -0.15;
    conf -= 0.15;
  }

  // 3. Length sanity check
  const oemLen = candidate.oem.replace(/[-\s.]/g, '').length;
  if (oemLen < 5 || oemLen > 15) {
    conf -= 0.20;
  }

  // Clamp
  conf = Math.max(0, Math.min(0.99, conf));
  breakdown.final = conf;

  return {
    confidence: conf,
    breakdown,
    isValid: conf >= ACCEPT_THRESHOLD,
  };
}

// ============================================================================
// Reverse OEM Verification
// ============================================================================

/**
 * Reverse-verify an OEM by searching it and checking if the expected
 * vehicle + part appears in the results.
 *
 * This is the single most effective anti-hallucination measure.
 */
export async function reverseVerify(
  oem: string,
  req: OEMResolverRequest,
): Promise<ReverseVerifyResult> {
  const brand = req.vehicle.make || '';
  const model = req.vehicle.model || '';
  const part = req.partQuery.rawText;
  const startTime = Date.now();

  try {
    const prompt = `Suche die Teilenummer "${oem}" im Internet.

Finde heraus:
1. Für welches FAHRZEUG ist diese Teilenummer? (Marke, Modell, Baujahre)
2. Welches TEIL ist es? (Bremsscheibe, Ölfilter, Stoßdämpfer etc.)
3. Ist es eine echte OEM-Nummer oder eine Aftermarket-Nummer?

Antworte NUR als JSON:
{"vehicles":["Fahrzeug 1"],"part_type":"Art des Teils","is_oem":true/false,"brand":"Hersteller"}`;

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Reverse verify timeout')), REVERSE_TIMEOUT_MS)
    );

    const searchPromise = generateGroundedCompletion({
      prompt,
      systemInstruction: 'Suche die Teilenummer im Internet und identifiziere Fahrzeug und Teil. Antworte NUR als JSON.',
      temperature: 0.1,
    });

    const result = await Promise.race([searchPromise, timeoutPromise]);
    const elapsed = Date.now() - startTime;

    if (!result.text || !result.isGrounded) {
      return {
        verified: false,
        matchScore: 0.5,
        brandMatch: false,
        modelMatch: false,
        partMatch: false,
        confidenceAdjustment: 0,
        reason: 'Reverse search returned no grounded results — neutral.',
      };
    }

    // Parse response
    const parsed = parseReverseResponse(result.text);
    if (!parsed) {
      return {
        verified: false,
        matchScore: 0.5,
        brandMatch: false,
        modelMatch: false,
        partMatch: false,
        confidenceAdjustment: 0,
        reason: 'Could not parse reverse search response.',
      };
    }

    // Score matches
    const brandMatch = matchesBrand(brand, parsed.brand, parsed.vehicles);
    const modelMatch = matchesModel(model, parsed.vehicles);
    const partMatch = matchesPart(part, parsed.partType);

    let matchScore = 0;
    if (brandMatch) matchScore += 0.40;
    if (modelMatch) matchScore += 0.35;
    if (partMatch) matchScore += 0.20;
    if (parsed.isOem) matchScore += 0.05;

    // Determine confidence adjustment
    let confidenceAdjustment = 0;
    let verified = false;

    if (matchScore >= 0.75) {
      confidenceAdjustment = +0.12;
      verified = true;
    } else if (matchScore >= 0.55) {
      confidenceAdjustment = +0.05;
      verified = true;
    } else if (matchScore >= 0.30) {
      confidenceAdjustment = -0.05;
    } else {
      confidenceAdjustment = -0.20;
    }

    if (!parsed.isOem) {
      confidenceAdjustment = -0.25;
      verified = false;
    }

    logger.info('[v2 Validate] Reverse verification complete', {
      oem,
      verified,
      matchScore: Math.round(matchScore * 100) + '%',
      brandMatch,
      modelMatch,
      partMatch,
      confidenceAdjustment,
      elapsed,
    });

    return {
      verified,
      matchScore,
      brandMatch,
      modelMatch,
      partMatch,
      confidenceAdjustment,
      reason: verified
        ? `Reverse search confirms: ${parsed.vehicles[0] || 'vehicle'} + ${parsed.partType || 'part'}`
        : `Mismatch: found ${parsed.vehicles[0] || 'unknown'} instead of ${brand} ${model}`,
    };

  } catch (err: any) {
    logger.warn('[v2 Validate] Reverse verification failed', { error: err?.message, oem });
    return {
      verified: false,
      matchScore: 0.5,
      brandMatch: false,
      modelMatch: false,
      partMatch: false,
      confidenceAdjustment: 0,
      reason: `Error: ${err?.message}`,
    };
  }
}

/**
 * Should we run reverse verification for this candidate?
 */
export function needsReverseVerification(confidence: number): boolean {
  return confidence >= REVERSE_VERIFY_MIN && confidence < REVERSE_VERIFY_MAX;
}

// ============================================================================
// Parsing Helpers
// ============================================================================

interface ParsedReverseData {
  vehicles: string[];
  partType: string;
  isOem: boolean;
  brand: string;
}

function parseReverseResponse(text: string): ParsedReverseData | null {
  try {
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const data = JSON.parse(jsonMatch[0]);
    return {
      vehicles: Array.isArray(data.vehicles)
        ? data.vehicles.map((v: any) => String(v))
        : typeof data.vehicles === 'string' ? [data.vehicles] : [],
      partType: String(data.part_type || data.partType || ''),
      isOem: data.is_oem !== false,
      brand: String(data.brand || ''),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Match Scoring Helpers
// ============================================================================

const BRAND_ALIASES: Record<string, string[]> = {
  VW: ['VOLKSWAGEN', 'VAG'],
  VOLKSWAGEN: ['VW', 'VAG'],
  MERCEDES: ['MERCEDES-BENZ', 'MB', 'DAIMLER'],
  'MERCEDES-BENZ': ['MERCEDES', 'MB'],
  BMW: ['BAYERISCHE MOTOREN WERKE', 'MINI'],
  OPEL: ['VAUXHALL', 'GM'],
  SEAT: ['CUPRA', 'VAG'],
  SKODA: ['ŠKODA', 'VAG'],
};

function matchesBrand(expectedBrand: string, foundBrand: string, foundVehicles: string[]): boolean {
  const expected = expectedBrand.toUpperCase();
  const found = foundBrand.toUpperCase();
  const vehiclesStr = foundVehicles.join(' ').toUpperCase();

  if (found.includes(expected) || vehiclesStr.includes(expected)) return true;

  const aliases = BRAND_ALIASES[expected] || [];
  return aliases.some(a => found.includes(a) || vehiclesStr.includes(a));
}

function matchesModel(expectedModel: string, foundVehicles: string[]): boolean {
  if (!expectedModel) return false;
  const vehiclesStr = foundVehicles.join(' ').toUpperCase();
  const modelUpper = expectedModel.toUpperCase();

  // Extract model codes (E46, F30, Golf, A4, W204 etc.)
  const codes = modelUpper.match(/\b([A-Z]\d{2}|\w{2,3}\d{2,3}|[A-Z]{3,})\b/g) || [];
  const parts = modelUpper.split(/[\s,]+/).filter(w => w.length >= 2);
  const toCheck = [...new Set([...codes, ...parts])];

  return toCheck.some(code => vehiclesStr.includes(code));
}

function matchesPart(expectedPart: string, foundPart: string): boolean {
  if (!expectedPart || !foundPart) return false;
  const e = expectedPart.toUpperCase();
  const f = foundPart.toUpperCase();

  const partGroups: string[][] = [
    ['BREMS', 'BRAKE', 'SCHEIBE', 'BELAG', 'PAD', 'DISC', 'ROTOR'],
    ['FILTER', 'ÖL', 'OIL', 'LUFT', 'AIR', 'POLLEN', 'CABIN'],
    ['FAHRWERK', 'SUSPENSION', 'STOSSDÄMPFER', 'SHOCK', 'FEDER', 'SPRING', 'QUERLENKER'],
    ['MOTOR', 'ENGINE', 'TURBO', 'ZÜNDKERZE', 'SPARK'],
    ['KÜHL', 'COOL', 'WASSER', 'WATER', 'THERMOSTAT'],
    ['AUSPUFF', 'EXHAUST', 'KAT', 'DPF'],
    ['KUPPLUNG', 'CLUTCH'],
    ['LENK', 'STEERING', 'SPURSTANGE'],
    ['LICHT', 'LIGHT', 'SCHEINWERFER', 'HEADLIGHT'],
  ];

  for (const group of partGroups) {
    const eMatch = group.some(k => e.includes(k));
    const fMatch = group.some(k => f.includes(k));
    if (eMatch && fMatch) return true;
  }

  return false;
}
