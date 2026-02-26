/**
 * 🔄 SCRAPER FALLBACK STRATEGY
 *
 * Multi-layer resilience for OEM resolution:
 *
 * Mode: full      → All sources active (normal operation)
 * Mode: degraded  → >50% web scrapers down → skip paid scrapers, use DB + AI + free
 * Mode: offline   → >80% scrapers down → DB + AI only
 * Mode: budget    → ScraperAPI daily budget exceeded → use free sources only
 *
 * Credit budget tracking:
 * - Counts ScraperAPI calls per day
 * - Auto-switches to free sources when budget exceeded
 * - Resets at midnight
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
    dailyCreditsUsed: number;
    dailyBudget: number;
    budgetExceeded: boolean;
}

export type ScrapingMode = 'full' | 'degraded' | 'offline' | 'budget';

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

// ============================================================================
// 💰 ScraperAPI Credit Budget Tracking
// ============================================================================

const SCRAPER_API_DAILY_BUDGET = parseInt(process.env.SCRAPER_API_DAILY_BUDGET || '250', 10);

let dailyCreditsUsed = 0;
let lastResetDate = new Date().toDateString();

function resetDailyCounterIfNeeded(): void {
    const today = new Date().toDateString();
    if (today !== lastResetDate) {
        logger.info('[ScraperFallback] Daily credit counter reset', {
            previousDay: lastResetDate,
            creditsUsedYesterday: dailyCreditsUsed,
        });
        dailyCreditsUsed = 0;
        lastResetDate = today;
    }
}

/**
 * Record a ScraperAPI credit usage.
 * Call this after every successful ScraperAPI request.
 */
export function recordScraperApiCredit(count: number = 1): void {
    resetDailyCounterIfNeeded();
    dailyCreditsUsed += count;

    if (dailyCreditsUsed >= SCRAPER_API_DAILY_BUDGET * 0.9) {
        logger.warn('[ScraperFallback] ⚠️ Approaching daily credit budget', {
            used: dailyCreditsUsed,
            budget: SCRAPER_API_DAILY_BUDGET,
            remaining: SCRAPER_API_DAILY_BUDGET - dailyCreditsUsed,
        });
    }

    if (dailyCreditsUsed >= SCRAPER_API_DAILY_BUDGET) {
        logger.error('[ScraperFallback] 🔴 Daily credit budget EXCEEDED — switching to free sources', {
            used: dailyCreditsUsed,
            budget: SCRAPER_API_DAILY_BUDGET,
        });
    }
}

/**
 * Check if ScraperAPI budget is exceeded.
 */
export function isBudgetExceeded(): boolean {
    resetDailyCounterIfNeeded();
    return dailyCreditsUsed >= SCRAPER_API_DAILY_BUDGET;
}

/**
 * Get ScraperAPI status for admin dashboard.
 */
export function getScraperApiStatus(): {
    dailyCreditsUsed: number;
    dailyBudget: number;
    budgetRemaining: number;
    budgetExceeded: boolean;
    utilizationPercent: number;
} {
    resetDailyCounterIfNeeded();
    return {
        dailyCreditsUsed,
        dailyBudget: SCRAPER_API_DAILY_BUDGET,
        budgetRemaining: Math.max(0, SCRAPER_API_DAILY_BUDGET - dailyCreditsUsed),
        budgetExceeded: dailyCreditsUsed >= SCRAPER_API_DAILY_BUDGET,
        utilizationPercent: Math.round((dailyCreditsUsed / SCRAPER_API_DAILY_BUDGET) * 100),
    };
}

/**
 * Get current health summary
 */
export function getHealthSummary(): ScraperHealthSummary {
    resetDailyCounterIfNeeded();
    const total = sourceStatus.size;
    if (total === 0) {
        return {
            totalSources: 0, healthySources: 0, disabledSources: 0,
            failingRate: 0, dailyCreditsUsed, dailyBudget: SCRAPER_API_DAILY_BUDGET,
            budgetExceeded: isBudgetExceeded(),
        };
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
        dailyCreditsUsed,
        dailyBudget: SCRAPER_API_DAILY_BUDGET,
        budgetExceeded: isBudgetExceeded(),
    };
}

// ============================================================================
// Mode Decision
// ============================================================================

/** Known scraper source names (web/ScraperAPI-dependent) — must match source.name exactly */
const WEB_SCRAPER_SOURCES = new Set([
    'autodoc_web',        // autodocWebSource.name
    'autodoc_oe',         // autodocWebSource.name (renamed in overhaul)
    'realoem',            // realOemSource.name
    'vag_etka',           // vagEtkaSource.name
    'mercedes_epc',       // mercedesEpcSource.name
    'Kfzteile24',         // kfzteile24Source.name (capital K!)
    'Pkwteile',           // pkwteileSource.name (capital P!)
    'Oscaro',             // oscaroSource.name (capital O!)
    'web_scrape',         // webScrapeSource.name
    'google_search',      // googleSearchSource — ScraperAPI dependent
    'ebay_oem_mining',    // ebayOemSource — ScraperAPI dependent
]);

/** Always-available sources (no web scraping needed) */
const RELIABLE_SOURCES = new Set([
    'enterprise-database',
    'enterprise-database-fts',
    'premium_ai_oem_resolver',
    'direct_fetch_free',    // Free fallback: daparto, autoteile-markt, teilehaber
]);

/**
 * Determine the scraping mode based on current source health + budget.
 *
 * - full: All sources active, normal operation
 * - degraded: >50% scrapers down → skip web scrapers, use DB + AI + free
 * - offline: >80% scrapers down → DB + AI + free only
 * - budget: ScraperAPI daily budget exceeded → DB + AI + free only
 */
export function determineScrapingMode(): ScrapingMode {
    // Budget check takes priority
    if (isBudgetExceeded()) {
        logger.warn('[ScraperFallback] BUDGET MODE — daily credits exhausted', {
            used: dailyCreditsUsed,
            budget: SCRAPER_API_DAILY_BUDGET,
        });
        return 'budget';
    }

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
 * In degraded/offline/budget mode, remove all paid web scraper sources.
 * Free sources (directFetchSource) are always kept.
 */
export function filterSourcesByMode<T extends { name: string }>(
    sources: T[],
    mode?: ScrapingMode
): T[] {
    const currentMode = mode ?? determineScrapingMode();

    if (currentMode === 'full') return sources;

    // In degraded/offline/budget mode, only keep reliable + free sources
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
