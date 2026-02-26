/**
 * Multi-Source Consensus Engine
 * Aggregates results from multiple sources and determines the most reliable OEM
 */
import { OEMCandidate } from "./sources/baseSource";
import { logger } from "@utils/logger";

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

    // ================================================================
    // Source Group Deduplication
    // Sources that scrape the same website are counted as ONE group
    // to prevent fake consensus (e.g., 2 websites counted as 5 sources)
    // ================================================================
    const SOURCE_GROUPS: Record<string, string> = {
        // 7zap group: vagEtkaSource + webScrapeSource(7zap) scrape same site
        'vag_etka': 'group_7zap',
        '7zap_web': 'group_7zap',
        'web_scrape:7zap': 'group_7zap',
        // Autodoc group: autodocWebSource + webScrapeSource(autodoc) scrape same site
        'autodoc_web': 'group_autodoc',
        'web_scrape:autodoc': 'group_autodoc',
        // Independent groups (each is unique)
        'enterprise-database': 'group_database',
        'enterprise-database-fts': 'group_database',
        'realoem': 'group_realoem',
        'web_scrape:realoem': 'group_realoem',
        'mercedes_epc': 'group_mercedes',
        'premium_ai_oem_resolver': 'group_ai',
        'Gemini-Vision': 'group_ai',
        // OCR group: direct image extraction
        'Document-OCR': 'group_ocr',
        // Aftermarket groups
        'Kfzteile24': 'group_kfzteile24',
        'Pkwteile': 'group_pkwteile',
        'Oscaro': 'group_oscaro',
        'Daparto_Search': 'group_daparto',
        // NEW: Super-sources (each independent)
        'google_search': 'group_google',
        'ebay_oem_mining': 'group_ebay',
        // 🏆 TecDoc (industry standard — highest priority independent group)
        'tecdoc_catalog': 'group_tecdoc',
        // 🌐 Gemini Grounded (AI with live web search — independent)
        'gemini_grounded': 'group_gemini_grounded',
        // 🆓 Free fallback (independent from ScraperAPI sources)
        'direct_fetch_free': 'group_direct_free',
        // 🔄 Aftermarket reverse cascade
        'aftermarket_crossref': 'group_aftermarket_crossref',
    };

    function getSourceGroup(sourceName: string): string {
        // Check exact match first
        if (SOURCE_GROUPS[sourceName]) return SOURCE_GROUPS[sourceName];
        // Check prefix match for composite source names like "web_scrape:partsouq"
        for (const [key, group] of Object.entries(SOURCE_GROUPS)) {
            if (sourceName.startsWith(key) || sourceName.includes(key)) return group;
        }
        // Unknown source = its own unique group
        return `group_${sourceName}`;
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
        // Deduplicated: count unique SOURCE GROUPS, not individual source names
        const uniqueGroups = [...new Set(uniqueSources.map(s => getSourceGroup(s)))];
        const sourceCount = uniqueGroups.length; // Real independent source count

        // Calculate average confidence
        const avgConfidence = group.reduce((sum, c) => sum + c.confidence, 0) / group.length;

        // Calculate average priority (from source meta, default 5)
        // Priority tiers: OEM Catalogs = 10, DB = 8, Aftermarket shops = 3, LLM = 1
        const avgPriority = group.reduce((sum, c) => {
            const priority = c.meta?.priority || 5;
            return sum + priority;
        }, 0) / group.length;

        // Calculate composite score
        // Reweighted: Priority 50%, SourceCount 30%, Confidence 20%
        // This prevents aftermarket shops from outvoting OEM catalogs by count alone
        const normalizedSourceCount = sourceCount / Math.max(candidates.length, 1);
        const normalizedPriority = avgPriority / 10; // Scale to 0-1
        const score =
            normalizedPriority * 0.50 +
            normalizedSourceCount * 0.30 +
            avgConfidence * 0.20;

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
import { validateOemPattern } from './brandPatternRegistry';

/**
 * Validates an OEM against brand-specific patterns.
 * Delegates to the consolidated brandPatternRegistry.
 */
export function validateBrandPattern(oem: string, brand: string): number {
    return validateOemPattern(oem, brand);
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
