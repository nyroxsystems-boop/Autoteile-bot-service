/**
 * 🕷️ OEM SCRAPING ENGINE
 * Enterprise-level web scraping with ScraperAPI
 * 
 * Features:
 * - ScraperAPI integration (proxy rotation, anti-bot bypass)
 * - Batch processing with rate limiting
 * - Progress tracking and error handling
 * - Direct integration with oemDatabase
 */

import fetch from 'node-fetch';
import { logger } from '@utils/logger';
import { extractOEMsEnhanced, learnSupersessionsFromHTML } from './enhancedOemExtractor';
import { oemDatabase, OEMRecord } from './oemDatabase';
import { ALL_SCRAPING_TARGETS, ScrapingTarget, getTargetsByPriority } from './scrapingTargets';

// ============================================================================
// Configuration
// ============================================================================

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || '';
const SCRAPER_API_BASE = 'http://api.scraperapi.com';

const CONFIG = {
    // Rate limiting
    requestsPerSecond: 2,            // Max requests per second
    delayBetweenRequests: 500,       // ms between requests
    delayBetweenTargets: 2000,       // ms between different targets

    // Batching
    batchSize: 50,                   // Pages per batch before DB insert

    // Retry
    maxRetries: 3,
    retryDelay: 5000,                // ms

    // Timeouts
    requestTimeout: 60000,           // 60s for ScraperAPI

    // Limits
    maxPagesPerRun: 1000,            // Safety limit per run
};

// ============================================================================
// Types
// ============================================================================

interface ScrapeResult {
    url: string;
    html: string | null;
    error?: string;
}

interface ScrapeStats {
    startTime: Date;
    endTime?: Date;
    pagesScraped: number;
    pagesErrors: number;
    oemsExtracted: number;
    supersessionsLearned: number;
    recordsInserted: number;
}

// ============================================================================
// ScraperAPI Functions
// ============================================================================

async function scrapeWithScraperAPI(url: string): Promise<string | null> {
    if (!SCRAPER_API_KEY) {
        logger.warn('[ScrapingEngine] No SCRAPER_API_KEY set, using direct fetch');
        return scrapeDirectly(url);
    }

    const apiUrl = new URL(SCRAPER_API_BASE);
    apiUrl.searchParams.set('api_key', SCRAPER_API_KEY);
    apiUrl.searchParams.set('url', url);
    apiUrl.searchParams.set('render', 'true');       // JavaScript rendering
    apiUrl.searchParams.set('country_code', 'de');   // German IP for better results

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONFIG.requestTimeout);

        const response = await fetch(apiUrl.toString(), {
            signal: controller.signal as any,
            headers: {
                'Accept': 'text/html',
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.text();
    } catch (error: any) {
        logger.warn(`[ScrapingEngine] ScraperAPI failed for ${url}: ${error.message}`);
        return null;
    }
}

async function scrapeDirectly(url: string): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(url, {
            signal: controller.signal as any,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
            }
        });

        clearTimeout(timeout);

        if (!response.ok) {
            return null;
        }

        return await response.text();
    } catch {
        return null;
    }
}

async function scrapeWithRetry(url: string, retries = CONFIG.maxRetries): Promise<ScrapeResult> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        const html = await scrapeWithScraperAPI(url);

        if (html && html.length > 1000) {
            return { url, html };
        }

        if (attempt < retries) {
            logger.debug(`[ScrapingEngine] Retry ${attempt}/${retries} for ${url}`);
            await sleep(CONFIG.retryDelay);
        }
    }

    return { url, html: null, error: 'Max retries exceeded' };
}

// ============================================================================
// Link Extraction
// ============================================================================

function extractLinks(html: string, baseUrl: string): string[] {
    const links: string[] = [];
    const hrefRegex = /href=["']([^"']+)["']/gi;
    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
        const href = match[1];

        // Skip non-product links
        if (href.startsWith('#') || href.startsWith('javascript:') ||
            href.includes('login') || href.includes('cart') ||
            href.includes('account') || href.includes('wishlist')) {
            continue;
        }

        // Handle relative URLs
        let fullUrl: string;
        if (href.startsWith('http')) {
            fullUrl = href;
        } else if (href.startsWith('/')) {
            const base = new URL(baseUrl);
            fullUrl = `${base.origin}${href}`;
        } else {
            continue;
        }

        // Only keep same-domain links
        const baseHost = new URL(baseUrl).hostname;
        try {
            const linkHost = new URL(fullUrl).hostname;
            if (linkHost !== baseHost) continue;
        } catch {
            continue;
        }

        // Filter for product/parts pages
        if (fullUrl.includes('ersatzteil') || fullUrl.includes('autoteile') ||
            fullUrl.includes('produkt') || fullUrl.includes('article')) {
            links.push(fullUrl);
        }
    }

    return [...new Set(links)]; // Dedupe
}

// ============================================================================
// OEM Extraction from HTML
// ============================================================================

function extractOEMsFromPage(html: string, brand: string): OEMRecord[] {
    const records: OEMRecord[] = [];

    // Use enhanced extractor
    const result = extractOEMsEnhanced(html, brand);

    // Learn supersessions automatically
    learnSupersessionsFromHTML(html);

    // Convert to records
    for (const candidate of result.candidates) {
        if (candidate.confidence < 0.5) continue;

        // Try to extract part description from context
        const description = candidate.context?.replace(/<[^>]+>/g, '').trim().substring(0, 200) || '';

        // Detect part category from context
        const category = detectCategory(candidate.context || '');

        records.push({
            oem: candidate.oem,
            brand: brand.toUpperCase(),
            partCategory: category,
            partDescription: description,
            sources: ['web-scrape'],
            confidence: candidate.confidence,
            lastVerified: new Date().toISOString(),
            hitCount: 0,
            supersededBy: candidate.supersededBy,
        });
    }

    return records;
}

function detectCategory(text: string): string {
    const lower = text.toLowerCase();

    if (/brems|brake|scheibe|belag/i.test(lower)) return 'brake';
    if (/filter|öl|oil|luft|air/i.test(lower)) return 'filter';
    if (/stoßdämpfer|feder|querlenker|suspension/i.test(lower)) return 'suspension';
    if (/kühl|cool|thermostat|radiator/i.test(lower)) return 'cooling';
    if (/motor|engine|zahnriemen|timing/i.test(lower)) return 'engine';
    if (/kupplung|clutch/i.test(lower)) return 'clutch';
    if (/auspuff|exhaust|katalysator/i.test(lower)) return 'exhaust';

    return 'unknown';
}

// ============================================================================
// Main Scraping Functions
// ============================================================================

async function scrapeTarget(target: ScrapingTarget, stats: ScrapeStats): Promise<OEMRecord[]> {
    const allRecords: OEMRecord[] = [];
    const visited = new Set<string>();
    const queue = [...target.urls];

    logger.info(`[ScrapingEngine] Starting target: ${target.id} (${target.brand})`);

    while (queue.length > 0 && visited.size < target.maxPages) {
        const url = queue.shift()!;

        if (visited.has(url)) continue;
        visited.add(url);

        // Rate limiting
        await sleep(CONFIG.delayBetweenRequests);

        // Scrape page
        const result = await scrapeWithRetry(url);

        if (!result.html) {
            stats.pagesErrors++;
            continue;
        }

        stats.pagesScraped++;

        // Extract OEMs
        const records = extractOEMsFromPage(result.html, target.brandCode);
        allRecords.push(...records);
        stats.oemsExtracted += records.length;

        // Extract more links
        const newLinks = extractLinks(result.html, url);
        for (const link of newLinks) {
            if (!visited.has(link) && !queue.includes(link)) {
                queue.push(link);
            }
        }

        // Progress log
        if (visited.size % 10 === 0) {
            logger.info(`[ScrapingEngine] ${target.id}: ${visited.size}/${target.maxPages} pages, ${allRecords.length} OEMs`);
        }

        // Batch insert to DB
        if (allRecords.length >= CONFIG.batchSize) {
            const batch = allRecords.splice(0, CONFIG.batchSize);
            oemDatabase.bulkInsert(batch);
            stats.recordsInserted += batch.length;
        }

        // Safety limit
        if (stats.pagesScraped >= CONFIG.maxPagesPerRun) {
            logger.warn('[ScrapingEngine] Reached max pages per run limit');
            break;
        }
    }

    // Insert remaining records
    if (allRecords.length > 0) {
        oemDatabase.bulkInsert(allRecords);
        stats.recordsInserted += allRecords.length;
    }

    logger.info(`[ScrapingEngine] Completed ${target.id}: ${visited.size} pages, ${stats.oemsExtracted} OEMs`);

    return allRecords;
}

// ============================================================================
// Public API
// ============================================================================

export async function runScrape(options: {
    priority?: 0 | 1 | 2;
    targetIds?: string[];
    maxPages?: number;
    test?: boolean;
} = {}): Promise<ScrapeStats> {
    const stats: ScrapeStats = {
        startTime: new Date(),
        pagesScraped: 0,
        pagesErrors: 0,
        oemsExtracted: 0,
        supersessionsLearned: 0,
        recordsInserted: 0,
    };

    // Select targets
    let targets: ScrapingTarget[];

    if (options.targetIds) {
        targets = ALL_SCRAPING_TARGETS.filter(t => options.targetIds!.includes(t.id));
    } else if (options.priority !== undefined) {
        targets = getTargetsByPriority(options.priority);
    } else {
        targets = ALL_SCRAPING_TARGETS;
    }

    // Apply max pages override
    if (options.maxPages) {
        targets = targets.map(t => ({ ...t, maxPages: Math.min(t.maxPages, options.maxPages!) }));
    }

    // Test mode: only first target, 10 pages
    if (options.test) {
        targets = [{ ...targets[0], maxPages: 10 }];
        logger.info('[ScrapingEngine] TEST MODE: 1 target, 10 pages');
    }

    logger.info(`[ScrapingEngine] Starting scrape: ${targets.length} targets`);

    // Process targets
    for (const target of targets) {
        await scrapeTarget(target, stats);
        await sleep(CONFIG.delayBetweenTargets);
    }

    stats.endTime = new Date();

    // Log summary
    const duration = (stats.endTime.getTime() - stats.startTime.getTime()) / 1000;
    logger.info(`[ScrapingEngine] COMPLETE`, {
        duration: `${duration.toFixed(1)}s`,
        pagesScraped: stats.pagesScraped,
        pagesErrors: stats.pagesErrors,
        oemsExtracted: stats.oemsExtracted,
        recordsInserted: stats.recordsInserted,
    });

    return stats;
}

// Quick test function
export async function testScrape(): Promise<void> {
    console.log('🕷️ Testing OEM Scraping Engine...\n');

    const stats = await runScrape({ test: true });

    console.log('\n=== Scrape Test Results ===');
    console.log(`Pages scraped: ${stats.pagesScraped}`);
    console.log(`Pages errors: ${stats.pagesErrors}`);
    console.log(`OEMs extracted: ${stats.oemsExtracted}`);
    console.log(`Records inserted: ${stats.recordsInserted}`);

    // Check DB
    const dbStats = oemDatabase.getStats();
    console.log(`\nDatabase total: ${dbStats.totalRecords} records`);
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// CLI Entry Point
// ============================================================================

if (require.main === module) {
    const args = process.argv.slice(2);

    const options: Parameters<typeof runScrape>[0] = {};

    if (args.includes('--test')) {
        options.test = true;
    }
    if (args.includes('--p0')) {
        options.priority = 0;
    }
    if (args.includes('--p1')) {
        options.priority = 1;
    }

    const pagesArg = args.find(a => a.startsWith('--pages='));
    if (pagesArg) {
        options.maxPages = parseInt(pagesArg.split('=')[1], 10);
    }

    console.log('🕷️ OEM Scraping Engine');
    console.log('========================\n');

    runScrape(options)
        .then(stats => {
            console.log('\n✅ Scraping complete!');
            console.log(`Duration: ${((stats.endTime!.getTime() - stats.startTime.getTime()) / 1000).toFixed(1)}s`);
            console.log(`Pages: ${stats.pagesScraped} (${stats.pagesErrors} errors)`);
            console.log(`OEMs: ${stats.oemsExtracted}`);
            console.log(`Inserted: ${stats.recordsInserted}`);
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Scraping failed:', err);
            process.exit(1);
        });
}

export default {
    runScrape,
    testScrape,
    scrapeWithScraperAPI,
};
