// src/services/intelligence/sources/realOemSource.ts
/**
 * 🏎️ RealOEM BMW Parts Catalog Scraper
 * 
 * RealOEM.com is a comprehensive BMW/MINI parts catalog with:
 * - Exploded diagrams showing all OEM parts
 * - Full part numbers with supersession info
 * - Engine/chassis/year filtering
 * 
 * This source provides high-confidence BMW OEM numbers.
 */

import fetch from 'node-fetch';
import { OEMCandidate, OEMResolverRequest } from '../types';
import { OEMSource, clampConfidence, logSourceResult } from './baseSource';
import { extractOemsFromHtml } from '../oemScraper';
import { logger } from '@utils/logger';

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

// BMW model code mapping for RealOEM URLs
const BMW_MODEL_CODES: Record<string, string[]> = {
    // 1 Series
    '1er': ['E87', 'F20', 'F40'],
    '116': ['E87', 'F20', 'F40'],
    '118': ['E87', 'F20', 'F40'],
    '120': ['E87', 'F20', 'F40'],
    // 3 Series
    '3er': ['E90', 'F30', 'G20'],
    '316': ['E90', 'F30', 'G20'],
    '318': ['E90', 'F30', 'G20'],
    '320': ['E90', 'F30', 'G20'],
    '325': ['E90', 'F30', 'G20'],
    '330': ['E90', 'F30', 'G20'],
    '335': ['E90', 'F30', 'G20'],
    '340': ['F30', 'G20'],
    // 5 Series
    '5er': ['F10', 'G30'],
    '520': ['F10', 'G30'],
    '525': ['F10', 'G30'],
    '530': ['F10', 'G30'],
    '535': ['F10', 'G30'],
    '540': ['G30'],
    // X Series
    'x1': ['E84', 'F48', 'U11'],
    'x3': ['E83', 'F25', 'G01'],
    'x5': ['E70', 'F15', 'G05'],
};

// Part category to RealOEM group mapping
const CATEGORY_GROUPS: Record<string, string[]> = {
    'bremsscheibe': ['34'],      // Brakes
    'brake': ['34'],
    'bremsen': ['34'],
    'bremsbelag': ['34'],
    'ölfilter': ['11'],          // Engine
    'oil filter': ['11'],
    'luftfilter': ['13'],        // Fuel system
    'air filter': ['13'],
    'zündkerze': ['12'],         // Ignition
    'spark plug': ['12'],
    'stoßdämpfer': ['33'],       // Suspension
    'shock': ['33'],
    'federbein': ['31', '33'],
    'querlenker': ['31'],        // Front axle
    'control arm': ['31'],
};

async function fetchWithScraperApi(url: string): Promise<string> {
    if (SCRAPER_API_KEY) {
        const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
        const resp = await fetch(scraperUrl, { timeout: 30000 });
        return resp.text();
    } else {
        const resp = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 15000,
        });
        return resp.text();
    }
}

function extractBmwOems(html: string): string[] {
    const oems: Set<string> = new Set();

    // BMW OEM patterns: 
    // - 11 42 7 953 129 (with spaces)
    // - 11427953129 (no spaces)
    // - 34 11 6 864 906
    const bmwPattern = /\b(\d{2}\s?\d{2}\s?\d{1}\s?\d{3}\s?\d{3})\b/g;
    let match;
    while ((match = bmwPattern.exec(html)) !== null) {
        const normalized = match[1].replace(/\s/g, '');
        if (normalized.length === 11) {
            oems.add(normalized);
        }
    }

    // Also try generic extraction
    const genericOems = extractOemsFromHtml(html);
    for (const oem of genericOems) {
        // Filter for BMW patterns (11 digits, or specific prefixes)
        if (/^\d{11}$/.test(oem) || /^[0-9]{2}[0-9]{2}[0-9]{7}$/.test(oem)) {
            oems.add(oem);
        }
    }

    return Array.from(oems);
}

function getModelCodes(model: string): string[] {
    const normalized = model.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const [key, codes] of Object.entries(BMW_MODEL_CODES)) {
        if (normalized.includes(key.toLowerCase())) {
            return codes;
        }
    }

    // If specific code is mentioned (e.g., "F30"), return it
    const codeMatch = model.match(/\b([EFG]\d{2})\b/i);
    if (codeMatch) {
        return [codeMatch[1].toUpperCase()];
    }

    return [];
}

export const realOemSource: OEMSource = {
    name: 'realoem',

    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        // Only process BMW requests
        const make = (req.vehicle.make ?? '').toLowerCase();
        if (!make.includes('bmw') && !make.includes('mini')) {
            return [];
        }

        try {
            const candidates: OEMCandidate[] = [];
            const model = req.vehicle.model ?? '';
            const modelCodes = getModelCodes(model);
            const query = req.partQuery.rawText.toLowerCase();

            // Determine category groups to search
            let groups: string[] = [];
            for (const [keyword, grps] of Object.entries(CATEGORY_GROUPS)) {
                if (query.includes(keyword)) {
                    groups = [...groups, ...grps];
                }
            }
            if (groups.length === 0) groups = ['34', '11']; // Default: brakes + engine

            // Build search URLs
            const urls: string[] = [];

            // Try RealOEM search
            const searchQuery = encodeURIComponent(`${model} ${req.partQuery.rawText}`);
            urls.push(`https://www.realoem.com/bmw/engl/select.do?kind=P&q=${searchQuery}`);

            // Try model-specific catalog pages
            for (const code of modelCodes.slice(0, 2)) {
                for (const group of groups.slice(0, 2)) {
                    urls.push(`https://www.realoem.com/bmw/engl/partgrp.do?model=${code}&mospid=&btnr=&hession=&srcMode=0&lang=engl&group=${group}`);
                }
            }

            // Scrape each URL
            for (const url of urls.slice(0, 3)) { // Limit to 3 requests
                try {
                    const html = await fetchWithScraperApi(url);
                    const oems = extractBmwOems(html);

                    for (const oem of oems) {
                        // Check if OEM matches the query context
                        const relevanceScore = calculateRelevance(oem, query, html);

                        if (relevanceScore > 0.3) {
                            candidates.push({
                                oem,
                                source: 'realoem',
                                confidence: clampConfidence(0.75 + relevanceScore * 0.2), // 0.75-0.95
                                meta: {
                                    note: 'RealOEM BMW catalog',
                                    url,
                                    relevanceScore,
                                },
                            });
                        }
                    }
                } catch (e) {
                    logger.warn('RealOEM fetch failed', { url, error: e });
                }
            }

            // Deduplicate by OEM number
            const seen = new Set<string>();
            const unique = candidates.filter(c => {
                if (seen.has(c.oem)) return false;
                seen.add(c.oem);
                return true;
            });

            logSourceResult(this.name, unique.length);
            return unique;

        } catch (e) {
            logger.error('realOemSource failed', { error: e });
            return [];
        }
    },
};

function calculateRelevance(oem: string, query: string, html: string): number {
    let score = 0.5; // Base score

    // Check if OEM appears near relevant keywords
    const context = getContextAroundOem(html, oem, 200);

    const keywords = ['brake', 'brems', 'disc', 'scheibe', 'pad', 'belag',
        'filter', 'oil', 'öl', 'air', 'luft', 'spark', 'zünd',
        'shock', 'stoß', 'spring', 'feder', 'arm', 'lenker'];

    for (const keyword of keywords) {
        if (query.includes(keyword) && context.toLowerCase().includes(keyword)) {
            score += 0.1;
        }
    }

    // Limit to 1.0
    return Math.min(score, 1.0);
}

function getContextAroundOem(html: string, oem: string, chars: number): string {
    const index = html.indexOf(oem);
    if (index === -1) return '';

    const start = Math.max(0, index - chars);
    const end = Math.min(html.length, index + oem.length + chars);

    return html.substring(start, end);
}

export default realOemSource;
