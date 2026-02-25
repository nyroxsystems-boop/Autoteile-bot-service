/**
 * 📊 OEM METRICS TRACKER
 *
 * M6 FIX: Tracks OEM resolution success metrics per brand.
 * In-memory tracking with periodic log output for Railway.
 *
 * Metrics tracked:
 * - Findrate per brand (successful OEM resolutions / total attempts)
 * - Average confidence scores
 * - Source success rates
 * - Latency histograms
 */

import { logger } from '@utils/logger';

// ============================================================================
// Types
// ============================================================================

interface BrandMetrics {
    attempts: number;
    successes: number;
    confidenceSum: number;
    latencySum: number;
    latencyMax: number;
    sourceHits: Record<string, number>;
}

interface SourceMetrics {
    totalCalls: number;
    successes: number;
    failures: number;
    avgLatencyMs: number;
    totalLatencyMs: number;
}

// ============================================================================
// State
// ============================================================================

const brandMetrics = new Map<string, BrandMetrics>();
const sourceMetrics = new Map<string, SourceMetrics>();
let totalResolutions = 0;
let totalSuccessful = 0;
const startTime = Date.now();

// ============================================================================
// Recording
// ============================================================================

/**
 * Record an OEM resolution attempt
 */
export function recordOemResolution(params: {
    brand: string;
    success: boolean;
    confidence: number;
    latencyMs: number;
    sources: string[];
}): void {
    const { brand, success, confidence, latencyMs, sources } = params;
    const brandKey = (brand || 'UNKNOWN').toUpperCase();

    totalResolutions++;
    if (success) totalSuccessful++;

    // Brand metrics
    if (!brandMetrics.has(brandKey)) {
        brandMetrics.set(brandKey, {
            attempts: 0,
            successes: 0,
            confidenceSum: 0,
            latencySum: 0,
            latencyMax: 0,
            sourceHits: {},
        });
    }

    const bm = brandMetrics.get(brandKey)!;
    bm.attempts++;
    if (success) bm.successes++;
    bm.confidenceSum += confidence;
    bm.latencySum += latencyMs;
    bm.latencyMax = Math.max(bm.latencyMax, latencyMs);

    // Track which sources contributed
    for (const src of sources) {
        bm.sourceHits[src] = (bm.sourceHits[src] || 0) + 1;
    }
}

/**
 * Record a source call result
 */
export function recordSourceCall(sourceName: string, success: boolean, latencyMs: number): void {
    if (!sourceMetrics.has(sourceName)) {
        sourceMetrics.set(sourceName, {
            totalCalls: 0,
            successes: 0,
            failures: 0,
            avgLatencyMs: 0,
            totalLatencyMs: 0,
        });
    }

    const sm = sourceMetrics.get(sourceName)!;
    sm.totalCalls++;
    if (success) sm.successes++;
    else sm.failures++;
    sm.totalLatencyMs += latencyMs;
    sm.avgLatencyMs = sm.totalLatencyMs / sm.totalCalls;
}

// ============================================================================
// Reporting
// ============================================================================

/**
 * Get current metrics summary
 */
export function getMetricsSummary(): {
    overview: {
        totalResolutions: number;
        successRate: number;
        uptimeMinutes: number;
    };
    byBrand: Array<{
        brand: string;
        attempts: number;
        successRate: number;
        avgConfidence: number;
        avgLatencyMs: number;
        maxLatencyMs: number;
        topSources: string[];
    }>;
    bySources: Array<{
        source: string;
        calls: number;
        successRate: number;
        avgLatencyMs: number;
    }>;
} {
    const uptimeMinutes = Math.round((Date.now() - startTime) / 60000);

    const byBrand = Array.from(brandMetrics.entries())
        .map(([brand, bm]) => ({
            brand,
            attempts: bm.attempts,
            successRate: bm.attempts > 0 ? Math.round((bm.successes / bm.attempts) * 100) : 0,
            avgConfidence: bm.attempts > 0 ? Math.round((bm.confidenceSum / bm.attempts) * 100) / 100 : 0,
            avgLatencyMs: bm.attempts > 0 ? Math.round(bm.latencySum / bm.attempts) : 0,
            maxLatencyMs: bm.latencyMax,
            topSources: Object.entries(bm.sourceHits)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([src]) => src),
        }))
        .sort((a, b) => b.attempts - a.attempts);

    const bySources = Array.from(sourceMetrics.entries())
        .map(([source, sm]) => ({
            source,
            calls: sm.totalCalls,
            successRate: sm.totalCalls > 0 ? Math.round((sm.successes / sm.totalCalls) * 100) : 0,
            avgLatencyMs: Math.round(sm.avgLatencyMs),
        }))
        .sort((a, b) => b.calls - a.calls);

    return {
        overview: {
            totalResolutions,
            successRate: totalResolutions > 0 ? Math.round((totalSuccessful / totalResolutions) * 100) : 0,
            uptimeMinutes,
        },
        byBrand,
        bySources,
    };
}

/**
 * Log metrics summary (call periodically or on admin request)
 */
export function logMetricsSummary(): void {
    const summary = getMetricsSummary();

    logger.info('[OEMMetrics] Summary', {
        total: summary.overview.totalResolutions,
        successRate: `${summary.overview.successRate}%`,
        uptimeMinutes: summary.overview.uptimeMinutes,
        topBrands: summary.byBrand.slice(0, 5).map(b => `${b.brand}: ${b.successRate}%`),
    });
}

// Auto-log every 10 minutes
setInterval(() => {
    if (totalResolutions > 0) {
        logMetricsSummary();
    }
}, 10 * 60 * 1000);

export default {
    recordOemResolution,
    recordSourceCall,
    getMetricsSummary,
    logMetricsSummary,
};
