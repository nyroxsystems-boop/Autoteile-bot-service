/**
 * 🔧 PR-CODE RESOLVER - VAG-Specific Equipment-Based OEM Resolution
 * 
 * PR-Codes (Production Codes) are 3-character codes that define factory options.
 * Critical for brake, suspension, and steering parts where the same model
 * can have completely different OEM numbers based on equipment.
 * 
 * Example: Golf 7 front brake disc
 *   - PR-Code 1ZD → 5Q0615301F (312mm steel, standard)
 *   - PR-Code 1ZE → 5Q0615301G (340mm vented, performance)
 *   - PR-Code 1ZK → 5Q0615301H (345mm, GTI/R)
 */

import { logger } from "@utils/logger";

// ============================================================================
// PR-Code Categories
// ============================================================================

export type PRCodeCategory =
    | 'BRAKES_FRONT'
    | 'BRAKES_REAR'
    | 'SUSPENSION_FRONT'
    | 'SUSPENSION_REAR'
    | 'STEERING'
    | 'EXHAUST'
    | 'ENGINE_COOLING'
    | 'CLIMATE'
    | 'OTHER';

// ============================================================================
// VAG PR-Code Mappings (CRITICAL KNOWLEDGE)
// ============================================================================

/**
 * BRAKES - The most critical PR-code category
 * Wrong brake disc = SAFETY ISSUE
 */
const BRAKE_PR_CODES: Record<string, {
    description: string;
    frontDiscDiameter: number;
    rearDiscDiameter?: number;
    models: string[];
}> = {
    // Golf 7 / A3 8V / Leon 5F / Octavia 3
    '1ZA': {
        description: 'Bremsanlage Basis',
        frontDiscDiameter: 288,
        rearDiscDiameter: 253,
        models: ['Golf 7', 'A3 8V', 'Leon 5F', 'Octavia 3'],
    },
    '1ZD': {
        description: 'Bremsanlage verstärkt',
        frontDiscDiameter: 312,
        rearDiscDiameter: 272,
        models: ['Golf 7', 'A3 8V', 'Leon 5F', 'Octavia 3'],
    },
    '1ZE': {
        description: 'Bremsanlage Hochleistung',
        frontDiscDiameter: 340,
        rearDiscDiameter: 310,
        models: ['Golf 7 GTI', 'A3 S-Line', 'Leon FR'],
    },
    '1ZF': {
        description: 'Bremsanlage Performance',
        frontDiscDiameter: 340,
        rearDiscDiameter: 310,
        models: ['Golf 7 GTI Performance', 'A3 8V 40 TFSI'],
    },
    '1ZK': {
        description: 'Bremsanlage GTI/R',
        frontDiscDiameter: 345,
        rearDiscDiameter: 310,
        models: ['Golf 7 R', 'S3 8V', 'Cupra'],
    },
    '1ZM': {
        description: 'Bremsanlage R/RS',
        frontDiscDiameter: 370,
        rearDiscDiameter: 310,
        models: ['Golf R Performance', 'RS3'],
    },
    '1ZP': {
        description: 'Bremsanlage Keramik',
        frontDiscDiameter: 380,
        rearDiscDiameter: 356,
        models: ['RS3', 'RS4', 'RS6'],
    },

    // Golf 6 / A3 8P
    '1KD': {
        description: 'Bremsanlage verstärkt Golf 6',
        frontDiscDiameter: 312,
        rearDiscDiameter: 272,
        models: ['Golf 6', 'A3 8P'],
    },
    '1KE': {
        description: 'Bremsanlage GTI Golf 6',
        frontDiscDiameter: 345,
        rearDiscDiameter: 310,
        models: ['Golf 6 GTI', 'Golf 6 R'],
    },

    // Passat B8 / A4 B9
    '2EE': {
        description: 'Bremsanlage Passat Standard',
        frontDiscDiameter: 312,
        rearDiscDiameter: 286,
        models: ['Passat B8', 'A4 B9'],
    },
    '2EH': {
        description: 'Bremsanlage Passat verstärkt',
        frontDiscDiameter: 340,
        rearDiscDiameter: 300,
        models: ['Passat B8 R-Line', 'A4 B9 S-Line'],
    },
};

/**
 * SUSPENSION PR-Codes
 */
const SUSPENSION_PR_CODES: Record<string, {
    description: string;
    type: 'STANDARD' | 'SPORT' | 'ADAPTIVE' | 'AIR';
    models: string[];
}> = {
    '1BA': {
        description: 'Fahrwerk Standard',
        type: 'STANDARD',
        models: ['Golf 7', 'A3 8V'],
    },
    '1BH': {
        description: 'Sportfahrwerk',
        type: 'SPORT',
        models: ['Golf 7 GTI', 'A3 S-Line'],
    },
    '1BE': {
        description: 'Sportfahrwerk tiefergelegt (-15mm)',
        type: 'SPORT',
        models: ['Golf 7 GTI', 'Golf 7 R'],
    },
    '1BJ': {
        description: 'DCC Adaptives Fahrwerk',
        type: 'ADAPTIVE',
        models: ['Golf 7', 'A3 8V', 'Passat B8'],
    },
    '1BK': {
        description: 'DCC Sport Adaptives Fahrwerk',
        type: 'ADAPTIVE',
        models: ['Golf 7 R', 'S3 8V'],
    },
    '2MA': {
        description: 'Luftfederung',
        type: 'AIR',
        models: ['A6', 'A8', 'Touareg'],
    },
};

// ============================================================================
// OEM Mapping by PR-Code
// ============================================================================

/**
 * Maps PR-Code + Part Category → OEM Number
 */
interface OEMMapping {
    oem: string;
    description: string;
    brand: 'OEM' | 'OES';
    side?: 'L' | 'R' | 'BOTH';
}

const PR_CODE_TO_OEM: Record<string, Record<string, OEMMapping>> = {
    // Golf 7 Bremsscheiben vorne
    '1ZD': {
        'BRAKE_DISC_FRONT': {
            oem: '5Q0615301F',
            description: 'Bremsscheibe vorne 312x25mm',
            brand: 'OEM',
            side: 'BOTH',
        },
        'BRAKE_PAD_FRONT': {
            oem: '5Q0698151B',
            description: 'Bremsbeläge vorne',
            brand: 'OEM',
        },
    },
    '1ZE': {
        'BRAKE_DISC_FRONT': {
            oem: '5Q0615301G',
            description: 'Bremsscheibe vorne 340x30mm',
            brand: 'OEM',
            side: 'BOTH',
        },
        'BRAKE_PAD_FRONT': {
            oem: '5Q0698151C',
            description: 'Bremsbeläge vorne verstärkt',
            brand: 'OEM',
        },
    },
    '1ZK': {
        'BRAKE_DISC_FRONT': {
            oem: '5Q0615301H',
            description: 'Bremsscheibe vorne 345x30mm GTI/R',
            brand: 'OEM',
            side: 'BOTH',
        },
        'BRAKE_PAD_FRONT': {
            oem: '5Q0698151M',
            description: 'Bremsbeläge vorne GTI/R',
            brand: 'OEM',
        },
    },
    '1ZM': {
        'BRAKE_DISC_FRONT': {
            oem: '5Q0615301K',
            description: 'Bremsscheibe vorne 370x30mm R Performance',
            brand: 'OEM',
            side: 'BOTH',
        },
    },
};

// ============================================================================
// Part Category Detection
// ============================================================================

/**
 * Detect part category from user query
 */
export function detectPartCategory(query: string): string | null {
    const normalized = query.toLowerCase();

    // Brakes
    if (/bremsscheibe.*vorn|front.*brake.*disc/i.test(normalized)) return 'BRAKE_DISC_FRONT';
    if (/bremsscheibe.*hint|rear.*brake.*disc/i.test(normalized)) return 'BRAKE_DISC_REAR';
    if (/bremsbelag.*vorn|front.*brake.*pad/i.test(normalized)) return 'BRAKE_PAD_FRONT';
    if (/bremsbelag.*hint|rear.*brake.*pad/i.test(normalized)) return 'BRAKE_PAD_REAR';
    if (/bremssattel|brake.*caliper/i.test(normalized)) return 'BRAKE_CALIPER';

    // Suspension
    if (/stoßdämpfer.*vorn|front.*shock|federbein.*vorn/i.test(normalized)) return 'SHOCK_FRONT';
    if (/stoßdämpfer.*hint|rear.*shock|federbein.*hint/i.test(normalized)) return 'SHOCK_REAR';
    if (/querlenker|control.*arm|wishbone/i.test(normalized)) return 'CONTROL_ARM';
    if (/koppelstange|stabilisator|sway.*bar.*link/i.test(normalized)) return 'SWAY_BAR_LINK';

    // Steering
    if (/spurstange|tie.*rod/i.test(normalized)) return 'TIE_ROD';
    if (/lenkgetriebe|steering.*rack/i.test(normalized)) return 'STEERING_RACK';

    return null;
}

// ============================================================================
// Main Resolution Function
// ============================================================================

export interface PRCodeResolutionResult {
    found: boolean;
    prCode: string;
    prCodeInfo?: typeof BRAKE_PR_CODES[string];
    oemMapping?: OEMMapping;
    alternatives: OEMMapping[];
    warning?: string;
}

/**
 * Resolve OEM based on PR-Code and part category
 */
export function resolveByPRCode(
    prCode: string,
    partCategory: string,
    model?: string
): PRCodeResolutionResult {
    const normalizedPR = prCode.toUpperCase().trim();

    const result: PRCodeResolutionResult = {
        found: false,
        prCode: normalizedPR,
        alternatives: [],
    };

    // Check brake PR-codes
    const brakeInfo = BRAKE_PR_CODES[normalizedPR];
    if (brakeInfo) {
        result.prCodeInfo = brakeInfo;
    }

    // Check suspension PR-codes
    const suspInfo = SUSPENSION_PR_CODES[normalizedPR];
    if (suspInfo) {
        result.prCodeInfo = suspInfo as any;
    }

    // Get OEM mapping
    const prMapping = PR_CODE_TO_OEM[normalizedPR];
    if (prMapping && prMapping[partCategory]) {
        result.found = true;
        result.oemMapping = prMapping[partCategory];

        logger.info("[PR-Code] OEM resolved", {
            prCode: normalizedPR,
            partCategory,
            oem: result.oemMapping.oem,
        });
    } else if (brakeInfo || suspInfo) {
        // PR-Code known but no specific OEM mapping
        result.warning = `PR-Code ${normalizedPR} erkannt, aber kein OEM-Mapping für ${partCategory}. Manuelle Suche empfohlen.`;

        logger.warn("[PR-Code] No OEM mapping", {
            prCode: normalizedPR,
            partCategory,
        });
    }

    return result;
}

/**
 * Get all brake PR-codes for a model
 */
export function getBrakePRCodesForModel(model: string): string[] {
    const normalizedModel = model.toLowerCase();
    const matchingCodes: string[] = [];

    for (const [code, info] of Object.entries(BRAKE_PR_CODES)) {
        if (info.models.some(m => m.toLowerCase().includes(normalizedModel) ||
            normalizedModel.includes(m.toLowerCase()))) {
            matchingCodes.push(code);
        }
    }

    return matchingCodes;
}

/**
 * Suggest possible PR-codes based on vehicle info
 */
export function suggestPRCodes(
    model: string,
    variant?: string,
    enginePower?: number
): { brakes: string[]; suspension: string[] } {
    const normalizedModel = model.toLowerCase();
    const normalizedVariant = (variant || '').toLowerCase();

    const suggestions = {
        brakes: [] as string[],
        suspension: [] as string[],
    };

    // Golf 7 logic
    if (normalizedModel.includes('golf') && normalizedModel.includes('7')) {
        if (normalizedVariant.includes('r') || enginePower && enginePower >= 280) {
            suggestions.brakes.push('1ZK', '1ZM');
            suggestions.suspension.push('1BK', '1BE');
        } else if (normalizedVariant.includes('gti') || enginePower && enginePower >= 200) {
            suggestions.brakes.push('1ZE', '1ZK');
            suggestions.suspension.push('1BH', '1BJ');
        } else if (normalizedVariant.includes('gtd')) {
            suggestions.brakes.push('1ZD', '1ZE');
            suggestions.suspension.push('1BH');
        } else {
            suggestions.brakes.push('1ZA', '1ZD');
            suggestions.suspension.push('1BA', '1BH');
        }
    }

    // A3 8V logic
    if ((normalizedModel.includes('a3') && normalizedModel.includes('8v')) ||
        normalizedModel.includes('a3 2013') || normalizedModel.includes('a3 2020')) {
        if (normalizedVariant.includes('s3')) {
            suggestions.brakes.push('1ZK', '1ZM');
            suggestions.suspension.push('1BK');
        } else if (normalizedVariant.includes('s-line') || normalizedVariant.includes('sline')) {
            suggestions.brakes.push('1ZE');
            suggestions.suspension.push('1BH', '1BJ');
        } else {
            suggestions.brakes.push('1ZA', '1ZD');
            suggestions.suspension.push('1BA');
        }
    }

    return suggestions;
}

// ============================================================================
// Export
// ============================================================================

export default {
    resolveByPRCode,
    detectPartCategory,
    getBrakePRCodesForModel,
    suggestPRCodes,
    BRAKE_PR_CODES,
    SUSPENSION_PR_CODES,
};
