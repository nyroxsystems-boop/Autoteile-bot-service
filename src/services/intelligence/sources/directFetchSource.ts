/**
 * 🆓 DIRECT FETCH SOURCE — Free Scraping Fallback
 *
 * When ScraperAPI is down or credits exhausted, this source provides
 * a free fallback by directly fetching sites WITHOUT anti-bot protection.
 *
 * Strategy:
 * - Daparto.de: No Cloudflare, accepts direct requests
 * - autoteile-markt.de: Simple HTML, no bot protection
 * - teilehaber.de: Lightweight, fast
 * - User-Agent rotation to avoid blocks
 *
 * Cost: 0 ScraperAPI credits
 * Reliability: ~60% (some sites may block occasionally)
 * Speed: Fast (no ScraperAPI proxy overhead)
 */

import { OEMCandidate, OEMResolverRequest } from '../types';
import { logger } from '@utils/logger';
import { extractOEMsEnhanced } from '../enhancedOemExtractor';

const TIMEOUT = 8000;

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

function randomUA(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Strip HTML to visible text for safe OEM extraction.
 */
function toVisibleText(html: string): string {
    return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ').trim();
}

/**
 * Try fetching a URL directly (no ScraperAPI).
 */
async function directFetch(url: string): Promise<string | null> {
    try {
        const resp = await fetch(url, {
            headers: {
                'User-Agent': randomUA(),
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate',
            },
            signal: AbortSignal.timeout(TIMEOUT),
            redirect: 'follow',
        });

        if (!resp.ok) return null;
        return await resp.text();
    } catch {
        return null;
    }
}

interface FreeTarget {
    name: string;
    buildUrl: (query: string) => string;
}

const FREE_TARGETS: FreeTarget[] = [
    {
        name: 'daparto',
        buildUrl: (q) => `https://www.daparto.de/suche?q=${encodeURIComponent(q)}`,
    },
    {
        name: 'autoteile-markt',
        buildUrl: (q) => `https://www.autoteile-markt.de/suche?q=${encodeURIComponent(q)}`,
    },
    {
        name: 'teilehaber',
        buildUrl: (q) => `https://www.teilehaber.de/search?term=${encodeURIComponent(q)}`,
    },
];

export const directFetchSource = {
    name: 'direct_fetch_free',

    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        const make = req.vehicle.make || '';
        const model = req.vehicle.model || '';
        const part = req.partQuery.rawText;
        const query = `${make} ${model} ${part} OEM`.trim();

        const allCandidates: OEMCandidate[] = [];

        // Parallel fetch from all free targets
        const promises = FREE_TARGETS.map(async (target) => {
            try {
                const url = target.buildUrl(query);
                const html = await directFetch(url);
                if (!html) return [];

                const visibleText = toVisibleText(html);
                const result = extractOEMsEnhanced(visibleText, make);

                return result.candidates.map((match: any) => ({
                    oem: match.oem,
                    source: 'direct_fetch_free',
                    confidence: Math.min(match.confidence, 0.60), // Cap: free scrapers are less reliable
                    meta: {
                        note: `Free direct fetch: ${target.name}`,
                        context: match.context,
                        freeSite: target.name,
                        priority: 3,
                    },
                }));
            } catch {
                return [];
            }
        });

        const results = await Promise.allSettled(promises);
        for (const result of results) {
            if (result.status === 'fulfilled') {
                allCandidates.push(...result.value);
            }
        }

        // Deduplicate
        const seen = new Map<string, OEMCandidate>();
        for (const c of allCandidates) {
            const existing = seen.get(c.oem);
            if (!existing || c.confidence > existing.confidence) {
                seen.set(c.oem, c);
            }
        }
        const deduped = Array.from(seen.values());

        logger.info('[DirectFetch] Free scraping complete', {
            query: query.substring(0, 60),
            candidates: deduped.length,
            cost: '0 credits',
        });

        return deduped;
    },
};

export default directFetchSource;
