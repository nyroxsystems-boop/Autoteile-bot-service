// src/services/intelligence/sources/mercedesEpcSource.ts
/**
 * 🌟 Mercedes EPC Parts Catalog Scraper
 * 
 * Scrapes Mercedes parts information from public sources:
 * - parts.mercedes-benz.com (public catalog)
 * - mercedes-catalog.net (aftermarket reference)
 * 
 * Mercedes OEM patterns:
 * - A 123 456 78 90 (with letter prefix, spaces)
 * - A1234567890 (normalized)
 */

import fetch from 'node-fetch';
import { OEMCandidate, OEMResolverRequest } from '../types';
import { OEMSource, clampConfidence, logSourceResult } from './baseSource';
import { logger } from '@utils/logger';

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

// Mercedes model code mapping
const MERCEDES_MODEL_CODES: Record<string, string[]> = {
    // C-Class
    'c-klasse': ['W205', 'W206'],
    'c180': ['W205', 'W206'],
    'c200': ['W205', 'W206'],
    'c220': ['W205', 'W206'],
    'c250': ['W205'],
    'c300': ['W205', 'W206'],
    'c63': ['W205', 'W206'],
    // E-Class
    'e-klasse': ['W213', 'W214'],
    'e200': ['W213', 'W214'],
    'e220': ['W213', 'W214'],
    'e300': ['W213', 'W214'],
    'e350': ['W213'],
    'e400': ['W213'],
    'e450': ['W213', 'W214'],
    'e63': ['W213'],
    // A-Class
    'a-klasse': ['W176', 'W177'],
    'a180': ['W176', 'W177'],
    'a200': ['W176', 'W177'],
    'a220': ['W177'],
    'a250': ['W176', 'W177'],
    'a35': ['W177'],
    'a45': ['W176', 'W177'],
    // GLC
    'glc': ['X253', 'X254'],
    'glc200': ['X253', 'X254'],
    'glc220': ['X253', 'X254'],
    'glc300': ['X253', 'X254'],
    // Sprinter
    'sprinter': ['W906', 'W907'],
};

// Part category keywords for context scoring
const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'brake': ['bremse', 'brake', 'scheibe', 'disc', 'belag', 'pad'],
    'filter': ['filter', 'öl', 'oil', 'luft', 'air', 'kraftstoff', 'fuel'],
    'suspension': ['fahrwerk', 'suspension', 'stoßdämpfer', 'shock', 'feder', 'spring'],
    'engine': ['motor', 'engine', 'zündkerze', 'spark', 'zahnriemen', 'timing'],
};

async function fetchWithFallback(url: string): Promise<string> {
    try {
        if (SCRAPER_API_KEY) {
            const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
            const resp = await fetch(scraperUrl, { timeout: 30000 });
            return resp.text();
        }
    } catch (e) {
        logger.warn('ScraperAPI failed, trying direct', { url });
    }

    const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 15000,
    });
    return resp.text();
}

function extractMercedesOems(html: string): string[] {
    const oems: Set<string> = new Set();

    // Mercedes OEM patterns:
    // A 000 420 12 20 (with letter prefix, groups of 3)
    // A0004201220 (normalized, 10-11 chars)

    // Pattern 1: Letter prefix + spaced numbers
    const spacedPattern = /\b([A-Z])\s*(\d{3})\s*(\d{3})\s*(\d{2})\s*(\d{2})\b/g;
    let match;
    while ((match = spacedPattern.exec(html)) !== null) {
        const normalized = match[1] + match[2] + match[3] + match[4] + match[5];
        oems.add(normalized);
    }

    // Pattern 2: Already normalized (A followed by 10 digits)
    const normalizedPattern = /\b([A-Z]\d{10})\b/g;
    while ((match = normalizedPattern.exec(html)) !== null) {
        oems.add(match[1]);
    }

    // Pattern 3: Old format without letter (10-digit number)
    const oldPattern = /\b([0-9]{3}\s?[0-9]{3}\s?[0-9]{2}\s?[0-9]{2})\b/g;
    while ((match = oldPattern.exec(html)) !== null) {
        const normalized = match[1].replace(/\s/g, '');
        if (normalized.length === 10) {
            oems.add(normalized);
        }
    }

    return Array.from(oems);
}

function getModelCodes(model: string): string[] {
    const normalized = model.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const [key, codes] of Object.entries(MERCEDES_MODEL_CODES)) {
        if (normalized.includes(key.replace('-', ''))) {
            return codes;
        }
    }

    // If specific code is mentioned (e.g., "W205")
    const codeMatch = model.match(/\b([WXV]\d{3})\b/i);
    if (codeMatch) {
        return [codeMatch[1].toUpperCase()];
    }

    return [];
}

export const mercedesEpcSource: OEMSource = {
    name: 'mercedes_epc',

    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        // Only process Mercedes requests
        const make = (req.vehicle.make ?? '').toLowerCase();
        if (!make.includes('mercedes') && !make.includes('benz') && !make.includes('daimler')) {
            return [];
        }

        try {
            const candidates: OEMCandidate[] = [];
            const model = req.vehicle.model ?? '';
            const query = req.partQuery.rawText.toLowerCase();
            const modelCodes = getModelCodes(model);

            // Build search URLs
            const urls: string[] = [];

            // Try mercedes-catalog.net search
            const searchQuery = encodeURIComponent(`${model} ${req.partQuery.rawText}`);
            urls.push(`https://mercedes-catalog.net/search?q=${searchQuery}`);

            // Try parts.mercedes-benz.com (may require different approach)
            urls.push(`https://www.mercedes-benz.de/passengercars/services-accessories/genuine-parts.html?q=${searchQuery}`);

            // Scrape each URL
            for (const url of urls.slice(0, 2)) {
                try {
                    const html = await fetchWithFallback(url);
                    const oems = extractMercedesOems(html);

                    for (const oem of oems) {
                        const relevanceScore = calculateMercedesRelevance(oem, query, html);

                        if (relevanceScore > 0.3) {
                            candidates.push({
                                oem,
                                source: 'mercedes_epc',
                                confidence: clampConfidence(0.75 + relevanceScore * 0.2),
                                meta: {
                                    note: 'Mercedes EPC catalog',
                                    modelCodes,
                                    relevanceScore,
                                    priority: 10,
                                },
                            });
                        }
                    }
                } catch (e) {
                    logger.warn('Mercedes EPC fetch failed', { url, error: e });
                }
            }

            // Deduplicate
            const seen = new Set<string>();
            const unique = candidates.filter(c => {
                if (seen.has(c.oem)) return false;
                seen.add(c.oem);
                return true;
            });

            logSourceResult(this.name, unique.length);
            return unique;

        } catch (e) {
            logger.error('mercedesEpcSource failed', { error: e });
            return [];
        }
    },
};

function calculateMercedesRelevance(oem: string, query: string, html: string): number {
    let score = 0.5;

    // Check category match
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        const queryHasCategory = keywords.some(k => query.includes(k));
        if (queryHasCategory) {
            // Check if OEM appears in context with this category
            const context = getContextAroundOem(html, oem, 300);
            if (keywords.some(k => context.toLowerCase().includes(k))) {
                score += 0.15;
            }
        }
    }

    // Check if OEM starts with expected prefix based on category
    const prefix = oem.charAt(0);
    if (prefix === 'A' && query.match(/brems|brake|scheibe|disc|belag|pad/)) {
        score += 0.1; // A-prefix common for brake parts
    }

    return Math.min(score, 1.0);
}

function getContextAroundOem(html: string, oem: string, chars: number): string {
    const index = html.indexOf(oem);
    if (index === -1) return '';

    const start = Math.max(0, index - chars);
    const end = Math.min(html.length, index + oem.length + chars);

    return html.substring(start, end);
}

export default mercedesEpcSource;
