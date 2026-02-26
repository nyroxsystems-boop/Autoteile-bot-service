/**
 * 📊 ACCURACY TRACKER
 *
 * Tracks real OEM resolution accuracy instead of guessing.
 *
 * Stores:
 * - Every resolution: input, result, confidence, sources, time
 * - Confirmed results: customer accepted → OEM was correct
 * - Rejected results: customer said wrong → accuracy miss
 * - Per-source hit/miss rates
 *
 * Reports:
 * - Overall accuracy (confirmed / total resolved)
 * - Per-brand accuracy
 * - Per-source contribution rate
 * - Average confidence vs actual accuracy
 */

import { logger } from '@utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ResolutionRecord {
    id: string;
    orderId: string;
    timestamp: string;
    // Input
    brand: string;
    model: string;
    partQuery: string;
    // Output
    primaryOem: string | null;
    confidence: number;
    sourcesUsed: string[];
    sourceCount: number;
    candidateCount: number;
    // Timing
    durationMs: number;
    // Outcome (updated later when we know if correct)
    outcome: 'pending' | 'confirmed' | 'rejected' | 'timeout';
    // Meta
    variantDetected: boolean;
    deepResolutionUsed: boolean;
}

export interface AccuracyStats {
    totalResolutions: number;
    withOem: number;
    withoutOem: number;
    confirmed: number;
    rejected: number;
    pending: number;
    // Rates
    resolutionRate: number;  // withOem / total
    accuracyRate: number;    // confirmed / (confirmed + rejected)
    avgConfidence: number;
    avgDurationMs: number;
    // Per-source
    sourceStats: Record<string, { contributed: number; confirmed: number; rejected: number }>;
    // Per-brand
    brandStats: Record<string, { total: number; resolved: number; confirmed: number }>;
}

// ============================================================================
// In-Memory Store (persisted periodically)
// ============================================================================

const MAX_RECORDS = 5000;
const records: ResolutionRecord[] = [];
const sourceContributions = new Map<string, { total: number; confirmed: number; rejected: number }>();

// ============================================================================
// Public API
// ============================================================================

/**
 * Track a new OEM resolution attempt.
 * Called at the end of resolveOEM().
 */
export function trackResolution(params: {
    orderId: string;
    brand: string;
    model: string;
    partQuery: string;
    primaryOem: string | null;
    confidence: number;
    sourcesUsed: string[];
    candidateCount: number;
    durationMs: number;
    variantDetected: boolean;
    deepResolutionUsed: boolean;
}): string {
    const id = `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const record: ResolutionRecord = {
        id,
        orderId: params.orderId,
        timestamp: new Date().toISOString(),
        brand: params.brand,
        model: params.model,
        partQuery: params.partQuery,
        primaryOem: params.primaryOem,
        confidence: params.confidence,
        sourcesUsed: params.sourcesUsed,
        sourceCount: params.sourcesUsed.length,
        candidateCount: params.candidateCount,
        durationMs: params.durationMs,
        outcome: 'pending',
        variantDetected: params.variantDetected,
        deepResolutionUsed: params.deepResolutionUsed,
    };

    records.push(record);

    // Track source contributions
    for (const source of params.sourcesUsed) {
        const existing = sourceContributions.get(source) || { total: 0, confirmed: 0, rejected: 0 };
        existing.total++;
        sourceContributions.set(source, existing);
    }

    // Limit memory usage
    if (records.length > MAX_RECORDS) {
        records.splice(0, records.length - MAX_RECORDS);
    }

    logger.debug('[AccuracyTracker] Resolution tracked', {
        id,
        orderId: params.orderId,
        brand: params.brand,
        oem: params.primaryOem,
        confidence: params.confidence,
        sources: params.sourcesUsed.length,
        duration: params.durationMs,
    });

    return id;
}

/**
 * Mark a previous resolution as confirmed (customer accepted the OEM).
 * Called when customer proceeds with an offer.
 */
export function confirmResolution(orderId: string): void {
    const record = records.find(r => r.orderId === orderId && r.outcome === 'pending');
    if (record) {
        record.outcome = 'confirmed';
        for (const source of record.sourcesUsed) {
            const stats = sourceContributions.get(source);
            if (stats) stats.confirmed++;
        }
        logger.info('[AccuracyTracker] Resolution CONFIRMED', {
            orderId,
            oem: record.primaryOem,
            confidence: record.confidence,
        });
    }
}

/**
 * Mark a previous resolution as rejected (customer said wrong OEM).
 */
export function rejectResolution(orderId: string): void {
    const record = records.find(r => r.orderId === orderId && r.outcome === 'pending');
    if (record) {
        record.outcome = 'rejected';
        for (const source of record.sourcesUsed) {
            const stats = sourceContributions.get(source);
            if (stats) stats.rejected++;
        }
        logger.warn('[AccuracyTracker] Resolution REJECTED', {
            orderId,
            oem: record.primaryOem,
            confidence: record.confidence,
            sources: record.sourcesUsed,
        });
    }
}

/**
 * Get comprehensive accuracy stats.
 */
export function getAccuracyStats(): AccuracyStats {
    const total = records.length;
    const withOem = records.filter(r => r.primaryOem !== null).length;
    const confirmed = records.filter(r => r.outcome === 'confirmed').length;
    const rejected = records.filter(r => r.outcome === 'rejected').length;
    const pending = records.filter(r => r.outcome === 'pending').length;

    const avgConfidence = total > 0
        ? records.reduce((sum, r) => sum + r.confidence, 0) / total
        : 0;
    const avgDuration = total > 0
        ? records.reduce((sum, r) => sum + r.durationMs, 0) / total
        : 0;

    // Per-source stats
    const sourceStats: Record<string, { contributed: number; confirmed: number; rejected: number }> = {};
    for (const [source, stats] of sourceContributions) {
        sourceStats[source] = {
            contributed: stats.total,
            confirmed: stats.confirmed,
            rejected: stats.rejected,
        };
    }

    // Per-brand stats
    const brandMap = new Map<string, { total: number; resolved: number; confirmed: number }>();
    for (const r of records) {
        const brand = r.brand || 'UNKNOWN';
        const existing = brandMap.get(brand) || { total: 0, resolved: 0, confirmed: 0 };
        existing.total++;
        if (r.primaryOem) existing.resolved++;
        if (r.outcome === 'confirmed') existing.confirmed++;
        brandMap.set(brand, existing);
    }
    const brandStats: Record<string, { total: number; resolved: number; confirmed: number }> = {};
    for (const [brand, stats] of brandMap) {
        brandStats[brand] = stats;
    }

    return {
        totalResolutions: total,
        withOem,
        withoutOem: total - withOem,
        confirmed,
        rejected,
        pending,
        resolutionRate: total > 0 ? withOem / total : 0,
        accuracyRate: (confirmed + rejected) > 0 ? confirmed / (confirmed + rejected) : 0,
        avgConfidence,
        avgDurationMs: Math.round(avgDuration),
        sourceStats,
        brandStats,
    };
}

/**
 * Get recent resolutions for debugging.
 */
export function getRecentResolutions(count: number = 10): ResolutionRecord[] {
    return records.slice(-count);
}

export default {
    trackResolution,
    confirmResolution,
    rejectResolution,
    getAccuracyStats,
    getRecentResolutions,
};
