// src/services/intelligence/sources/vagEtkaSource.ts
/**
 * 🔧 VAG ETKA Parts Catalog Scraper
 * 
 * Scrapes VAG (VW, Audi, Skoda, Seat) parts from public sources:
 * - 7zap.com (already integrated, enhanced here)
 * - vag-etka.ru (if accessible)
 * - parts.vw.com (limited)
 * 
 * VAG OEM patterns:
 * - 5Q0 615 301 H (with spaces, 10-11 chars)
 * - 5Q0615301H (normalized)
 * - Prefix indicates part location (1K=Golf 5, 5G=Golf 7, etc.)
 */

import fetch from 'node-fetch';
import { OEMCandidate, OEMResolverRequest } from '../types';
import { OEMSource, clampConfidence, logSourceResult } from './baseSource';
import { extractOemsFromHtml } from '../oemScraper';
import { logger } from '@utils/logger';

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

// VAG model code mapping (PR-Code prefixes)
const VAG_MODEL_PREFIXES: Record<string, string[]> = {
    // VW Golf generations
    'golf 4': ['1J'],
    'golf 5': ['1K'],
    'golf 6': ['5K'],
    'golf 7': ['5G', '5Q'],
    'golf 8': ['CD', 'CE'],
    // VW Passat
    'passat b6': ['3C'],
    'passat b7': ['3C'],
    'passat b8': ['3G'],
    // VW Tiguan
    'tiguan': ['5N', 'AD'],
    // Audi A3
    'a3 8p': ['8P'],
    'a3 8v': ['8V'],
    'a3 8y': ['8Y'],
    // Audi A4
    'a4 b8': ['8K'],
    'a4 b9': ['8W'],
    // Audi A6
    'a6 c7': ['4G'],
    'a6 c8': ['4K'],
    // Skoda Octavia
    'octavia 2': ['1Z'],
    'octavia 3': ['5E'],
    'octavia 4': ['NX'],
    // Seat Leon
    'leon 2': ['1P'],
    'leon 3': ['5F'],
    'leon 4': ['KL'],
};

// MQB platform shared prefixes
const MQB_PREFIXES = ['5Q', '5G', '5N2', 'AD1'];

// Part category to ETKA group mapping
const CATEGORY_TO_GROUP: Record<string, string[]> = {
    'bremse': ['03', '44', '45'],    // Brakes
    'brake': ['03', '44', '45'],
    'filter': ['01', '07'],           // Engine/Fuel
    'öl': ['01'],
    'motor': ['01', '02', '03'],
    'fahrwerk': ['40', '41', '42'],   // Suspension
    'suspension': ['40', '41', '42'],
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

function extractVagOems(html: string): string[] {
    const oems: Set<string> = new Set();

    // VAG OEM patterns:
    // 5Q0 615 301 H (spaced format)
    // 5Q0615301H (10-11 chars, letter suffix optional)
    // 1K0 820 803 A

    // Pattern 1: Spaced VAG format (3-3-3-1 or 3-3-3-2)
    const spacedPattern = /\b([0-9A-Z]{2,3})\s?([0-9]{3})\s?([0-9]{3})\s?([A-Z]{1,2})?\b/g;
    let match;
    while ((match = spacedPattern.exec(html)) !== null) {
        const prefix = match[1];
        const mid = match[2] + match[3];
        const suffix = match[4] || '';

        // Validate it looks like VAG
        if (/^[0-9A-Z]{2,3}$/.test(prefix) && /^[0-9]{6}$/.test(mid)) {
            const normalized = prefix + mid + suffix;
            if (normalized.length >= 9 && normalized.length <= 12) {
                oems.add(normalized);
            }
        }
    }

    // Pattern 2: Compact VAG format
    const compactPattern = /\b([0-9A-Z]{2,3}[0-9]{6}[A-Z]{0,2})\b/g;
    while ((match = compactPattern.exec(html)) !== null) {
        const candidate = match[1];
        if (candidate.length >= 9 && candidate.length <= 12) {
            // Verify structure: prefix + 6 digits + optional suffix
            if (/^[0-9A-Z]{2,3}[0-9]{6}[A-Z]{0,2}$/.test(candidate)) {
                oems.add(candidate);
            }
        }
    }

    // Also try generic extraction and filter for VAG patterns
    const genericOems = extractOemsFromHtml(html);
    for (const oem of genericOems) {
        if (/^[0-9A-Z]{2,3}[0-9]{6}[A-Z]{0,2}$/.test(oem)) {
            oems.add(oem);
        }
    }

    return Array.from(oems);
}

function getExpectedPrefixes(model: string): string[] {
    const normalized = model.toLowerCase();

    for (const [key, prefixes] of Object.entries(VAG_MODEL_PREFIXES)) {
        if (normalized.includes(key)) {
            return prefixes;
        }
    }

    // Check for MQB platform mentions
    if (normalized.includes('mqb')) {
        return MQB_PREFIXES;
    }

    // Check for direct prefix mention (e.g., "5G1")
    const prefixMatch = model.match(/\b([0-9A-Z]{2,3})\d?\b/);
    if (prefixMatch && /^[0-9A-Z]{2,3}$/.test(prefixMatch[1])) {
        return [prefixMatch[1]];
    }

    return [];
}

export const vagEtkaSource: OEMSource = {
    name: 'vag_etka',

    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        // Only process VAG brands
        const make = (req.vehicle.make ?? '').toLowerCase();
        const isVag = ['vw', 'volkswagen', 'audi', 'skoda', 'seat', 'cupra'].some(b => make.includes(b));
        if (!isVag) {
            return [];
        }

        try {
            const candidates: OEMCandidate[] = [];
            const model = req.vehicle.model ?? '';
            const query = req.partQuery.rawText.toLowerCase();
            const expectedPrefixes = getExpectedPrefixes(model);

            // Build search URLs for 7zap enhanced search
            const urls: string[] = [];

            // 7zap with model-specific search
            const searchQuery = encodeURIComponent(`${make} ${model} ${req.partQuery.rawText}`);
            urls.push(`https://www.7zap.com/de/search?q=${searchQuery}`);

            // If we know the model prefix, search more specifically
            for (const prefix of expectedPrefixes.slice(0, 2)) {
                urls.push(`https://www.7zap.com/de/search?q=${prefix}+${encodeURIComponent(req.partQuery.rawText)}`);
            }

            // Scrape each URL
            for (const url of urls.slice(0, 3)) {
                try {
                    const html = await fetchWithFallback(url);
                    const oems = extractVagOems(html);

                    for (const oem of oems) {
                        const relevanceScore = calculateVagRelevance(oem, query, expectedPrefixes, html);

                        if (relevanceScore > 0.3) {
                            candidates.push({
                                oem,
                                source: 'vag_etka',
                                confidence: clampConfidence(0.75 + relevanceScore * 0.2),
                                meta: {
                                    note: 'VAG ETKA catalog',
                                    expectedPrefixes,
                                    relevanceScore,
                                },
                            });
                        }
                    }
                } catch (e) {
                    logger.warn('VAG ETKA fetch failed', { url, error: e });
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
            logger.error('vagEtkaSource failed', { error: e });
            return [];
        }
    },
};

function calculateVagRelevance(oem: string, query: string, expectedPrefixes: string[], html: string): number {
    let score = 0.5;

    // Huge boost if OEM starts with expected prefix
    const oemPrefix = oem.substring(0, 2);
    if (expectedPrefixes.some(p => p.startsWith(oemPrefix) || oemPrefix.startsWith(p.substring(0, 2)))) {
        score += 0.25;
    }

    // Check if OEM appears near query keywords
    const context = getContextAroundOem(html, oem, 200);
    const keywords = ['brems', 'brake', 'scheibe', 'disc', 'belag', 'pad',
        'filter', 'öl', 'oil', 'luft', 'air', 'zünd', 'spark',
        'stoß', 'dämpfer', 'shock', 'feder', 'spring', 'lenker', 'arm'];

    for (const keyword of keywords) {
        if (query.includes(keyword) && context.toLowerCase().includes(keyword)) {
            score += 0.1;
            break; // Only add once
        }
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

export default vagEtkaSource;
