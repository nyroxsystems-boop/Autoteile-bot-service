/**
 * 🚗 INCOMPLETE VEHICLE GUARD
 *
 * Prevents blind OEM scraping when vehicle data is insufficient.
 * E.g., user says "Golf" without generation/year — there are 8 generations
 * with completely different OEM numbers.
 *
 * Returns a follow-up question if vehicle data is too vague.
 */

import { logger } from '@utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface VehicleData {
    make?: string;
    model?: string;
    year?: number;
    engine?: string;
    hsn?: string;
    tsn?: string;
    vin?: string;
    motorcode?: string;
}

export interface VehicleGuardResult {
    isComplete: boolean;
    missingFields: string[];
    followUpQuestion?: string;
    confidence: number; // 0-1 how confident we are in the vehicle identification
}

// ============================================================================
// Model Ambiguity Database
// ============================================================================

/** Models that have multiple generations with different OEMs */
const AMBIGUOUS_MODELS: Record<string, { generations: string[]; yearRanges: string[] }> = {
    'golf': {
        generations: ['Golf 4 (1J)', 'Golf 5 (1K)', 'Golf 6 (5K)', 'Golf 7 (5G)', 'Golf 8 (CD)'],
        yearRanges: ['1997-2003', '2003-2008', '2008-2012', '2012-2020', '2019+'],
    },
    'passat': {
        generations: ['Passat B5', 'Passat B6 (3C)', 'Passat B7 (3C)', 'Passat B8 (3G)'],
        yearRanges: ['1996-2005', '2005-2010', '2010-2014', '2014+'],
    },
    'a3': {
        generations: ['A3 8L', 'A3 8P', 'A3 8V', 'A3 8Y'],
        yearRanges: ['1996-2003', '2003-2012', '2012-2020', '2020+'],
    },
    'a4': {
        generations: ['A4 B5', 'A4 B6', 'A4 B7', 'A4 B8', 'A4 B9'],
        yearRanges: ['1994-2001', '2001-2004', '2004-2008', '2008-2016', '2016+'],
    },
    'a6': {
        generations: ['A6 C5', 'A6 C6', 'A6 C7', 'A6 C8'],
        yearRanges: ['1997-2004', '2004-2011', '2011-2018', '2018+'],
    },
    '3er': {
        generations: ['E46', 'E90/E91', 'F30/F31', 'G20/G21'],
        yearRanges: ['1998-2005', '2005-2011', '2011-2019', '2019+'],
    },
    '5er': {
        generations: ['E39', 'E60/E61', 'F10/F11', 'G30/G31'],
        yearRanges: ['1996-2003', '2003-2010', '2010-2017', '2017+'],
    },
    'c-klasse': {
        generations: ['W203', 'W204', 'W205', 'W206'],
        yearRanges: ['2000-2007', '2007-2014', '2014-2021', '2021+'],
    },
    'e-klasse': {
        generations: ['W211', 'W212', 'W213', 'W214'],
        yearRanges: ['2002-2009', '2009-2016', '2016-2023', '2023+'],
    },
    'tiguan': {
        generations: ['Tiguan 1 (5N)', 'Tiguan 2 (AD)'],
        yearRanges: ['2007-2016', '2016+'],
    },
    't-roc': {
        generations: ['T-Roc (A11)'],
        yearRanges: ['2017+'],
    },
    'octavia': {
        generations: ['Octavia 1 (1U)', 'Octavia 2 (1Z)', 'Octavia 3 (5E)', 'Octavia 4 (NX)'],
        yearRanges: ['1996-2004', '2004-2013', '2013-2020', '2020+'],
    },
    'leon': {
        generations: ['Leon 1 (1M)', 'Leon 2 (1P)', 'Leon 3 (5F)', 'Leon 4 (KL)'],
        yearRanges: ['1999-2005', '2005-2012', '2012-2020', '2020+'],
    },
    'polo': {
        generations: ['Polo 9N', 'Polo 6R', 'Polo 6C', 'Polo AW'],
        yearRanges: ['2001-2009', '2009-2014', '2014-2017', '2017+'],
    },
    'x3': {
        generations: ['E83', 'F25', 'G01'],
        yearRanges: ['2003-2010', '2010-2017', '2017+'],
    },
    'x5': {
        generations: ['E53', 'E70', 'F15', 'G05'],
        yearRanges: ['1999-2006', '2006-2013', '2013-2018', '2018+'],
    },
    'corsa': {
        generations: ['Corsa C', 'Corsa D', 'Corsa E', 'Corsa F'],
        yearRanges: ['2000-2006', '2006-2014', '2014-2019', '2019+'],
    },
    'focus': {
        generations: ['Focus MK1', 'Focus MK2', 'Focus MK3', 'Focus MK4'],
        yearRanges: ['1998-2004', '2004-2010', '2010-2018', '2018+'],
    },
};

// ============================================================================
// Normalization
// ============================================================================

function normalizeModel(model?: string): string {
    if (!model) return '';
    return model
        .toLowerCase()
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function hasGeneration(model: string): boolean {
    const normalized = normalizeModel(model);

    // Check for generation codes: E90, F30, G20, W205, B8, 8V, etc.
    if (/\b[efg][0-9]{2}\b/i.test(normalized)) return true;
    if (/\b[wvx][0-9]{3}\b/i.test(normalized)) return true;
    if (/\bb[5-9]\b/i.test(normalized)) return true;
    if (/\b8[vpyl]\b/i.test(normalized)) return true;
    if (/\b(mk|mark)\s?[1-4]\b/i.test(normalized)) return true;
    if (/\b(1j|1k|5k|5g|cd|3c|3g|5n|ad|1z|5e|nx|1p|5f|kl)\b/i.test(normalized)) return true;
    if (/\b(facelift|fl|lci|mopf|vfl)\b/i.test(normalized)) return true;

    // Check for generation numbers in model name: "Golf 7", "3er E90"
    if (/\b(golf|polo|passat|a[3-8]|leon|octavia)\s*[1-9]\b/i.test(normalized)) return true;

    return false;
}

// ============================================================================
// Main Guard
// ============================================================================

/**
 * Check if vehicle data is complete enough for reliable OEM lookup.
 * Returns follow-up question if data is too vague.
 */
export function checkVehicleCompleteness(vehicle: VehicleData): VehicleGuardResult {
    const missing: string[] = [];
    let confidence = 0;

    // VIN or HSN/TSN are golden — if present, vehicle is fully identified
    if (vehicle.vin && vehicle.vin.length >= 17) {
        return { isComplete: true, missingFields: [], confidence: 1.0 };
    }
    if (vehicle.hsn && vehicle.tsn) {
        return { isComplete: true, missingFields: [], confidence: 0.95 };
    }

    // Make is required
    if (!vehicle.make) {
        missing.push('make');
    } else {
        confidence += 0.2;
    }

    // Model is required
    if (!vehicle.model) {
        missing.push('model');
    } else {
        confidence += 0.2;

        // Check if model is ambiguous (needs generation)
        const normalized = normalizeModel(vehicle.model);
        const baseModel = normalized.split(/\s+/)[0]; // "golf 7" → "golf"

        const ambiguity = AMBIGUOUS_MODELS[baseModel];
        if (ambiguity && !hasGeneration(vehicle.model)) {
            // Model is ambiguous without generation
            if (!vehicle.year) {
                missing.push('generation_or_year');
            } else {
                confidence += 0.3; // Year helps disambiguate
            }
        } else if (hasGeneration(vehicle.model)) {
            confidence += 0.3; // Has generation code
        }
    }

    // Year helps a lot
    if (vehicle.year) {
        confidence += 0.2;
    } else if (!missing.includes('generation_or_year')) {
        missing.push('year');
    }

    // Engine/motorcode is bonus
    if (vehicle.engine || vehicle.motorcode) {
        confidence += 0.1;
    }

    const isComplete = missing.length === 0 || confidence >= 0.6;

    let followUpQuestion: string | undefined;
    if (!isComplete) {
        followUpQuestion = buildFollowUpQuestion(vehicle, missing);
    }

    logger.debug('[VehicleGuard] Check result', {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        confidence,
        missing,
        isComplete,
    });

    return {
        isComplete,
        missingFields: missing,
        followUpQuestion,
        confidence: Math.min(confidence, 1.0),
    };
}

// ============================================================================
// Follow-up Question Builder
// ============================================================================

function buildFollowUpQuestion(vehicle: VehicleData, missing: string[]): string {
    const normalized = normalizeModel(vehicle.model);
    const baseModel = normalized.split(/\s+/)[0];
    const ambiguity = AMBIGUOUS_MODELS[baseModel];

    if (missing.includes('make') && missing.includes('model')) {
        return '🚗 Welches Fahrzeug hast du? Bitte nenne mir Marke und Modell (z.B. „VW Golf 7 2019").';
    }

    if (missing.includes('generation_or_year') && ambiguity) {
        const gens = ambiguity.generations
            .map((g, i) => `• ${g} (${ambiguity.yearRanges[i]})`)
            .join('\n');
        return `📋 Es gibt mehrere Generationen vom ${vehicle.make} ${vehicle.model}:\n\n${gens}\n\nWelche Generation oder welches Baujahr hast du?`;
    }

    if (missing.includes('model')) {
        return `📋 Welches Modell von ${vehicle.make}? (z.B. „Golf 7", „320d F30", „C220 W205")`;
    }

    if (missing.includes('year')) {
        return `📅 Welches Baujahr hat dein ${vehicle.make} ${vehicle.model}?`;
    }

    return `📋 Kannst du mir noch mehr Details zum Fahrzeug geben? (Baujahr, Motorcode, oder VIN/HSN/TSN)`;
}
