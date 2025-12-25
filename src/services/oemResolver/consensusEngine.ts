/**
 * Multi-Source Consensus Engine
 * Aggregates results from multiple sources and determines the most reliable OEM
 */
import { OEMCandidate } from "./sources/baseSource";
import { logger } from "../../utils/logger";

export interface ConsensusResult {
    primaryOEM: string | null;
    confidence: number;
    agreementScore: number;
    sourceCount: number;
    sources: string[];
    allCandidates: OEMCandidate[];
}

export interface ConsensusConfig {
    minSources?: number; // Minimum sources required for high confidence
    minAgreement?: number; // Minimum agreement percentage (0-1)
    priorityWeight?: number; // How much to weight source priority (0-1)
}

const DEFAULT_CONFIG: Required<ConsensusConfig> = {
    minSources: 2,
    minAgreement: 0.6,
    priorityWeight: 0.3
};

/**
 * Calculates consensus from multiple OEM candidates
 */
export function calculateConsensus(
    candidates: OEMCandidate[],
    config: ConsensusConfig = {}
): ConsensusResult {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    if (candidates.length === 0) {
        return {
            primaryOEM: null,
            confidence: 0,
            agreementScore: 0,
            sourceCount: 0,
            sources: [],
            allCandidates: []
        };
    }

    // Group candidates by normalized OEM
    const oemGroups = new Map<string, OEMCandidate[]>();

    for (const candidate of candidates) {
        const existing = oemGroups.get(candidate.oem) || [];
        existing.push(candidate);
        oemGroups.set(candidate.oem, existing);
    }

    // Score each OEM group
    interface ScoredOEM {
        oem: string;
        score: number;
        sourceCount: number;
        avgConfidence: number;
        avgPriority: number;
        sources: string[];
        candidates: OEMCandidate[];
    }

    const scoredOems: ScoredOEM[] = [];

    for (const [oem, group] of oemGroups.entries()) {
        const uniqueSources = [...new Set(group.map(c => c.source))];
        const sourceCount = uniqueSources.length;

        // Calculate average confidence
        const avgConfidence = group.reduce((sum, c) => sum + c.confidence, 0) / group.length;

        // Calculate average priority (would need to be passed in meta)
        const avgPriority = group.reduce((sum, c) => {
            const priority = c.meta?.priority || 5;
            return sum + priority;
        }, 0) / group.length;

        // Calculate composite score
        // Score = (sourceCount * 0.4) + (avgConfidence * 0.3) + (avgPriority * 0.3)
        const score =
            (sourceCount / candidates.length) * (1 - cfg.priorityWeight) +
            avgConfidence * cfg.priorityWeight * 0.5 +
            (avgPriority / 10) * cfg.priorityWeight * 0.5;

        scoredOems.push({
            oem,
            score,
            sourceCount,
            avgConfidence,
            avgPriority,
            sources: uniqueSources,
            candidates: group
        });
    }

    // Sort by score (descending)
    scoredOems.sort((a, b) => b.score - a.score);

    const best = scoredOems[0];

    if (!best) {
        return {
            primaryOEM: null,
            confidence: 0,
            agreementScore: 0,
            sourceCount: 0,
            sources: [],
            allCandidates: candidates
        };
    }

    // Calculate agreement score (what % of sources agree on this OEM)
    const totalUniqueSources = new Set(candidates.map(c => c.source)).size;
    const agreementScore = best.sourceCount / totalUniqueSources;

    // Calculate final confidence
    let confidence = best.avgConfidence;

    // Boost confidence based on source agreement
    if (best.sourceCount >= 3) {
        confidence = Math.min(0.96, confidence + 0.08); // 3+ sources = +8%
    } else if (best.sourceCount >= 2) {
        confidence = Math.min(0.92, confidence + 0.05); // 2 sources = +5%
    }

    // Boost if high agreement
    if (agreementScore >= 0.7) {
        confidence = Math.min(0.98, confidence + 0.05); // 70%+ agreement = +5%
    }

    // Penalty if only one source
    if (best.sourceCount === 1) {
        confidence = Math.min(confidence, 0.85); // Cap at 85% for single source
    }

    logger.info(`[Consensus] Best OEM: ${best.oem} (${best.sourceCount} sources, ${(agreementScore * 100).toFixed(0)}% agreement, ${(confidence * 100).toFixed(0)}% confidence)`);

    return {
        primaryOEM: best.oem,
        confidence,
        agreementScore,
        sourceCount: best.sourceCount,
        sources: best.sources,
        allCandidates: candidates
    };
}

/**
 * Validates an OEM against brand-specific patterns
 */
export function validateBrandPattern(oem: string, brand: string): number {
    const patterns: Record<string, RegExp[]> = {
        VW: [/^[0-9][A-Z0-9]{8,11}$/], // e.g., 1K0615301AA
        AUDI: [/^[0-9][A-Z0-9]{8,11}$/], // Same as VW
        SKODA: [/^[0-9][A-Z0-9]{8,11}$/], // Same as VW
        SEAT: [/^[0-9][A-Z0-9]{8,11}$/], // Same as VW
        BMW: [/^[0-9]{11}$/, /^[0-9]{7}$/], // e.g., 34116858652 or 1234567
        MERCEDES: [/^[A-Z][0-9]{9,12}$/, /^[0-9]{10,13}$/], // e.g., A2034211012
        PORSCHE: [/^[0-9]{3}[A-Z0-9]{6,9}$/], // e.g., 95535104310
        OPEL: [/^[0-9]{8,10}$/], // e.g., 1606417580
        FORD: [/^[0-9A-Z]{10,13}$/], // e.g., 1848912
        RENAULT: [/^[0-9]{10,12}$/], // e.g., 7701208228
        PEUGEOT: [/^[0-9]{10}$/], // e.g., 1606417580
        CITROEN: [/^[0-9]{10}$/], // e.g., 1606417580
        TOYOTA: [/^[0-9]{5}-[0-9]{5}$/, /^[0-9]{10}$/], // e.g., 04465-02250
        HONDA: [/^[0-9]{5}-[A-Z0-9]{3}-[0-9]{3}$/], // e.g., 45022-S84-A00
        NISSAN: [/^[0-9]{5}-[0-9A-Z]{5}$/], // e.g., 40206-4BA0A
    };

    const brandUpper = brand.toUpperCase();
    const brandPatterns = patterns[brandUpper];

    if (!brandPatterns) {
        return 0.5; // Unknown brand, neutral score
    }

    for (const pattern of brandPatterns) {
        if (pattern.test(oem)) {
            return 1.0; // Perfect match
        }
    }

    return 0.2; // Doesn't match expected pattern
}

/**
 * Applies brand pattern boost to consensus result
 */
export function applyBrandPatternBoost(
    result: ConsensusResult,
    brand: string
): ConsensusResult {
    if (!result.primaryOEM) return result;

    const patternScore = validateBrandPattern(result.primaryOEM, brand);

    if (patternScore >= 0.8) {
        // Strong pattern match - boost confidence
        const boostedConfidence = Math.min(0.98, result.confidence + 0.05);

        logger.info(`[Consensus] Brand pattern boost: ${result.primaryOEM} matches ${brand} pattern (+5%)`);

        return {
            ...result,
            confidence: boostedConfidence
        };
    }

    if (patternScore <= 0.3) {
        // Pattern mismatch - reduce confidence
        const reducedConfidence = Math.max(0.5, result.confidence - 0.1);

        logger.warn(`[Consensus] Brand pattern mismatch: ${result.primaryOEM} doesn't match ${brand} pattern (-10%)`);

        return {
            ...result,
            confidence: reducedConfidence
        };
    }

    return result;
}
