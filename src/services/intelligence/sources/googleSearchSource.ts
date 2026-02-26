/**
 * 🔍 GOOGLE SEARCH SOURCE
 * 
 * Uses Google Search as a super-scraper: one query searches ALL shops at once.
 * 
 * BUG 3 FIX: Strips HTML to visible snippet text before OEM extraction.
 * Raw Google HTML contains CSS classes, tracking IDs, JS vars that match
 * OEM regex patterns. We now extract only the visible search result snippets.
 */

import { OEMCandidate, OEMResolverRequest } from '../types';
import { logger } from '@utils/logger';
import { extractOEMsEnhanced } from '../enhancedOemExtractor';

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || '';
const GOOGLE_TIMEOUT = 12000;

/**
 * Extract visible snippet text from Google search results HTML.
 * This strips all HTML tags, scripts, styles, and non-visible content,
 * leaving only the text that appears in search result cards.
 */
function extractGoogleSnippets(html: string): string {
    // Remove script and style blocks entirely
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
    text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, ' ');

    // Remove all HTML tags but keep their text content
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities
    text = text.replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');

    // Collapse whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
}

export const googleSearchSource = {
    name: 'google_search',

    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        if (!SCRAPER_API_KEY) {
            logger.debug('[GoogleSearch] No SCRAPER_API_KEY configured');
            return [];
        }

        try {
            const make = req.vehicle.make || '';
            const model = req.vehicle.model || '';
            const year = req.vehicle.year || '';
            const part = req.partQuery.rawText;

            // Build 3 specialized queries for much better coverage
            const queries: string[] = [];

            // Query 1: German, specific — most likely to hit catalog pages
            queries.push(`${make} ${model} ${year} ${part} OEM Teilenummer original`.trim());

            // Query 2: Site-filtered — target shops that list OE numbers
            queries.push(`site:autodoc.de OR site:daparto.de OR site:pkwteile.de "${make} ${model}" "${part}" OE`.trim());

            // Query 3: English — broader international results
            const partEn = part
                .replace(/bremsscheibe/gi, 'brake disc')
                .replace(/bremsbelag/gi, 'brake pad')
                .replace(/stoßdämpfer/gi, 'shock absorber')
                .replace(/querlenker/gi, 'control arm')
                .replace(/ölfilter/gi, 'oil filter')
                .replace(/luftfilter/gi, 'air filter')
                .replace(/kupplung/gi, 'clutch')
                .replace(/turbolader/gi, 'turbocharger')
                .replace(/wasserpumpe/gi, 'water pump')
                .replace(/lichtmaschine/gi, 'alternator')
                .replace(/anlasser/gi, 'starter motor')
                .replace(/spurstange/gi, 'tie rod')
                .replace(/zahnriemen/gi, 'timing belt')
                .replace(/steuerkette/gi, 'timing chain')
                .replace(/scheinwerfer/gi, 'headlight');
            queries.push(`${make} ${model} ${year} ${partEn} OEM part number genuine`.trim());

            // Scrape all 3 queries in parallel
            const allCandidates: OEMCandidate[] = [];

            const scrapePromises = queries.slice(0, 3).map(async (query) => {
                try {
                    const googleUrl = `https://www.google.de/search?q=${encodeURIComponent(query)}&hl=de&num=10`;
                    const scraperUrl = `http://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(googleUrl)}&country_code=de`;

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), GOOGLE_TIMEOUT);

                    const resp = await fetch(scraperUrl, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (!resp.ok) return [];

                    const rawHtml = await resp.text();
                    const snippetText = extractGoogleSnippets(rawHtml);
                    const result = extractOEMsEnhanced(snippetText, make);

                    return result.candidates.map((match: any) => ({
                        oem: match.oem,
                        source: 'google_search',
                        confidence: Math.min(match.confidence, 0.70),
                        meta: {
                            note: 'Google Search snippet extraction',
                            context: match.context,
                            query: query.substring(0, 60),
                            priority: 2,
                        },
                    }));
                } catch {
                    return [];
                }
            });

            const results = await Promise.allSettled(scrapePromises);
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    allCandidates.push(...result.value);
                }
            }

            // Brand-prefix confidence boosting
            const { validateOemPattern } = await import('../brandPatternRegistry');
            for (const candidate of allCandidates) {
                const patternScore = validateOemPattern(candidate.oem, make);
                if (patternScore >= 0.9) {
                    candidate.confidence = Math.min(candidate.confidence + 0.10, 0.85);
                } else if (patternScore <= 0.3) {
                    candidate.confidence = Math.max(candidate.confidence - 0.10, 0.20);
                }
            }

            // Count how many queries found each OEM (cross-query consensus)
            const oemCounts = new Map<string, number>();
            for (const c of allCandidates) {
                oemCounts.set(c.oem, (oemCounts.get(c.oem) || 0) + 1);
            }

            // Boost OEMs found by multiple queries
            for (const c of allCandidates) {
                const count = oemCounts.get(c.oem) || 1;
                if (count >= 2) {
                    c.confidence = Math.min(c.confidence + 0.08, 0.90);
                }
            }

            // Deduplicate (keep highest confidence)
            const seen = new Map<string, OEMCandidate>();
            for (const c of allCandidates) {
                const existing = seen.get(c.oem);
                if (!existing || c.confidence > existing.confidence) {
                    seen.set(c.oem, c);
                }
            }
            const deduped = Array.from(seen.values());

            logger.info('[GoogleSearch] Multi-query extraction', {
                queries: queries.length,
                totalRawCandidates: allCandidates.length,
                dedupedCandidates: deduped.length,
            });

            return deduped;
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                logger.warn('[GoogleSearch] Request timed out');
            } else {
                logger.warn('[GoogleSearch] Search failed', { error: err?.message });
            }
            return [];
        }
    }
};
