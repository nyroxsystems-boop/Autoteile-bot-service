/**
 * 🔄 SCRAPER FALLBACK STRATEGY
 *
 * When >50% of web scrapers are disabled/failing, automatically
 * switch to a degraded mode that only uses reliable sources:
 * - Enterprise Database (local, instant)
 * - TecDoc Cross-Reference (static data)
 * - LLM Heuristic (AI inference)
 * - Motorcode Resolver (static engine data)
 *
 * This prevents wasting ScraperAPI credits on sources that are down
 * and reduces latency by skipping dead endpoints.
 */

import { logger } from '@utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ScraperHealthSummary {
    totalSources: number;
    healthySources: number;
    disabledSources: number;
    failingRate: number; // 0-1
}

export type ScrapingMode = 'full' | 'degraded' | 'offline';

// ============================================================================
// Source Health Tracking (in-memory, fed by sourceHealthMonitor)
// ============================================================================

const sourceStatus = new Map<string, { healthy: boolean; lastChecked: number }>();

/**
 * Report a source as healthy or unhealthy.
 * Called by sourceHealthMonitor when tracking results.
 */
export function reportSourceHealth(sourceName: string, healthy: boolean): void {
    sourceStatus.set(sourceName, { healthy, lastChecked: Date.now() });
}

/**
 * Get current health summary
 */
export function getHealthSummary(): ScraperHealthSummary {
    const total = sourceStatus.size;
    if (total === 0) {
        return { totalSources: 0, healthySources: 0, disabledSources: 0, failingRate: 0 };
    }

    let healthy = 0;
    let disabled = 0;

    for (const [, status] of sourceStatus) {
        if (status.healthy) healthy++;
        else disabled++;
    }

    return {
        totalSources: total,
        healthySources: healthy,
        disabledSources: disabled,
        failingRate: disabled / total,
    };
}

// ============================================================================
// Mode Decision
// ============================================================================

/** Known scraper source names (web-dependent) */
const WEB_SCRAPER_SOURCES = new Set([
    'autodoc_web',
    'motointegrator',
    '7zap_web',
    'realoem',
    'vag_etka',
    'mercedes_epc',
    'kfzteile24',
    'daparto',
    'ebay',
]);

/** Always-available sources (no web scraping) */
const RELIABLE_SOURCES = new Set([
    'enterprise-database',
    'enterprise-database-fts',
    'tecdoc_crossref',
    'premium_ai_oem_resolver',
]);

/**
 * Determine the scraping mode based on current source health.
 *
 * - full: All sources active, normal operation
 * - degraded: >50% scrapers down → skip web scrapers, use DB + TecDoc + AI only
 * - offline: >80% scrapers down AND DB empty → minimal mode
 */
export function determineScrapingMode(): ScrapingMode {
    const summary = getHealthSummary();

    // If we have no data yet, assume full mode
    if (summary.totalSources === 0) return 'full';

    // Count web scraper health specifically
    let webTotal = 0;
    let webDisabled = 0;

    for (const [name, status] of sourceStatus) {
        if (WEB_SCRAPER_SOURCES.has(name)) {
            webTotal++;
            if (!status.healthy) webDisabled++;
        }
    }

    const webFailRate = webTotal > 0 ? webDisabled / webTotal : 0;

    if (webFailRate > 0.8) {
        logger.error('[ScraperFallback] OFFLINE MODE — >80% web scrapers down', {
            webTotal, webDisabled, failRate: webFailRate
        });
        return 'offline';
    }

    if (webFailRate > 0.5) {
        logger.warn('[ScraperFallback] DEGRADED MODE — >50% web scrapers down', {
            webTotal, webDisabled, failRate: webFailRate
        });
        return 'degraded';
    }

    return 'full';
}

/**
 * Filter source list based on current mode.
 * In degraded mode, remove all web scraper sources.
 */
export function filterSourcesByMode<T extends { name: string }>(
    sources: T[],
    mode?: ScrapingMode
): T[] {
    const currentMode = mode ?? determineScrapingMode();

    if (currentMode === 'full') return sources;

    // In degraded/offline mode, only keep reliable sources
    const filtered = sources.filter(s =>
        RELIABLE_SOURCES.has(s.name) || !WEB_SCRAPER_SOURCES.has(s.name)
    );

    logger.info('[ScraperFallback] Sources filtered', {
        mode: currentMode,
        original: sources.length,
        filtered: filtered.length,
        kept: filtered.map(s => s.name),
    });

    return filtered;
}
