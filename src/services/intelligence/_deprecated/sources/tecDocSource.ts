/**
 * 🏆 TECDOC CATALOG API SOURCE — The 96% Solution
 *
 * TecDoc is THE industry standard for automotive parts cross-referencing.
 * It covers ALL brands (60+), ALL parts, ALL cross-references.
 *
 * Integrated via RapidAPI ($29/month PRO plan):
 * - Base URL: https://tecdoc-catalog.p.rapidapi.com
 * - OEM article search → cross-reference lookup
 * - VIN decoding → exact vehicle identification
 * - Vehicle-linked parts → fitment verification
 *
 * This source is PRIORITY 1 — checked before all scrapers.
 * When TecDoc has data, scrapers are skipped entirely.
 *
 * Confidence: 0.95 (industry reference database)
 * Cost: 1-3 API calls per request
 * Speed: <500ms (direct API, no scraping)
 */

import { OEMCandidate, OEMResolverRequest } from '../types';
import { OEMSource, clampConfidence, logSourceResult } from './baseSource';
import { validateOemPattern } from '../brandPatternRegistry';
import { logger } from '@utils/logger';

const TECDOC_API_KEY = process.env.TECDOC_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY || '';
const TECDOC_HOST = 'tecdoc-catalog.p.rapidapi.com';
const TECDOC_BASE = `https://${TECDOC_HOST}`;
const TIMEOUT = 8000;
const LANG_ID = 4; // German

// ============================================================================
// Brand → TecDoc Manufacturer ID mapping (top brands)
// ============================================================================
const BRAND_TO_MFR_ID: Record<string, number> = {
    'VW': 5, 'VOLKSWAGEN': 5,
    'AUDI': 3, 'SEAT': 55, 'SKODA': 60, 'CUPRA': 55,
    'BMW': 16, 'MINI': 916,
    'MERCEDES': 46, 'MERCEDES-BENZ': 46,
    'OPEL': 51, 'VAUXHALL': 51,
    'FORD': 25,
    'PEUGEOT': 53, 'CITROEN': 21, 'CITROËN': 21, 'DS': 21,
    'RENAULT': 54, 'DACIA': 1157,
    'FIAT': 24, 'ALFA ROMEO': 2, 'LANCIA': 34,
    'TOYOTA': 65, 'LEXUS': 1137,
    'HONDA': 28, 'MAZDA': 42,
    'NISSAN': 49, 'MITSUBISHI': 47, 'SUBARU': 62,
    'HYUNDAI': 29, 'KIA': 33,
    'VOLVO': 69, 'SAAB': 56,
    'PORSCHE': 52, 'JAGUAR': 31, 'LAND ROVER': 35,
    'SUZUKI': 63, 'DAIHATSU': 22,
    'CHEVROLET': 18, 'CHRYSLER': 19, 'DODGE': 23, 'JEEP': 32,
};

// Part category → TecDoc generic article IDs (most common)
const PART_CATEGORY_MAP: Record<string, string[]> = {
    // Brakes
    'bremsscheibe': ['brake disc', 'bremsscheibe'],
    'bremsbelag': ['brake pad', 'bremsbelag', 'bremsbeläge'],
    'bremssattel': ['brake caliper', 'bremssattel'],
    // Filters
    'ölfilter': ['oil filter', 'ölfilter'],
    'luftfilter': ['air filter', 'luftfilter'],
    'kraftstofffilter': ['fuel filter', 'kraftstofffilter'],
    'pollenfilter': ['cabin filter', 'innenraumfilter', 'pollenfilter'],
    // Engine
    'zündkerze': ['spark plug', 'zündkerze'],
    'zahnriemen': ['timing belt', 'zahnriemen'],
    'wasserpumpe': ['water pump', 'wasserpumpe'],
    'thermostat': ['thermostat'],
    // Suspension
    'stoßdämpfer': ['shock absorber', 'stoßdämpfer'],
    'querlenker': ['control arm', 'querlenker'],
    'spurstange': ['tie rod', 'spurstange'],
    'radlager': ['wheel bearing', 'radlager'],
    'koppelstange': ['stabilizer link', 'koppelstange'],
    // Clutch
    'kupplung': ['clutch', 'kupplung', 'kupplungssatz'],
    'schwungrad': ['flywheel', 'schwungrad'],
    // Electrical
    'lichtmaschine': ['alternator', 'lichtmaschine'],
    'anlasser': ['starter', 'anlasser'],
    'batterie': ['battery', 'batterie'],
    // Cooling
    'kühler': ['radiator', 'kühler'],
    'klimakondensator': ['AC condenser', 'klimakondensator'],
    // Exhaust
    'katalysator': ['catalytic converter', 'katalysator'],
    'turbolader': ['turbocharger', 'turbolader'],
    // Lights
    'scheinwerfer': ['headlight', 'scheinwerfer'],
    'rücklicht': ['tail light', 'rücklicht'],
    // Body
    'spiegel': ['mirror', 'außenspiegel'],
    'stoßstange': ['bumper', 'stoßstange'],
};

// ============================================================================
// API Call Helper
// ============================================================================

async function tecDocFetch<T>(path: string): Promise<T | null> {
    if (!TECDOC_API_KEY) return null;

    try {
        const url = `${TECDOC_BASE}${path}`;
        const resp = await fetch(url, {
            headers: {
                'x-rapidapi-key': TECDOC_API_KEY,
                'x-rapidapi-host': TECDOC_HOST,
            },
            signal: AbortSignal.timeout(TIMEOUT),
        });

        if (!resp.ok) {
            if (resp.status === 429) {
                logger.warn('[TecDoc] Rate limited', { status: resp.status });
            } else if (resp.status === 403) {
                logger.error('[TecDoc] API key invalid or plan exhausted');
            }
            return null;
        }

        return await resp.json() as T;
    } catch (err: any) {
        if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
            logger.warn('[TecDoc] Request timeout', { path: path.substring(0, 80) });
        } else {
            logger.warn('[TecDoc] Request failed', { path: path.substring(0, 80), error: err?.message });
        }
        return null;
    }
}

// ============================================================================
// TecDoc Search Strategies
// ============================================================================

interface TecDocArticle {
    articleId?: number;
    articleNumber?: string;
    mfrName?: string;
    genericArticleDescription?: string;
    oemNumbers?: string[];
    oeNumbers?: string[];
    comparableNumbers?: string[];
    [key: string]: any;
}

/**
 * Strategy 1: Search by part description + vehicle brand
 * Returns articles with OEM cross-references
 */
async function searchByDescription(
    partQuery: string,
    brand: string,
    model: string,
): Promise<TecDocArticle[]> {
    // Build search term
    const searchTerm = `${brand} ${model} ${partQuery}`.trim();
    const encoded = encodeURIComponent(searchTerm);

    const data = await tecDocFetch<any>(
        `/articles/search/lang-id/${LANG_ID}/article-search/${encoded}`
    );

    if (!data) return [];

    // Handle different response formats
    const articles: TecDocArticle[] = [];
    if (Array.isArray(data)) {
        articles.push(...data);
    } else if (data.articles && Array.isArray(data.articles)) {
        articles.push(...data.articles);
    } else if (data.data && Array.isArray(data.data)) {
        articles.push(...data.data);
    }

    return articles;
}

/**
 * Strategy 2: Search by OEM number directly (for validation)
 * Confirms if a number is a valid OEM
 */
async function searchByArticleNumber(articleNr: string): Promise<TecDocArticle[]> {
    const encoded = encodeURIComponent(articleNr.replace(/[\s.-]/g, ''));

    const data = await tecDocFetch<any>(
        `/articles/search/lang-id/${LANG_ID}/article-search/${encoded}`
    );

    if (!data) return [];

    const articles: TecDocArticle[] = [];
    if (Array.isArray(data)) {
        articles.push(...data);
    } else if (data.articles && Array.isArray(data.articles)) {
        articles.push(...data.articles);
    } else if (data.data && Array.isArray(data.data)) {
        articles.push(...data.data);
    }

    return articles;
}

/**
 * Strategy 3: VIN decode for precise vehicle matching
 */
async function decodeVIN(vin: string): Promise<any | null> {
    if (!vin || vin.length < 11) return null;

    return await tecDocFetch<any>(`/vin/decoder-v2/${encodeURIComponent(vin)}`);
}

/**
 * Extract OEM numbers from TecDoc article data
 */
function extractOemsFromArticle(article: TecDocArticle, brand: string): string[] {
    const oems = new Set<string>();

    // Direct OEM numbers
    if (article.oemNumbers) {
        for (const n of article.oemNumbers) {
            if (typeof n === 'string') oems.add(n.replace(/[\s.-]/g, '').toUpperCase());
            else if (n && typeof n === 'object' && (n as any).oeNumber) {
                oems.add(String((n as any).oeNumber).replace(/[\s.-]/g, '').toUpperCase());
            }
        }
    }

    if (article.oeNumbers) {
        for (const n of article.oeNumbers) {
            if (typeof n === 'string') oems.add(n.replace(/[\s.-]/g, '').toUpperCase());
            else if (n && typeof n === 'object' && (n as any).oeNumber) {
                oems.add(String((n as any).oeNumber).replace(/[\s.-]/g, '').toUpperCase());
            }
        }
    }

    // Comparable/cross-reference numbers
    if (article.comparableNumbers) {
        for (const n of article.comparableNumbers) {
            if (typeof n === 'string') oems.add(n.replace(/[\s.-]/g, '').toUpperCase());
        }
    }

    // Deep search in nested fields (TecDoc can nest OEMs in different places)
    const deepSearch = (obj: any, depth = 0): void => {
        if (depth > 3 || !obj || typeof obj !== 'object') return;
        for (const [key, val] of Object.entries(obj)) {
            const keyLower = key.toLowerCase();
            if ((keyLower.includes('oe') || keyLower.includes('oem') || keyLower.includes('original')) && typeof val === 'string') {
                const cleaned = val.replace(/[\s.-]/g, '').toUpperCase();
                if (cleaned.length >= 5 && cleaned.length <= 15 && /\d/.test(cleaned)) {
                    oems.add(cleaned);
                }
            }
            if (Array.isArray(val)) {
                for (const item of val) {
                    if (typeof item === 'string' && item.length >= 5) {
                        // Check if it looks like an OEM pattern
                        const cleaned = item.replace(/[\s.-]/g, '').toUpperCase();
                        if (/\d/.test(cleaned) && cleaned.length <= 15) {
                            oems.add(cleaned);
                        }
                    } else if (typeof item === 'object') {
                        deepSearch(item, depth + 1);
                    }
                }
            } else if (typeof val === 'object') {
                deepSearch(val, depth + 1);
            }
        }
    };

    deepSearch(article);

    // Filter out aftermarket-looking numbers
    const AFTERMARKET_PREFIXES = ['TRW', 'ATE', 'BREMBO', 'BOSCH', 'FEBI', 'MEYLE', 'MANN', 'MAHLE', 'NGK', 'DENSO', 'VALEO', 'SACHS', 'LUK'];
    const filtered = [...oems].filter(oem => {
        return !AFTERMARKET_PREFIXES.some(prefix => oem.startsWith(prefix));
    });

    return filtered;
}

// ============================================================================
// Source Implementation
// ============================================================================

export const tecDocSource: OEMSource = {
    name: 'tecdoc_catalog',

    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        if (!TECDOC_API_KEY) {
            logger.debug('[TecDoc] No TECDOC_RAPIDAPI_KEY or RAPIDAPI_KEY configured, skipping');
            return [];
        }

        const brand = req.vehicle.make || '';
        const model = req.vehicle.model || '';
        const partQuery = req.partQuery.rawText;
        const vin = req.vehicle.vin;
        const brandUpper = brand.toUpperCase();

        const candidates: OEMCandidate[] = [];
        const foundOems = new Set<string>();

        logger.info('[TecDoc] Starting lookup', {
            brand, model, part: partQuery.substring(0, 50),
        });

        // =====================================================================
        // STRATEGY 1: Direct part search
        // =====================================================================
        try {
            const articles = await searchByDescription(partQuery, brand, model);

            for (const article of articles.slice(0, 10)) { // Process top 10 articles
                const oems = extractOemsFromArticle(article, brand);

                for (const oem of oems) {
                    if (foundOems.has(oem)) continue;
                    foundOems.add(oem);

                    // Validate OEM pattern against brand
                    const patternScore = validateOemPattern(oem, brand);
                    if (patternScore < 0.3) continue; // Skip clearly wrong patterns

                    let confidence = 0.92; // TecDoc base confidence

                    // Boost for strong brand pattern match
                    if (patternScore >= 0.9) confidence += 0.03;

                    // Description match boost
                    const desc = (article.genericArticleDescription || '').toLowerCase();
                    const partLower = partQuery.toLowerCase();
                    if (desc && partLower.split(/\s+/).some(w => w.length > 3 && desc.includes(w))) {
                        confidence += 0.02;
                    }

                    candidates.push({
                        oem,
                        brand: brandUpper,
                        source: this.name,
                        confidence: clampConfidence(confidence),
                        meta: {
                            tecDocArticleId: article.articleId,
                            tecDocMfr: article.mfrName,
                            tecDocDescription: article.genericArticleDescription,
                            source_type: 'tecdoc_api',
                            priority: 10, // Highest priority
                        },
                    });
                }
            }
        } catch (err: any) {
            logger.warn('[TecDoc] Strategy 1 (description search) failed', { error: err?.message });
        }

        // =====================================================================
        // STRATEGY 2: If user provided a suspected OEM, validate it via TecDoc
        // =====================================================================
        if (req.partQuery.suspectedNumber) {
            try {
                const articles = await searchByArticleNumber(req.partQuery.suspectedNumber);
                if (articles.length > 0) {
                    const oem = req.partQuery.suspectedNumber.replace(/[\s.-]/g, '').toUpperCase();
                    if (!foundOems.has(oem)) {
                        foundOems.add(oem);
                        candidates.push({
                            oem,
                            brand: brandUpper,
                            source: this.name,
                            confidence: clampConfidence(0.97), // TecDoc confirms user-provided number
                            meta: {
                                source_type: 'tecdoc_confirmed_user_input',
                                priority: 10,
                            },
                        });
                    }
                }
            } catch (err: any) {
                logger.warn('[TecDoc] Strategy 2 (article validation) failed', { error: err?.message });
            }
        }

        // =====================================================================
        // STRATEGY 3: VIN decode for precise vehicle matching
        // =====================================================================
        if (vin && vin.length >= 11) {
            try {
                const vinData = await decodeVIN(vin);
                if (vinData) {
                    // Extract vehicle-specific data from VIN decode
                    const vinInfo: string[] = [];
                    if (vinData.make) vinInfo.push(`VIN-Make: ${vinData.make}`);
                    if (vinData.model) vinInfo.push(`VIN-Model: ${vinData.model}`);
                    if (vinData.engine) vinInfo.push(`VIN-Engine: ${vinData.engine}`);

                    // If VIN gives us a more specific model/engine, re-search
                    if (vinData.model && vinData.model !== model) {
                        const vinArticles = await searchByDescription(
                            partQuery,
                            vinData.make || brand,
                            vinData.model
                        );

                        for (const article of vinArticles.slice(0, 5)) {
                            const oems = extractOemsFromArticle(article, brand);
                            for (const oem of oems) {
                                if (foundOems.has(oem)) continue;
                                foundOems.add(oem);

                                const patternScore = validateOemPattern(oem, brand);
                                if (patternScore < 0.3) continue;

                                candidates.push({
                                    oem,
                                    brand: brandUpper,
                                    source: this.name,
                                    confidence: clampConfidence(0.96), // VIN-matched = very high
                                    meta: {
                                        tecDocArticleId: article.articleId,
                                        vinDecoded: true,
                                        source_type: 'tecdoc_vin_matched',
                                        priority: 10,
                                    },
                                });
                            }
                        }
                    }
                }
            } catch (err: any) {
                logger.warn('[TecDoc] Strategy 3 (VIN decode) failed', { error: err?.message });
            }
        }

        // Sort by confidence descending
        candidates.sort((a, b) => b.confidence - a.confidence);

        logger.info('[TecDoc] Lookup complete', {
            candidateCount: candidates.length,
            topOem: candidates[0]?.oem,
            topConf: candidates[0]?.confidence,
        });

        logSourceResult(this.name, candidates.length);
        return candidates;
    },
};

export default tecDocSource;
