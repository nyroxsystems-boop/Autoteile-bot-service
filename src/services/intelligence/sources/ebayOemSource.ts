/**
 * 🛒 eBAY OEM MINING SOURCE
 * 
 * BUG 4 FIX: Scrapes individual listing DETAIL pages, not search results.
 * 
 * eBay listing detail pages have structured "OE/OEM Referenznummer" fields
 * in the item specifics section. Search result pages only show titles+prices.
 * 
 * Flow:
 * 1. ScraperAPI → eBay.de search results
 * 2. Extract first 3 listing URLs from search results
 * 3. ScraperAPI → each listing detail page
 * 4. Extract structured OEM fields from item specifics
 */

import { OEMCandidate, OEMResolverRequest } from '../types';
import { logger } from '@utils/logger';

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || '';
const EBAY_TIMEOUT = 10000;
const MAX_DETAIL_PAGES = 2; // Limit API costs: only scrape top 2 listings

/**
 * Extract listing URLs from eBay search results page.
 */
function extractListingUrls(searchHtml: string): string[] {
    const urls: string[] = [];
    // eBay search results contain links like /itm/TITLE/12345678
    const pattern = /href="(https:\/\/www\.ebay\.de\/itm\/[^"]+)"/gi;
    let match;
    while ((match = pattern.exec(searchHtml)) !== null) {
        const url = match[1].split('?')[0]; // Remove query params
        if (!urls.includes(url)) {
            urls.push(url);
        }
        if (urls.length >= MAX_DETAIL_PAGES) break;
    }
    return urls;
}

/**
 * Extract OEM reference numbers from an eBay listing DETAIL page.
 * Item specifics section contains structured key-value pairs.
 */
function extractOemsFromDetailPage(html: string): string[] {
    const oems: string[] = [];

    // Pattern 1: eBay item specifics — "OE/OEM Referenznummer(n): XXX, YYY"
    const oeRefPatterns = [
        /OE[\/-]?OEM[\s-]*Referenznummer[en]*[:\s]+([^<]+)/gi,
        /Vergleichsnummer[en]*[:\s]+([^<]+)/gi,
        /Originalteile[\s-]*Nr[.]*[:\s]+([^<]+)/gi,
        /Hersteller-?Teile-?Nr[.\s]*[:\s]+([^<]+)/gi,
        /OE-?Nummer[n]*[:\s]+([^<]+)/gi,
        /Original[\s-]*Nummer[n]*[:\s]+([^<]+)/gi,
    ];

    for (const pattern of oeRefPatterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
            const refs = match[1]
                .split(/[,;|]/)
                .map(r => r.trim().replace(/[^A-Z0-9]/gi, '').toUpperCase())
                .filter(r => r.length >= 5 && r.length <= 16 && /\d/.test(r));
            oems.push(...refs);
        }
    }

    // Pattern 2: eBay structured data in item specifics table
    // <span>OE/OEM Referenznummer:</span><span>5Q0615301H, 5Q0615301G</span>
    const tablePattern = /(?:OEM|OE|Vergleich|Original)[^<]*<\/(?:span|td|dt|div)>\s*<(?:span|td|dd|div)[^>]*>([^<]+)/gi;
    let smatch;
    while ((smatch = tablePattern.exec(html)) !== null) {
        const refs = smatch[1]
            .split(/[,;|]/)
            .map(r => r.trim().replace(/[\s.-]/g, '').toUpperCase())
            .filter(r => r.length >= 5 && r.length <= 16 && /\d/.test(r));
        oems.push(...refs);
    }

    return [...new Set(oems)];
}

export const ebayOemSource = {
    name: 'ebay_oem_mining',

    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        if (!SCRAPER_API_KEY) {
            logger.debug('[eBayOEM] No SCRAPER_API_KEY configured');
            return [];
        }

        try {
            const make = req.vehicle.make || '';
            const model = req.vehicle.model || '';
            const part = req.partQuery.rawText;

            // Step 1: Search eBay for relevant listings
            const query = `${make} ${model} ${part} OEM Original`.trim();
            const searchUrl = `https://www.ebay.de/sch/i.html?_nkw=${encodeURIComponent(query)}&_sacat=0&LH_ItemCondition=3`;
            const searchScraperUrl = `http://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(searchUrl)}&country_code=de`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), EBAY_TIMEOUT);

            const searchResp = await fetch(searchScraperUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!searchResp.ok) {
                logger.warn('[eBayOEM] Search ScraperAPI error', { status: searchResp.status });
                return [];
            }

            const searchHtml = await searchResp.text();
            const listingUrls = extractListingUrls(searchHtml);

            if (listingUrls.length === 0) {
                logger.info('[eBayOEM] No listing URLs found in search results');
                return [];
            }

            logger.info('[eBayOEM] Found listing URLs', { count: listingUrls.length });

            // Step 2: Scrape detail pages for structured OEM fields
            const allOems: string[] = [];
            for (const listingUrl of listingUrls) {
                try {
                    const detailScraperUrl = `http://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(listingUrl)}&country_code=de`;
                    const detailController = new AbortController();
                    const detailTimeout = setTimeout(() => detailController.abort(), EBAY_TIMEOUT);

                    const detailResp = await fetch(detailScraperUrl, { signal: detailController.signal });
                    clearTimeout(detailTimeout);

                    if (detailResp.ok) {
                        const detailHtml = await detailResp.text();
                        const oems = extractOemsFromDetailPage(detailHtml);
                        allOems.push(...oems);

                        logger.debug('[eBayOEM] Detail page OEMs', {
                            url: listingUrl.substring(0, 60),
                            oemCount: oems.length,
                        });
                    }
                } catch (detailErr: any) {
                    logger.debug('[eBayOEM] Detail page failed', { error: detailErr?.message });
                }
            }

            // Deduplicate and build candidates
            const uniqueOems = [...new Set(allOems)];
            const candidates: OEMCandidate[] = uniqueOems.map(oem => ({
                oem,
                source: 'ebay_oem_mining',
                confidence: 0.65,
                meta: {
                    note: 'eBay item specifics structured OEM field',
                    priority: 2,
                },
            }));

            logger.info('[eBayOEM] Extracted structured OEM references', {
                query: query.substring(0, 80),
                listingsScraped: listingUrls.length,
                totalOems: candidates.length,
            });

            return candidates;
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                logger.warn('[eBayOEM] Request timed out');
            } else {
                logger.warn('[eBayOEM] Mining failed', { error: err?.message });
            }
            return [];
        }
    }
};
