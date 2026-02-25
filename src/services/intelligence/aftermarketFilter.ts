/**
 * 🛡️ AFTERMARKET FILTER — Pre-Consensus Junk Removal
 *
 * Filters out known aftermarket reference numbers BEFORE they enter
 * the Consensus Engine. This prevents "hallucination majorities" where
 * multiple scrapers return the same aftermarket code as if it were an OEM.
 *
 * Aftermarket numbers are from brands like TRW, ATE, BOSCH, FEBI, etc.
 * They are valid product codes but NOT original equipment manufacturer numbers.
 */

import { OEMCandidate } from './sources/baseSource';
import { logger } from '@utils/logger';

// ============================================================================
// Known Aftermarket Brand Prefixes
// ============================================================================

/**
 * Common aftermarket brand prefixes and codes.
 * These appear on scraper results and must not be confused with OEM numbers.
 */
const AFTERMARKET_PREFIXES: string[] = [
    // Brake specialists
    'TRW', 'ATE', 'BREMBO', 'EBC', 'ZIMMERMANN', 'TEXTAR',
    // General aftermarket
    'BOSCH', 'FEBI', 'LEMFORDER', 'LEMFÖRDER', 'MEYLE', 'MAPCO', 'MOOG',
    'SACHS', 'LUK', 'LuK', 'VALEO', 'FAG', 'INA', 'SNR',
    // Ignition / Engine
    'NGK', 'DENSO', 'BERU', 'CHAMPION',
    // Filters
    'MANN', 'HENGST', 'MAHLE', 'KNECHT', 'PURFLUX', 'FILTRON',
    // Suspension
    'BILSTEIN', 'KAYABA', 'KYB', 'MONROE', 'SACHS',
    // Cooling
    'BEHR', 'HELLA', 'NISSENS', 'NRF',
    // Aftermarket reference standards
    'WVA', 'OE', 'REF',
    // Other common aftermarket
    'SWAG', 'TOPRAN', 'OPTIMAL', 'DAYCO', 'GATES', 'CONTITECH',
    'DELPHI', 'CARDONE', 'DORMAN', 'SKF', 'ELRING',
];

/**
 * Full aftermarket article number patterns.
 * These regex patterns match common aftermarket numbering schemes.
 */
const AFTERMARKET_PATTERNS: RegExp[] = [
    /^WVA\s?\d{4,5}$/i,           // WVA brake standard (e.g., WVA 24647)
    /^GDB\d{3,5}$/i,              // TRW brake code
    /^DF\d{4,6}$/i,               // TRW disc code
    /^0\s?\d{3}\s?\d{3}\s?\d{3}$/i, // BOSCH-style 10-digit
    /^F\s?\d{3}\s?\d{3}\s?\d{3}$/i, // BOSCH fuel/filter codes
    /^[A-Z]{2,4}\d{3,6}$/i,       // Generic aftermarket (e.g., MDB1234)
];

// Pre-compute a lowercase set for fast lookup
const AFTERMARKET_PREFIXES_LOWER = new Set(
    AFTERMARKET_PREFIXES.map(p => p.toLowerCase())
);

// ============================================================================
// Detection Functions
// ============================================================================

/**
 * Check if an OEM candidate looks like an aftermarket reference number.
 */
export function isAftermarketNumber(oem: string): boolean {
    if (!oem || oem.length < 3) return false;

    const normalized = oem.trim().toUpperCase();

    // Check prefix match: "BOSCH0250201048" → prefix "BOSCH"
    for (const prefix of AFTERMARKET_PREFIXES) {
        if (normalized.startsWith(prefix.toUpperCase())) {
            return true;
        }
    }

    // Check if the number contains an aftermarket brand name
    const lower = normalized.toLowerCase();
    for (const prefix of AFTERMARKET_PREFIXES_LOWER) {
        if (prefix.length >= 3 && lower.includes(prefix)) {
            return true;
        }
    }

    // Check pattern matches
    for (const pattern of AFTERMARKET_PATTERNS) {
        if (pattern.test(normalized)) {
            return true;
        }
    }

    return false;
}

/**
 * Filter aftermarket candidates from a list BEFORE consensus calculation.
 * Returns only candidates that look like genuine OEM numbers.
 */
export function filterAftermarketCandidates(candidates: OEMCandidate[]): OEMCandidate[] {
    const filtered: OEMCandidate[] = [];
    let removedCount = 0;

    for (const candidate of candidates) {
        if (isAftermarketNumber(candidate.oem)) {
            removedCount++;
            logger.debug('[AftermarketFilter] Removed aftermarket candidate', {
                oem: candidate.oem,
                source: candidate.source,
            });
        } else {
            filtered.push(candidate);
        }
    }

    if (removedCount > 0) {
        logger.info(`[AftermarketFilter] Removed ${removedCount} aftermarket numbers from ${candidates.length} candidates`);
    }

    return filtered;
}
