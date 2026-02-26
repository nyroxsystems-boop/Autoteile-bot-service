/**
 * 🔄 AFTERMARKET → OEM REVERSE CROSS-REFERENCE
 *
 * The "Mini-TecDoc without TecDoc" strategy:
 * 
 * Scrapers often find aftermarket part numbers (BREMBO, BOSCH, TRW) instead
 * of OEM numbers. But aftermarket manufacturers ALWAYS list the OEM 
 * cross-references on their product pages and shop listings.
 *
 * Flow:
 * 1. Collect aftermarket numbers that other sources found
 * 2. Google: "[aftermarket-nr] OEM Vergleichsnummer"  
 * 3. Extract OEM numbers from the results
 * 4. Validate against brand pattern → high confidence (0.80-0.90)
 *
 * This is essentially what TecDoc does — cross-reference lookup — but free.
 */

import { OEMCandidate, OEMResolverRequest } from '../types';
import { OEMSource, clampConfidence, logSourceResult } from './baseSource';
import { validateOemPattern } from '../brandPatternRegistry';
import { isAftermarketNumber } from '../aftermarketFilter';
import { logger } from '@utils/logger';

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const CROSSREF_TIMEOUT = 12000;

// Common aftermarket brand names we can detect in other candidates
const AFTERMARKET_BRANDS = [
    'BREMBO', 'TRW', 'ATE', 'BOSCH', 'FEBI', 'MEYLE', 'LEMFÖRDER',
    'SACHS', 'LUK', 'VALEO', 'MANN', 'MAHLE', 'HENGST', 'KNECHT',
    'BILSTEIN', 'KYB', 'MONROE', 'NGK', 'DENSO', 'GATES', 'DAYCO',
    'CONTITECH', 'SKF', 'DELPHI', 'OPTIMAL', 'MAPCO', 'MOOG',
    'ZIMMERMANN', 'TEXTAR', 'EBC', 'PURFLUX', 'FILTRON', 'SWAG',
    'TOPRAN', 'FAG', 'INA', 'SNR', 'BEHR', 'HELLA', 'NISSENS',
];

/**
 * Extract aftermarket numbers from existing candidates.
 * These are numbers that were identified as aftermarket by the aftermarketFilter.
 */
function findAftermarketCandidates(allCandidates: OEMCandidate[]): string[] {
    const aftermarketNrs: string[] = [];

    for (const c of allCandidates) {
        // Check if candidate was tagged as aftermarket
        if (isAftermarketNumber(c.oem)) {
            aftermarketNrs.push(c.oem);
            continue;
        }

        // Check if source name hints at aftermarket
        if (c.source?.includes('aftermarket') || c.meta?.isAftermarket) {
            aftermarketNrs.push(c.oem);
        }
    }

    // Deduplicate
    return [...new Set(aftermarketNrs)];
}

/**
 * Search Google for OEM cross-references for an aftermarket part number.
 * Returns OEM numbers found in the search results.
 */
async function searchOemCrossReference(
    aftermarketNr: string,
    brand: string,
    model: string,
): Promise<{ oem: string; confidence: number }[]> {
    if (!SCRAPER_API_KEY) return [];

    const fetch = (await import('node-fetch')).default;
    const results: { oem: string; confidence: number }[] = [];

    try {
        // Search for OEM cross-reference
        const query = `"${aftermarketNr}" OEM OE Vergleichsnummer ${brand}`.trim();
        const googleUrl = `https://www.google.de/search?q=${encodeURIComponent(query)}&hl=de&num=10`;
        const scraperUrl = `http://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(googleUrl)}&country_code=de`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CROSSREF_TIMEOUT);

        const resp = await fetch(scraperUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!resp.ok) return [];

        const html = await resp.text();

        // Strip to visible text
        const visibleText = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ');

        // Look for OE/OEM section indicators
        const oeIndicators = [
            /OE[\s-]*(?:Nummer|Number|Nr|Teilenummer|Referenz|reference)/gi,
            /OEM[\s-]*(?:Nummer|Number|Nr|Teilenummer|Referenz)/gi,
            /Vergleichsnummer/gi,
            /Original[\s-]*(?:teil|nummer|number)/gi,
            /Herstellernummer/gi,
        ];

        // Find neighborhoods around OE indicators
        const neighborhoods: string[] = [];
        for (const indicator of oeIndicators) {
            let match;
            while ((match = indicator.exec(visibleText)) !== null) {
                const start = Math.max(0, match.index - 50);
                const end = Math.min(visibleText.length, match.index + 200);
                neighborhoods.push(visibleText.substring(start, end));
            }
        }

        // Also check the entire text for OEM-like patterns
        const fullText = neighborhoods.length > 0 ? neighborhoods.join(' ') : visibleText;

        // Extract OEM patterns based on brand
        const brandUpper = brand.toUpperCase();
        const extractedOems: Set<string> = new Set();

        // VAG patterns (5Q0615301F, 1K0698151A)
        if (['VW', 'VOLKSWAGEN', 'AUDI', 'SEAT', 'SKODA', 'CUPRA'].some(b => brandUpper.includes(b))) {
            const vagPattern = /\b([0-9A-Z]{2,3}[0-9]{6}[A-Z]{0,2})\b/g;
            let m;
            while ((m = vagPattern.exec(fullText)) !== null) {
                const candidate = m[1];
                if (candidate.length >= 9 && candidate.length <= 12) {
                    extractedOems.add(candidate);
                }
            }
        }

        // BMW patterns (11 digits)
        if (brandUpper.includes('BMW') || brandUpper.includes('MINI')) {
            const bmwPattern = /\b(\d{11})\b/g;
            let m;
            while ((m = bmwPattern.exec(fullText)) !== null) {
                extractedOems.add(m[1]);
            }
        }

        // Mercedes patterns (A + 10 digits)
        if (brandUpper.includes('MERCEDES') || brandUpper.includes('BENZ')) {
            const mercPattern = /\b([A-Z]\d{10,12})\b/g;
            let m;
            while ((m = mercPattern.exec(fullText)) !== null) {
                extractedOems.add(m[1]);
            }
        }

        // Generic: 7-12 char patterns near OE keywords
        if (neighborhoods.length > 0) {
            const genericPattern = /\b([A-Z0-9]{7,13})\b/g;
            const neighborhoodText = neighborhoods.join(' ');
            let m;
            while ((m = genericPattern.exec(neighborhoodText)) !== null) {
                const candidate = m[1];
                if (/\d/.test(candidate) && candidate.length >= 7) {
                    // Validate it's NOT the aftermarket number we searched for
                    if (candidate !== aftermarketNr.replace(/[\s.-]/g, '').toUpperCase()) {
                        extractedOems.add(candidate);
                    }
                }
            }
        }

        // Filter: remove the input aftermarket number itself
        const aftermarketNormalized = aftermarketNr.replace(/[\s.-]/g, '').toUpperCase();
        extractedOems.delete(aftermarketNormalized);

        // Filter: remove known aftermarket patterns
        for (const oem of extractedOems) {
            if (isAftermarketNumber(oem)) {
                extractedOems.delete(oem);
            }
        }

        // Score remaining candidates
        for (const oem of extractedOems) {
            const patternScore = validateOemPattern(oem, brand);

            if (patternScore >= 0.5) {
                let confidence = 0.70; // Base for cross-reference hit

                // Strong brand pattern match → boost
                if (patternScore >= 0.9) confidence += 0.10;

                // Found in OE section specifically → boost
                if (neighborhoods.length > 0) confidence += 0.05;

                results.push({ oem, confidence });
            }
        }

        logger.info('[CrossRef] Reverse lookup', {
            aftermarketNr,
            oemsFound: results.length,
            neighborhoods: neighborhoods.length,
        });

    } catch (err: any) {
        if (err?.name === 'AbortError') {
            logger.warn('[CrossRef] Timeout', { aftermarketNr });
        } else {
            logger.warn('[CrossRef] Failed', { aftermarketNr, error: err?.message });
        }
    }

    return results;
}

// ============================================================================
// Source Implementation
// ============================================================================

export const aftermarketCrossRefSource: OEMSource = {
    name: 'aftermarket_crossref',

    async resolveCandidates(_req: OEMResolverRequest): Promise<OEMCandidate[]> {
        // This source is NOT used as a regular source in the SOURCES array.
        // Instead, the resolver calls reverseAftermarketToOem() directly
        // as a second-pass after the aftermarket filter has identified
        // aftermarket numbers from the first-pass results.
        // This method exists only to satisfy the OEMSource interface.
        return [];
    },
};

/**
 * Standalone function for use in oemResolver's second-pass cascade.
 * Takes all candidates, finds aftermarket ones, and reverse-lookups their OEMs.
 */
export async function reverseAftermarketToOem(
    allCandidates: OEMCandidate[],
    brand: string,
    model: string,
): Promise<OEMCandidate[]> {
    const aftermarketNrs = findAftermarketCandidates(allCandidates);

    if (aftermarketNrs.length === 0) {
        logger.debug('[CrossRef] No aftermarket numbers to reverse-lookup');
        return [];
    }

    logger.info('[CrossRef] Starting reverse cascade', {
        aftermarketCount: aftermarketNrs.length,
        numbers: aftermarketNrs.slice(0, 3),
    });

    const results: OEMCandidate[] = [];

    // Process top 2 aftermarket numbers
    for (const amNr of aftermarketNrs.slice(0, 2)) {
        const oems = await searchOemCrossReference(amNr, brand, model);

        for (const { oem, confidence } of oems) {
            results.push({
                oem,
                source: 'aftermarket_crossref',
                confidence: clampConfidence(confidence),
                meta: {
                    note: `Reverse cross-ref from ${amNr}`,
                    aftermarketSource: amNr,
                    priority: 9,
                },
            });
        }
    }

    logger.info('[CrossRef] Reverse cascade complete', {
        inputAftermarket: aftermarketNrs.length,
        outputOems: results.length,
    });

    return results;
}

export default aftermarketCrossRefSource;
