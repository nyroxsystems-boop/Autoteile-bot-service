/**
 * 🔄 SUPERSESSION TRACKER - OEM Part Number Evolution
 * 
 * Manufacturers regularly update part numbers when:
 * - Part is improved (material, design)
 * - Part is consolidated (same part for multiple vehicles)
 * - Production changes (new supplier)
 * 
 * Customer may have old documentation with outdated OEM number.
 * We need to resolve to the CURRENT orderable part number.
 */

import { logger } from "@utils/logger";

// ============================================================================
// Supersession Types
// ============================================================================

export interface SupersessionChain {
    original: string;           // Original (oldest) OEM
    current: string;            // Current orderable OEM
    chain: string[];            // Full chain from old to new
    reason?: string;            // Why superseded
    date?: string;              // When superseded (approximate)
    interchangeable: boolean;   // Are all versions interchangeable?
}

// ============================================================================
// VAG Supersession Database
// ============================================================================

/**
 * Known supersession chains for common VAG parts
 * Format: original OEM -> current OEM
 */
const VAG_SUPERSESSIONS: Record<string, SupersessionChain> = {
    // Golf 7 Bremsbeläge vorne (multiple revisions)
    '5Q0698151': {
        original: '5Q0698151',
        current: '5Q0698151D',
        chain: ['5Q0698151', '5Q0698151A', '5Q0698151B', '5Q0698151C', '5Q0698151D'],
        reason: 'Material-Verbesserung, weniger Bremsstaub',
        interchangeable: true,
    },
    '5Q0698151A': {
        original: '5Q0698151',
        current: '5Q0698151D',
        chain: ['5Q0698151', '5Q0698151A', '5Q0698151B', '5Q0698151C', '5Q0698151D'],
        interchangeable: true,
    },
    '5Q0698151B': {
        original: '5Q0698151',
        current: '5Q0698151D',
        chain: ['5Q0698151', '5Q0698151A', '5Q0698151B', '5Q0698151C', '5Q0698151D'],
        interchangeable: true,
    },

    // Golf 7 Koppelstange vorne
    '5Q0411315A': {
        original: '5Q0411315A',
        current: '5Q0411315C',
        chain: ['5Q0411315A', '5Q0411315B', '5Q0411315C'],
        reason: 'Verstärkte Gummi-Buchsen',
        interchangeable: true,
    },

    // Golf 7 Thermostat 1.4 TSI
    '04E121113A': {
        original: '04E121113A',
        current: '04E121113D',
        chain: ['04E121113A', '04E121113B', '04E121113C', '04E121113D'],
        reason: 'Präzisere Temperaturregelung',
        interchangeable: true,
    },

    // Passat B8 Ölfilter
    '03N115562': {
        original: '03N115562',
        current: '03N115562B',
        chain: ['03N115562', '03N115562A', '03N115562B'],
        interchangeable: true,
    },

    // A3 8V Querlenker vorne links
    '5Q0407151': {
        original: '5Q0407151',
        current: '5Q0407151G',
        chain: ['5Q0407151', '5Q0407151A', '5Q0407151D', '5Q0407151G'],
        reason: 'Verstärkte Kugelgelenke',
        interchangeable: true,
    },

    // Golf 7 Wasserpumpe 1.4 TSI
    '04E121600A': {
        original: '04E121600A',
        current: '04E121600D',
        chain: ['04E121600A', '04E121600B', '04E121600C', '04E121600D'],
        reason: 'Verbesserte Dichtung',
        interchangeable: true,
    },

    // Golf 7 GTI Turbolader
    '06K145874D': {
        original: '06K145874D',
        current: '06K145874G',
        chain: ['06K145874D', '06K145874F', '06K145874G'],
        reason: 'Optimierte Wastegate-Steuerung',
        interchangeable: true,
    },

    // Golf 7 Zündkerzen
    '04E905612': {
        original: '04E905612',
        current: '04E905612C',
        chain: ['04E905612', '04E905612A', '04E905612B', '04E905612C'],
        interchangeable: true,
    },

    // MQB Stabilisator hinten
    '5Q0511305': {
        original: '5Q0511305',
        current: '5Q0511305B',
        chain: ['5Q0511305', '5Q0511305A', '5Q0511305B'],
        interchangeable: true,
    },
};

// ============================================================================
// BMW Supersession Database
// ============================================================================

const BMW_SUPERSESSIONS: Record<string, SupersessionChain> = {
    // 3er F30 Bremsbeläge vorne
    '34116850885': {
        original: '34116850885',
        current: '34116872632',
        chain: ['34116850885', '34116872632'],
        interchangeable: true,
    },

    // 3er F30 Ölfilter
    '11428507683': {
        original: '11428507683',
        current: '11428575211',
        chain: ['11428507683', '11428575211'],
        interchangeable: true,
    },
};

// ============================================================================
// Mercedes Supersession Database
// ============================================================================

const MERCEDES_SUPERSESSIONS: Record<string, SupersessionChain> = {
    // W205 Bremsbeläge vorne
    'A0004207500': {
        original: 'A0004207500',
        current: 'A0004209700',
        chain: ['A0004207500', 'A0004209700'],
        interchangeable: true,
    },
};

// ============================================================================
// Combined Database
// ============================================================================

const ALL_SUPERSESSIONS: Record<string, SupersessionChain> = {
    ...VAG_SUPERSESSIONS,
    ...BMW_SUPERSESSIONS,
    ...MERCEDES_SUPERSESSIONS,
};

// ============================================================================
// Resolution Functions
// ============================================================================

export interface SupersessionResult {
    found: boolean;
    originalOEM: string;
    currentOEM: string;
    supersessionChain?: SupersessionChain;
    isOutdated: boolean;
    message?: string;
}

/**
 * Check if an OEM has been superseded
 */
export function checkSupersession(oem: string): SupersessionResult {
    const normalized = oem.replace(/[\s\-\.]/g, '').toUpperCase();

    const chain = ALL_SUPERSESSIONS[normalized];

    if (!chain) {
        return {
            found: false,
            originalOEM: normalized,
            currentOEM: normalized,
            isOutdated: false,
        };
    }

    const isOutdated = normalized !== chain.current;

    logger.info("[Supersession] Check result", {
        originalOEM: normalized,
        currentOEM: chain.current,
        isOutdated,
        chainLength: chain.chain.length,
    });

    return {
        found: true,
        originalOEM: normalized,
        currentOEM: chain.current,
        supersessionChain: chain,
        isOutdated,
        message: isOutdated
            ? `OEM ${normalized} wurde ersetzt durch ${chain.current}${chain.reason ? ` (${chain.reason})` : ''}`
            : `OEM ${normalized} ist aktuell`,
    };
}

/**
 * Resolve to current OEM
 */
export function resolveToCurrentOEM(oem: string): string {
    const result = checkSupersession(oem);
    return result.currentOEM;
}

/**
 * Get full supersession chain for an OEM
 */
export function getSupersessionHistory(oem: string): string[] {
    const normalized = oem.replace(/[\s\-\.]/g, '').toUpperCase();
    const chain = ALL_SUPERSESSIONS[normalized];
    return chain ? chain.chain : [normalized];
}

/**
 * Check if two OEMs are interchangeable (via supersession)
 */
export function areInterchangeable(oem1: string, oem2: string): boolean {
    const norm1 = oem1.replace(/[\s\-\.]/g, '').toUpperCase();
    const norm2 = oem2.replace(/[\s\-\.]/g, '').toUpperCase();

    if (norm1 === norm2) return true;

    const chain1 = ALL_SUPERSESSIONS[norm1];
    const chain2 = ALL_SUPERSESSIONS[norm2];

    // Both in same chain?
    if (chain1 && chain2) {
        return chain1.current === chain2.current && chain1.interchangeable && chain2.interchangeable;
    }

    // One is in a chain that contains the other?
    if (chain1 && chain1.chain.includes(norm2) && chain1.interchangeable) return true;
    if (chain2 && chain2.chain.includes(norm1) && chain2.interchangeable) return true;

    return false;
}

// ============================================================================
// Add Supersession (for runtime learning)
// ============================================================================

/**
 * Register a new supersession (for dynamic learning)
 */
export function registerSupersession(
    oldOEM: string,
    newOEM: string,
    reason?: string
): void {
    const normOld = oldOEM.replace(/[\s\-\.]/g, '').toUpperCase();
    const normNew = newOEM.replace(/[\s\-\.]/g, '').toUpperCase();

    // Check if oldOEM already has a chain
    const existingChain = ALL_SUPERSESSIONS[normOld];

    if (existingChain) {
        // Extend existing chain
        if (!existingChain.chain.includes(normNew)) {
            existingChain.chain.push(normNew);
            existingChain.current = normNew;
        }
    } else {
        // Create new chain
        ALL_SUPERSESSIONS[normOld] = {
            original: normOld,
            current: normNew,
            chain: [normOld, normNew],
            reason,
            interchangeable: true,
        };
    }

    // Also register newOEM pointing to same chain
    ALL_SUPERSESSIONS[normNew] = ALL_SUPERSESSIONS[normOld];

    logger.info("[Supersession] Registered new", {
        oldOEM: normOld,
        newOEM: normNew,
        reason,
    });
}

// ============================================================================
// Export
// ============================================================================

export default {
    checkSupersession,
    resolveToCurrentOEM,
    getSupersessionHistory,
    areInterchangeable,
    registerSupersession,
};
