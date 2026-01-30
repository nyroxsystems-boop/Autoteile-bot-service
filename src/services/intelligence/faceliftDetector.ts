/**
 * 🔄 FACELIFT DETECTOR - Pre/Post Facelift OEM Resolution
 * 
 * Same model name can have different OEMs before and after facelift.
 * Critical for:
 * - Headlights/Taillights (completely different design)
 * - Bumpers/Grilles (styling changes)
 * - Infotainment systems (technology upgrades)
 * - Some body panels (subtle dimension changes)
 * 
 * Facelift typically occurs ~3-4 years into a model cycle.
 */

import { logger } from "@utils/logger";

// ============================================================================
// Facelift Types
// ============================================================================

export type FaceliftStatus = 'PRE_FL' | 'POST_FL' | 'MOPF' | 'LCI' | 'UNKNOWN';

export interface ModelGeneration {
    code: string;           // Internal code (e.g., "5G" for Golf 7)
    name: string;           // Common name (e.g., "Golf 7")
    brand: string;
    startYear: number;
    endYear: number;
    faceliftYear?: number;  // Year when facelift was introduced
    faceliftMonth?: number; // Month (for precision)
    generations: {
        pre: { start: number; end: number };
        post?: { start: number; end: number };
    };
    notes?: string;
}

// ============================================================================
// VAG Model Database
// ============================================================================

const VAG_MODELS: ModelGeneration[] = [
    // =========================================================================
    // VOLKSWAGEN
    // =========================================================================
    {
        code: '5G',
        name: 'Golf 7',
        brand: 'VOLKSWAGEN',
        startYear: 2012,
        endYear: 2020,
        faceliftYear: 2017,
        faceliftMonth: 1,
        generations: {
            pre: { start: 2012, end: 2016 },
            post: { start: 2017, end: 2020 },
        },
        notes: 'Facelift bringt neue LED-Scheinwerfer, Active Info Display',
    },
    {
        code: 'CD',
        name: 'Golf 8',
        brand: 'VOLKSWAGEN',
        startYear: 2019,
        endYear: 2026,
        faceliftYear: 2024,
        generations: {
            pre: { start: 2019, end: 2023 },
            post: { start: 2024, end: 2026 },
        },
    },
    {
        code: 'B8',
        name: 'Passat B8',
        brand: 'VOLKSWAGEN',
        startYear: 2014,
        endYear: 2023,
        faceliftYear: 2019,
        generations: {
            pre: { start: 2014, end: 2018 },
            post: { start: 2019, end: 2023 },
        },
    },
    {
        code: 'AD1',
        name: 'Tiguan 2',
        brand: 'VOLKSWAGEN',
        startYear: 2016,
        endYear: 2024,
        faceliftYear: 2020,
        generations: {
            pre: { start: 2016, end: 2019 },
            post: { start: 2020, end: 2024 },
        },
    },
    {
        code: 'AW',
        name: 'Polo 6',
        brand: 'VOLKSWAGEN',
        startYear: 2017,
        endYear: 2026,
        faceliftYear: 2021,
        generations: {
            pre: { start: 2017, end: 2020 },
            post: { start: 2021, end: 2026 },
        },
    },
    {
        code: 'T6',
        name: 'Transporter T6',
        brand: 'VOLKSWAGEN',
        startYear: 2015,
        endYear: 2019,
        faceliftYear: 2019,
        generations: {
            pre: { start: 2015, end: 2018 },
            post: { start: 2019, end: 2019 },
        },
        notes: 'T6.1 wird oft als eigene Generation geführt',
    },

    // =========================================================================
    // AUDI
    // =========================================================================
    {
        code: '8V',
        name: 'A3 8V',
        brand: 'AUDI',
        startYear: 2012,
        endYear: 2020,
        faceliftYear: 2016,
        generations: {
            pre: { start: 2012, end: 2015 },
            post: { start: 2016, end: 2020 },
        },
    },
    {
        code: '8Y',
        name: 'A3 8Y',
        brand: 'AUDI',
        startYear: 2020,
        endYear: 2026,
        generations: {
            pre: { start: 2020, end: 2026 },
        },
    },
    {
        code: 'B9',
        name: 'A4 B9',
        brand: 'AUDI',
        startYear: 2015,
        endYear: 2024,
        faceliftYear: 2019,
        generations: {
            pre: { start: 2015, end: 2018 },
            post: { start: 2019, end: 2024 },
        },
    },
    {
        code: 'C8',
        name: 'A6 C8',
        brand: 'AUDI',
        startYear: 2018,
        endYear: 2026,
        faceliftYear: 2023,
        generations: {
            pre: { start: 2018, end: 2022 },
            post: { start: 2023, end: 2026 },
        },
    },
    {
        code: 'F3',
        name: 'Q3 F3',
        brand: 'AUDI',
        startYear: 2018,
        endYear: 2026,
        faceliftYear: 2024,
        generations: {
            pre: { start: 2018, end: 2023 },
            post: { start: 2024, end: 2026 },
        },
    },

    // =========================================================================
    // SKODA
    // =========================================================================
    {
        code: '5E',
        name: 'Octavia 3',
        brand: 'SKODA',
        startYear: 2012,
        endYear: 2020,
        faceliftYear: 2017,
        generations: {
            pre: { start: 2012, end: 2016 },
            post: { start: 2017, end: 2020 },
        },
    },
    {
        code: 'NX',
        name: 'Octavia 4',
        brand: 'SKODA',
        startYear: 2019,
        endYear: 2026,
        generations: {
            pre: { start: 2019, end: 2026 },
        },
    },
    {
        code: 'NS',
        name: 'Kodiaq',
        brand: 'SKODA',
        startYear: 2016,
        endYear: 2026,
        faceliftYear: 2021,
        generations: {
            pre: { start: 2016, end: 2020 },
            post: { start: 2021, end: 2026 },
        },
    },

    // =========================================================================
    // SEAT / CUPRA
    // =========================================================================
    {
        code: '5F',
        name: 'Leon 3',
        brand: 'SEAT',
        startYear: 2012,
        endYear: 2020,
        faceliftYear: 2017,
        generations: {
            pre: { start: 2012, end: 2016 },
            post: { start: 2017, end: 2020 },
        },
    },
    {
        code: 'KL',
        name: 'Leon 4',
        brand: 'CUPRA',
        startYear: 2020,
        endYear: 2026,
        generations: {
            pre: { start: 2020, end: 2026 },
        },
    },
];

// ============================================================================
// BMW Model Database (LCI = Life Cycle Impulse = Facelift)
// ============================================================================

const BMW_MODELS: ModelGeneration[] = [
    {
        code: 'F30',
        name: '3er F30',
        brand: 'BMW',
        startYear: 2011,
        endYear: 2019,
        faceliftYear: 2015,
        generations: {
            pre: { start: 2011, end: 2014 },
            post: { start: 2015, end: 2019 },
        },
        notes: 'LCI mit LED-Scheinwerfer Standard',
    },
    {
        code: 'G20',
        name: '3er G20',
        brand: 'BMW',
        startYear: 2018,
        endYear: 2026,
        faceliftYear: 2022,
        generations: {
            pre: { start: 2018, end: 2021 },
            post: { start: 2022, end: 2026 },
        },
    },
    {
        code: 'F10',
        name: '5er F10',
        brand: 'BMW',
        startYear: 2010,
        endYear: 2017,
        faceliftYear: 2013,
        generations: {
            pre: { start: 2010, end: 2012 },
            post: { start: 2013, end: 2017 },
        },
    },
    {
        code: 'G30',
        name: '5er G30',
        brand: 'BMW',
        startYear: 2016,
        endYear: 2024,
        faceliftYear: 2020,
        generations: {
            pre: { start: 2016, end: 2019 },
            post: { start: 2020, end: 2024 },
        },
    },
    {
        code: 'F15',
        name: 'X5 F15',
        brand: 'BMW',
        startYear: 2013,
        endYear: 2018,
        faceliftYear: 2016,
        generations: {
            pre: { start: 2013, end: 2015 },
            post: { start: 2016, end: 2018 },
        },
    },
];

// ============================================================================
// Combined Model Database
// ============================================================================

const ALL_MODELS = [...VAG_MODELS, ...BMW_MODELS];

// ============================================================================
// Detection Functions
// ============================================================================

export interface FaceliftResult {
    detected: boolean;
    model?: ModelGeneration;
    status: FaceliftStatus;
    year: number;
    confidence: number;
    note?: string;
}

/**
 * Detect facelift status based on model name and year
 */
export function detectFacelift(
    brand: string,
    modelName: string,
    year: number,
    month?: number
): FaceliftResult {
    const normalizedBrand = brand.toUpperCase();
    const normalizedModel = modelName.toLowerCase();

    // Find matching model
    let matchedModel: ModelGeneration | undefined;

    for (const model of ALL_MODELS) {
        if (model.brand.toUpperCase() !== normalizedBrand) continue;

        const modelMatch =
            model.name.toLowerCase().includes(normalizedModel) ||
            normalizedModel.includes(model.name.toLowerCase()) ||
            model.code.toLowerCase() === normalizedModel;

        if (modelMatch && year >= model.startYear && year <= model.endYear) {
            matchedModel = model;
            break;
        }
    }

    if (!matchedModel) {
        return {
            detected: false,
            status: 'UNKNOWN',
            year,
            confidence: 0,
            note: `Kein Modell-Match für ${brand} ${modelName} ${year}`,
        };
    }

    // Determine facelift status
    let status: FaceliftStatus = 'PRE_FL';
    let confidence = 0.9;

    if (!matchedModel.faceliftYear) {
        // No facelift for this model (yet)
        status = 'PRE_FL';
        confidence = 1.0;
    } else if (year < matchedModel.faceliftYear) {
        status = 'PRE_FL';
        confidence = 1.0;
    } else if (year > matchedModel.faceliftYear) {
        status = 'POST_FL';
        confidence = 1.0;
    } else {
        // Facelift year - need month for precision
        if (month !== undefined) {
            const flMonth = matchedModel.faceliftMonth || 6; // Assume mid-year if unknown
            status = month < flMonth ? 'PRE_FL' : 'POST_FL';
            confidence = 0.85;
        } else {
            // Unknown month in facelift year - could be either
            status = 'UNKNOWN';
            confidence = 0.5;
        }
    }

    // BMW uses LCI terminology
    if (matchedModel.brand === 'BMW' && status === 'POST_FL') {
        status = 'LCI';
    }

    // Mercedes uses MOPF (Modellpflege) terminology
    if (matchedModel.brand.includes('MERCEDES') && status === 'POST_FL') {
        status = 'MOPF';
    }

    logger.info("[Facelift] Detection result", {
        brand,
        model: modelName,
        year,
        status,
        confidence,
    });

    return {
        detected: true,
        model: matchedModel,
        status,
        year,
        confidence,
        note: matchedModel.notes,
    };
}

/**
 * Get model generation info
 */
export function getModelInfo(
    brand: string,
    modelName: string
): ModelGeneration[] {
    const normalizedBrand = brand.toUpperCase();
    const normalizedModel = modelName.toLowerCase();

    return ALL_MODELS.filter(model => {
        if (model.brand.toUpperCase() !== normalizedBrand) return false;
        return model.name.toLowerCase().includes(normalizedModel) ||
            normalizedModel.includes(model.name.toLowerCase());
    });
}

/**
 * Check if a part is facelift-sensitive
 */
export function isFaceliftSensitivePart(category: string): boolean {
    const sensitiveParts = [
        'HEADLIGHT', 'TAILLIGHT', 'FRONT_BUMPER', 'REAR_BUMPER',
        'GRILLE', 'RADIATOR_GRILLE', 'DASHBOARD', 'INFOTAINMENT',
        'STEERING_WHEEL', 'INSTRUMENT_CLUSTER', 'MIRROR', 'FENDER',
    ];

    return sensitiveParts.includes(category.toUpperCase());
}

// ============================================================================
// Export
// ============================================================================

export default {
    detectFacelift,
    getModelInfo,
    isFaceliftSensitivePart,
    VAG_MODELS,
    BMW_MODELS,
};
