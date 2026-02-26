/**
 * 🏆 AUTODOC 2-STAGE OE-NUMMERN SCRAPER
 *
 * Autodoc product DETAIL pages contain an explicit "OE-Nummern" section
 * that lists all OEM cross-references for that product. This is the
 * most reliable free source for OEM numbers besides catalog scrapers.
 *
 * Strategy:
 * Stage 1: Search autodoc.de → extract top 3-5 product detail URLs
 * Stage 2: Scrape each detail page → extract OE-Nummern section
 *
 * Confidence:
 * - OE from detail page = 0.80 base
 * - With vehicle brand prefix match = 0.90
 * - Multiple products agree = 0.95
 */

import { OEMCandidate, OEMResolverRequest } from '../types';
import { OEMSource, clampConfidence, logSourceResult } from './baseSource';
import { validateOemPattern } from '../brandPatternRegistry';
import { logger } from '@utils/logger';

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const AUTODOC_TIMEOUT = 15000;

// ============================================================================
// Fetch with ScraperAPI (required for Autodoc anti-bot)
// ============================================================================

async function fetchAutodoc(url: string): Promise<string> {
    const fetchFn = (await import('node-fetch')).default;

    if (SCRAPER_API_KEY) {
        const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}&country_code=de`;
        const resp = await fetchFn(scraperUrl, { timeout: AUTODOC_TIMEOUT * 2 });
        return resp.text();
    }

    const resp = await fetchFn(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        },
        timeout: AUTODOC_TIMEOUT,
    });
    return resp.text();
}

// ============================================================================
// Stage 1: Extract product detail URLs from search results
// ============================================================================

function extractProductUrls(html: string): string[] {
    const urls: string[] = [];

    // Autodoc product links typically look like:
    // /ersatzteil/brembo-bremsscheibe-09c881-11-123456
    // or href="/de/bremsscheibe/..."
    const productLinkPatterns = [
        /href="(\/[a-z]{2}\/[^"]*?(?:ersatzteil|article|produkt|product)[^"]*?)"/gi,
        /href="(\/ersatzteil\/[^"]+)"/gi,
        /href="(\/[a-z]{2}\/[^"]*?\d{6,}[^"]*?)"/gi,
        /href="(https?:\/\/www\.autodoc\.de\/[^"]*?(?:ersatzteil|article)[^"]*?)"/gi,
    ];

    for (const pattern of productLinkPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            let url = match[1];
            // Make absolute
            if (url.startsWith('/')) {
                url = `https://www.autodoc.de${url}`;
            }
            // Skip navigation, category, and non-product pages
            if (url.includes('login') || url.includes('cart') || url.includes('account') ||
                url.includes('?page=') || url.includes('/search')) {
                continue;
            }
            if (!urls.includes(url)) {
                urls.push(url);
            }
        }
    }

    return urls.slice(0, 5); // Max 5 detail pages
}

// ============================================================================
// Stage 2: Extract OE-Nummern from product detail page
// ============================================================================

function extractOeNumbersFromDetailPage(html: string): string[] {
    const oeNumbers: Set<string> = new Set();

    // ---- Method 1: Structured OE section ----
    // Autodoc often has sections labeled "OE" or "OEM" or "Originalteilnummer"
    // Look for these keywords and extract nearby part numbers

    // Find OE section by common labels
    const oeSectionPatterns = [
        /(?:OE|OEM|Originalteil|Original\s*teil)\s*(?:nummer|number|nr\.?|#|:)\s*[:\s]*([\s\S]{0,500})/gi,
        /(?:OE-Nummern|OEM-Nummern|OE\s*Numbers?)\s*[:\s]*([\s\S]{0,800})/gi,
        /data-oe[^>]*>([^<]+)</gi,
        /class="[^"]*oe[^"]*"[^>]*>([^<]+)</gi,
    ];

    for (const pattern of oeSectionPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const section = match[1];
            extractNumbersFromText(section, oeNumbers);
        }
    }

    // ---- Method 2: JSON-LD or structured data ----
    // Many product pages embed structured product data as JSON
    const jsonPatterns = [
        /"oe[_-]?numbers?"\s*:\s*\[([^\]]+)\]/gi,
        /"oem[_-]?numbers?"\s*:\s*\[([^\]]+)\]/gi,
        /"mpn"\s*:\s*"([^"]+)"/gi,
        /"sku"\s*:\s*"([^"]+)"/gi,
    ];

    for (const pattern of jsonPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const content = match[1];
            // Parse array items
            const items = content.match(/"([^"]+)"/g);
            if (items) {
                for (const item of items) {
                    const cleaned = item.replace(/"/g, '').trim();
                    if (looksLikeOem(cleaned)) {
                        oeNumbers.add(normalizeOem(cleaned));
                    }
                }
            } else if (looksLikeOem(content)) {
                oeNumbers.add(normalizeOem(content));
            }
        }
    }

    // ---- Method 3: Generic extraction from visible text near OE keywords ----
    // Strip HTML to text, find OE sections, extract patterns
    const visibleText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ');

    // Look for OE keyword neighborhoods
    const oeKeywordIdx = visibleText.search(/OE[\s-]*(?:Nummer|Number|Nr|Teilenummer)/i);
    if (oeKeywordIdx > -1) {
        const neighborhood = visibleText.substring(oeKeywordIdx, oeKeywordIdx + 600);
        extractNumbersFromText(neighborhood, oeNumbers);
    }

    return Array.from(oeNumbers);
}

function extractNumbersFromText(text: string, target: Set<string>): void {
    // VAG: 5Q0615301F, 1K0698151A
    const vagPattern = /\b([0-9A-Z]{2,3}\s?[0-9]{3}\s?[0-9]{3}\s?[A-Z]{0,2})\b/g;
    let match;
    while ((match = vagPattern.exec(text)) !== null) {
        const normalized = match[1].replace(/\s/g, '');
        if (normalized.length >= 9 && normalized.length <= 12 && looksLikeOem(normalized)) {
            target.add(normalized);
        }
    }

    // BMW: 34116860264 (11 digits)
    const bmwPattern = /\b(\d{11})\b/g;
    while ((match = bmwPattern.exec(text)) !== null) {
        target.add(match[1]);
    }

    // Mercedes: A0004212512
    const mercPattern = /\b([A-Z]\d{10,12})\b/g;
    while ((match = mercPattern.exec(text)) !== null) {
        target.add(match[1]);
    }

    // Generic: 7-13 char alphanumeric with at least 1 digit
    const genericPattern = /\b([A-Z0-9]{7,13})\b/g;
    while ((match = genericPattern.exec(text)) !== null) {
        const candidate = match[1];
        if (/\d/.test(candidate) && /[A-Z0-9]/.test(candidate) && looksLikeOem(candidate)) {
            target.add(candidate);
        }
    }
}

function looksLikeOem(s: string): boolean {
    if (!s || s.length < 7 || s.length > 14) return false;
    // Must have digits
    if (!/\d/.test(s)) return false;
    // Must not be all digits under 7 chars
    if (/^\d+$/.test(s) && s.length < 7) return false;
    // Must not be common non-OEM patterns
    if (/^(EAN|ISBN|UPC|GTIN|JAN)\d/i.test(s)) return false;
    return true;
}

function normalizeOem(s: string): string {
    return s.replace(/[\s.\-]/g, '').toUpperCase();
}

// ============================================================================
// Source Implementation
// ============================================================================

export const autodocWebSource: OEMSource = {
    name: 'autodoc_oe',

    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        try {
            const make = req.vehicle.make ?? '';
            const model = req.vehicle.model ?? '';
            const partText = req.partQuery.rawText;

            // Build search query
            const searchQuery = `${partText} ${make} ${model}`.trim();
            const searchUrl = `https://www.autodoc.de/search?searchTerm=${encodeURIComponent(searchQuery)}`;

            logger.info('[AutodocOE] Stage 1: Searching', { searchQuery });

            // ---- Stage 1: Get product URLs from search ----
            let searchHtml: string;
            try {
                searchHtml = await fetchAutodoc(searchUrl);
            } catch (e: any) {
                logger.warn('[AutodocOE] Stage 1 failed', { error: e?.message });
                return [];
            }

            const productUrls = extractProductUrls(searchHtml);

            // Also extract OEMs directly from search results (bonus)
            const searchOems = extractOeNumbersFromDetailPage(searchHtml);

            if (productUrls.length === 0 && searchOems.length === 0) {
                logger.info('[AutodocOE] No product URLs or OEMs found in search');
                logSourceResult(this.name, 0);
                return [];
            }

            logger.info('[AutodocOE] Stage 1 complete', {
                productUrls: productUrls.length,
                searchOems: searchOems.length,
            });

            // ---- Stage 2: Scrape detail pages for OE-Nummern ----
            const allOems = new Map<string, { count: number; fromDetail: boolean }>();

            // Add search page OEMs with lower confidence
            for (const oem of searchOems) {
                allOems.set(oem, { count: 1, fromDetail: false });
            }

            // Scrape top 3 detail pages (parallel, limit to save credits)
            const detailPromises = productUrls.slice(0, 3).map(async (url) => {
                try {
                    const detailHtml = await fetchAutodoc(url);
                    return extractOeNumbersFromDetailPage(detailHtml);
                } catch (e: any) {
                    logger.warn('[AutodocOE] Detail page failed', { url, error: e?.message });
                    return [];
                }
            });

            const detailResults = await Promise.allSettled(detailPromises);

            for (const result of detailResults) {
                if (result.status === 'fulfilled') {
                    for (const oem of result.value) {
                        const existing = allOems.get(oem);
                        if (existing) {
                            existing.count++;
                            existing.fromDetail = true;
                        } else {
                            allOems.set(oem, { count: 1, fromDetail: true });
                        }
                    }
                }
            }

            logger.info('[AutodocOE] Stage 2 complete', { totalOems: allOems.size });

            // ---- Build candidates with smart confidence ----
            const candidates: OEMCandidate[] = [];
            const brand = make.toUpperCase();

            for (const [oem, info] of allOems.entries()) {
                let confidence = 0.55; // Base for search-only hit

                // Detail page hit = much higher base
                if (info.fromDetail) {
                    confidence = 0.80;
                }

                // Multiple products agree = consensus boost
                if (info.count >= 2) {
                    confidence += 0.10;
                }
                if (info.count >= 3) {
                    confidence += 0.05;
                }

                // Brand pattern validation boost
                const patternScore = validateOemPattern(oem, brand);
                if (patternScore >= 0.9) {
                    confidence += 0.05; // Strong brand match
                } else if (patternScore <= 0.3) {
                    confidence -= 0.15; // Doesn't match brand → penalty
                }

                candidates.push({
                    oem,
                    source: this.name,
                    confidence: clampConfidence(confidence),
                    meta: {
                        note: info.fromDetail ? 'Autodoc OE detail page' : 'Autodoc search result',
                        productCount: info.count,
                        fromDetailPage: info.fromDetail,
                        patternScore,
                        priority: info.fromDetail ? 8 : 4,
                    },
                });
            }

            // Sort by confidence desc
            candidates.sort((a, b) => b.confidence - a.confidence);

            logSourceResult(this.name, candidates.length);
            return candidates.slice(0, 15); // Max 15 candidates

        } catch (e: any) {
            logger.error('[AutodocOE] Failed', { error: e?.message });
            return [];
        }
    },
};

export default autodocWebSource;
