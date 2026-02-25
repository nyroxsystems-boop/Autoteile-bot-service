/**
 * 🏷️ BRAND PATTERN REGISTRY
 *
 * Consolidated OEM number schema validation for all car brands.
 * Previously duplicated in oemResolver.ts (checkBrandSchema) and
 * consensusEngine.ts (validateBrandPattern).
 *
 * Each brand has known OEM number formats (length, prefix, regex).
 * Returns a normalized 0.0–1.0 score indicating match quality.
 */

// ============================================================================
// Types
// ============================================================================

export interface BrandPatternConfig {
    /** Regex patterns that indicate a strong match (score = 1.0) */
    strongPatterns: RegExp[];
    /** Acceptable OEM length range [min, max] for a weak match (score = 0.5) */
    lengthRange: [number, number];
    /** Additional brand names that share this schema */
    aliases: string[];
}

// ============================================================================
// Pattern Database
// ============================================================================

const BRAND_PATTERNS: Record<string, BrandPatternConfig> = {
    // VAG Group (VW, Audi, Seat, Skoda, Cupra)
    VAG: {
        strongPatterns: [
            /^[A-Z0-9]{2,3}[0-9]{6}[A-Z]{0,2}$/,   // 5Q0698151A, 1K0615301AA
            /^[0-9][A-Z0-9]{8,11}$/,                  // 1K0698151A format
        ],
        lengthRange: [9, 12],
        aliases: ['VW', 'VOLKSWAGEN', 'AUDI', 'SEAT', 'SKODA', 'CUPRA'],
    },

    BMW: {
        strongPatterns: [
            /^[0-9]{11}$/,  // 34116860264 (standard 11-digit)
            /^[0-9]{7}$/,   // 1234567 (short format)
        ],
        lengthRange: [7, 11],
        aliases: ['BMW', 'MINI'],
    },

    MERCEDES: {
        strongPatterns: [
            /^A[0-9]{10,12}$/,    // A2054201220
            /^[BWNR][0-9]{9,12}$/,// B/W/N/R prefix formats
            /^[0-9]{10,12}$/,      // Pure numeric (old format)
        ],
        lengthRange: [10, 13],
        aliases: ['MERCEDES', 'BENZ', 'SMART', 'DAIMLER'],
    },

    PORSCHE: {
        strongPatterns: [
            /^[Pp][0-9]{6,9}$/,     // P-prefix
            /^[0-9]{3}[A-Z0-9]{6,9}$/, // Numeric prefix
        ],
        lengthRange: [7, 12],
        aliases: ['PORSCHE'],
    },

    FORD: {
        strongPatterns: [
            /^[0-9]{7}$/,                              // FINIS 7-digit
            /^[A-Z0-9]{4}-[A-Z0-9]{4,6}-[A-Z]{1,2}$/, // Engineering format
        ],
        lengthRange: [7, 15],
        aliases: ['FORD'],
    },

    OPEL: {
        strongPatterns: [
            /^[0-9]{7,8}$/,    // 7-8 digit catalog
            /^[0-9]{10}$/,     // GM 10-digit
        ],
        lengthRange: [6, 10],
        aliases: ['OPEL', 'VAUXHALL', 'GM', 'CHEVROLET'],
    },

    RENAULT: {
        strongPatterns: [
            /^[0-9R]{10}$/,              // Renault 10-digit
            /^[A-Z0-9]{5}-[A-Z0-9]{5}$/, // Nissan 5+5
            /^[0-9]{10,12}$/,             // Long numeric
        ],
        lengthRange: [8, 12],
        aliases: ['RENAULT', 'DACIA', 'NISSAN'],
    },

    FIAT: {
        strongPatterns: [
            /^[0-9]{8}$/,  // Fiat 8-digit
        ],
        lengthRange: [7, 10],
        aliases: ['FIAT', 'ALFA', 'ALFA ROMEO', 'LANCIA', 'CHRYSLER'],
    },

    TOYOTA: {
        strongPatterns: [
            /^[0-9]{5}-[0-9]{5}$/,  // 5+5 dashed
            /^[0-9]{10}$/,           // Compact
        ],
        lengthRange: [9, 12],
        aliases: ['TOYOTA', 'LEXUS'],
    },

    HYUNDAI: {
        strongPatterns: [
            /^[A-Z0-9]{5}[A-Z0-9]{5}$/,   // 10-char alphanumeric
            /^[0-9]{5}-[A-Z0-9]{5}$/,       // Dashed format
        ],
        lengthRange: [9, 12],
        aliases: ['HYUNDAI', 'KIA', 'GENESIS'],
    },

    PSA: {
        strongPatterns: [
            /^[0-9]{10}$/,                   // 10-digit numeric
            /^[A-Z0-9]{4}\.[A-Z0-9]{6}$/,   // 4.6 dotted
        ],
        lengthRange: [4, 12],
        aliases: ['PEUGEOT', 'CITROEN', 'CITROËN', 'DS', 'PSA'],
    },

    HONDA: {
        strongPatterns: [
            /^[0-9]{8}$/,                         // 8-digit
            /^[0-9]{4}-[A-Z0-9]{3,4}-[0-9]{3}$/,  // Dashed format
            /^[0-9]{5}-[A-Z0-9]{3}-[A-Z0-9]{3}$/, // Alt format
        ],
        lengthRange: [7, 14],
        aliases: ['HONDA', 'ACURA'],
    },

    SUBARU: {
        strongPatterns: [
            /^S?[0-9]{7,8}$/,  // Optional S prefix + 7-8 digits
        ],
        lengthRange: [7, 12],
        aliases: ['SUBARU'],
    },

    MITSUBISHI: {
        strongPatterns: [
            /^M?[0-9]{7,9}$/,  // Optional M prefix + 7-9 digits
        ],
        lengthRange: [7, 12],
        aliases: ['MITSUBISHI'],
    },

    DODGE: {
        strongPatterns: [
            /^[0-9]{7,8}$/,
            /^[A-Z0-9]{4}-[A-Z0-9]{4,6}-[A-Z]{1,2}$/,
        ],
        lengthRange: [7, 15],
        aliases: ['DODGE', 'RAM', 'JEEP'],
    },

    MAZDA: {
        strongPatterns: [
            /^[A-Z]{4}-[0-9]{2}-[0-9]{3}[A-Z]?$/,  // KD5A-33-28ZA style
            /^[A-Z]{2,4}[0-9]{2}[0-9-]{2,6}$/,       // Compact
        ],
        lengthRange: [7, 14],
        aliases: ['MAZDA'],
    },

    VOLVO: {
        strongPatterns: [
            /^[0-9]{7,8}$/,    // 7-8 digit numeric
            /^[0-9]{10}$/,      // 10-digit
        ],
        lengthRange: [7, 10],
        aliases: ['VOLVO'],
    },
};

// ============================================================================
// Lookup helpers
// ============================================================================

/** Fast reverse index: alias → config */
const ALIAS_MAP = new Map<string, BrandPatternConfig>();
for (const config of Object.values(BRAND_PATTERNS)) {
    for (const alias of config.aliases) {
        ALIAS_MAP.set(alias.toUpperCase(), config);
    }
}

function findConfig(brand: string): BrandPatternConfig | undefined {
    const upper = brand.toUpperCase();

    // Direct match
    if (ALIAS_MAP.has(upper)) return ALIAS_MAP.get(upper);

    // Partial match (e.g. "MERCEDES-BENZ" contains "MERCEDES")
    for (const [alias, config] of ALIAS_MAP.entries()) {
        if (upper.includes(alias) || alias.includes(upper)) {
            return config;
        }
    }

    return undefined;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Validate an OEM number against a brand's known patterns.
 *
 * Returns a normalized 0.0–1.0 score:
 * - 1.0: Strong pattern match (regex)
 * - 0.5: Length-acceptable but no regex match (weak match)
 * - 0.2: Doesn't match expected pattern at all
 * - 0.5: Unknown brand (neutral)
 */
export function validateOemPattern(oem: string, brand: string): number {
    if (!oem || !brand) return 0;

    const normalized = oem.replace(/[\s.\-]/g, '').toUpperCase();
    const config = findConfig(brand);

    if (!config) return 0.5; // Unknown brand → neutral

    // Strong match
    for (const pattern of config.strongPatterns) {
        if (pattern.test(normalized)) return 1.0;
    }

    // Weak match (length ok but no pattern match)
    if (normalized.length >= config.lengthRange[0] && normalized.length <= config.lengthRange[1]) {
        return 0.5;
    }

    return 0.2; // Doesn't match
}

/**
 * Same function but returns 0–2 integer scale for backward compatibility
 * with oemResolver.ts checkBrandSchema.
 */
export function validateOemPatternInt(oem: string, brand: string): number {
    const score = validateOemPattern(oem, brand);
    if (score >= 0.9) return 2;
    if (score >= 0.4) return 1;
    return 0;
}

/**
 * Get all known brand aliases
 */
export function getKnownBrands(): string[] {
    return Array.from(ALIAS_MAP.keys());
}

export default {
    validateOemPattern,
    validateOemPatternInt,
    getKnownBrands,
};
