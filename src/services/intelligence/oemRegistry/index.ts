/**
 * 🔍 OEM Registry Index
 * 
 * Central export and lookup functions for the OEM registry.
 */

import { OEMRegistry, OEMLookupQuery, OEMLookupResult, PartType, PartVariant, ModelEntry } from './types';

// Import brand registries
import { VOLKSWAGEN_REGISTRY } from './brands/vag/volkswagen';
import { AUDI_REGISTRY } from './brands/vag/audi';
import { SKODA_REGISTRY } from './brands/vag/skoda';
import { SEAT_REGISTRY } from './brands/vag/seat';
import { MERCEDES_REGISTRY } from './brands/german/mercedes';
import { BMW_REGISTRY } from './brands/german/bmw';
import { OPEL_REGISTRY } from './brands/german/opel';
import { FORD_REGISTRY } from './brands/other/ford';
import { HYUNDAI_REGISTRY } from './brands/asian/hyundai';
import { TOYOTA_REGISTRY } from './brands/asian/toyota';
import { KIA_REGISTRY } from './brands/asian/kia';
import { RENAULT_REGISTRY } from './brands/french/renault';
import { PEUGEOT_REGISTRY } from './brands/french/peugeot';
import { CITROEN_REGISTRY } from './brands/french/citroen';
import { MAZDA_REGISTRY } from './brands/japanese/mazda';
import { HONDA_REGISTRY } from './brands/japanese/honda';
import { NISSAN_REGISTRY } from './brands/japanese/nissan';
import { VOLVO_REGISTRY } from './brands/scandinavian/volvo';
import { FIAT_REGISTRY } from './brands/italian/fiat';

// ============================================================================
// All Registries
// ============================================================================

export const ALL_REGISTRIES: OEMRegistry[] = [
    // VAG Group
    VOLKSWAGEN_REGISTRY,
    AUDI_REGISTRY,
    SKODA_REGISTRY,
    SEAT_REGISTRY,
    // German Premium
    MERCEDES_REGISTRY,
    BMW_REGISTRY,
    OPEL_REGISTRY,
    // Asian
    HYUNDAI_REGISTRY,
    TOYOTA_REGISTRY,
    KIA_REGISTRY,
    // French
    RENAULT_REGISTRY,
    PEUGEOT_REGISTRY,
    CITROEN_REGISTRY,
    // Japanese
    MAZDA_REGISTRY,
    HONDA_REGISTRY,
    NISSAN_REGISTRY,
    // Other
    FORD_REGISTRY,
    VOLVO_REGISTRY,
    FIAT_REGISTRY,
];

// ============================================================================
// Brand Lookup Map
// ============================================================================

const BRAND_MAP: Record<string, OEMRegistry> = {};
for (const registry of ALL_REGISTRIES) {
    BRAND_MAP[registry.brandCode.toUpperCase()] = registry;
    BRAND_MAP[registry.brand.toUpperCase()] = registry;
    // Add common aliases
    if (registry.brandCode === 'VW') {
        BRAND_MAP['VOLKSWAGEN'] = registry;
    }
    if (registry.brandCode === 'SEAT') {
        BRAND_MAP['CUPRA'] = registry;
    }
}

// ============================================================================
// Part Type to Path Mapping
// ============================================================================

type PartPath = {
    category: 'brakes' | 'filters' | 'cooling' | 'suspension' | 'drivetrain' | 'engine';
    field: string;
};

const PART_TYPE_MAP: Record<PartType, PartPath> = {
    'DISC_FRONT': { category: 'brakes', field: 'discFront' },
    'DISC_REAR': { category: 'brakes', field: 'discRear' },
    'PADS_FRONT': { category: 'brakes', field: 'padsFront' },
    'PADS_REAR': { category: 'brakes', field: 'padsRear' },
    'OIL_FILTER': { category: 'filters', field: 'oil' },
    'AIR_FILTER': { category: 'filters', field: 'air' },
    'FUEL_FILTER': { category: 'filters', field: 'fuel' },
    'CABIN_FILTER': { category: 'filters', field: 'cabin' },
    'WATER_PUMP': { category: 'cooling', field: 'waterPump' },
    'THERMOSTAT': { category: 'cooling', field: 'thermostat' },
    'RADIATOR': { category: 'cooling', field: 'radiator' },
    'SHOCK_FRONT': { category: 'suspension', field: 'shockFront' },
    'SHOCK_REAR': { category: 'suspension', field: 'shockRear' },
    'SPRING_FRONT': { category: 'suspension', field: 'springFront' },
    'SPRING_REAR': { category: 'suspension', field: 'springRear' },
    'CONTROL_ARM': { category: 'suspension', field: 'controlArm' },
    'TIE_ROD': { category: 'suspension', field: 'tieRod' },
    'WHEEL_BEARING': { category: 'suspension', field: 'wheelBearing' },
    'STABILIZER': { category: 'suspension', field: 'stabilizer' },
    'CLUTCH_KIT': { category: 'drivetrain', field: 'clutchKit' },
    'FLYWHEEL': { category: 'drivetrain', field: 'flywheel' },
    'DRIVE_SHAFT': { category: 'drivetrain', field: 'driveShaft' },
    'TIMING_KIT': { category: 'engine', field: 'timingKit' },
    'SPARK_PLUG': { category: 'engine', field: 'sparkPlug' },
    'IGNITION_COIL': { category: 'engine', field: 'ignitionCoil' },
    'TURBO': { category: 'engine', field: 'turbo' },
};

// ============================================================================
// Core Lookup Functions
// ============================================================================

/**
 * Find a registry by brand name or code
 */
export function getRegistryByBrand(brand: string): OEMRegistry | undefined {
    return BRAND_MAP[brand.toUpperCase()];
}

/**
 * Find a model within a registry
 */
export function findModel(registry: OEMRegistry, modelName: string, year?: number): ModelEntry | undefined {
    const normalizedName = modelName.toLowerCase();

    for (const model of registry.models) {
        const nameMatch = model.name.toLowerCase().includes(normalizedName) ||
            normalizedName.includes(model.name.toLowerCase()) ||
            model.code.toLowerCase() === normalizedName;

        if (nameMatch) {
            // If year is provided, check if it's within range
            if (year) {
                if (year >= model.years[0] && year <= model.years[1]) {
                    return model;
                }
            } else {
                return model;
            }
        }
    }

    return undefined;
}

/**
 * Get parts from a model by part type
 */
function getPartsFromModel(model: ModelEntry, partType: PartType): PartVariant[] | undefined {
    const path = PART_TYPE_MAP[partType];
    if (!path) return undefined;

    const category = model.parts[path.category];
    if (!category) return undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (category as any)[path.field] as PartVariant[] | undefined;
}

/**
 * Main OEM lookup function
 */
export function lookupOEM(query: OEMLookupQuery): OEMLookupResult {
    const result: OEMLookupResult = {
        found: false,
        confidence: 0,
        source: 'REGISTRY',
    };

    // Need at least brand and model to look up
    if (!query.brand || !query.model) {
        return result;
    }

    // Find the registry
    const registry = getRegistryByBrand(query.brand);
    if (!registry) {
        return result;
    }

    // Find the model
    const model = findModel(registry, query.model, query.year);
    if (!model) {
        return result;
    }

    // Get the parts for this part type
    const parts = getPartsFromModel(model, query.partType);
    if (!parts || parts.length === 0) {
        return result;
    }

    // If engine is specified, try to find engine-specific part
    if (query.engine) {
        const engineMatch = parts.find(p =>
            p.condition?.toLowerCase().includes(query.engine!.toLowerCase())
        );
        if (engineMatch) {
            result.found = true;
            result.oem = engineMatch.supersededBy || engineMatch.oem;
            result.confidence = 95;
            result.alternatives = parts.filter(p => p.oem !== result.oem);
            return result;
        }
    }

    // Return the first (most common) part
    const primary = parts[0];
    result.found = true;
    result.oem = primary.supersededBy || primary.oem;
    result.confidence = 85;
    result.alternatives = parts.slice(1);

    return result;
}

/**
 * Search for OEM number across all registries
 */
export function searchOEM(oemNumber: string): Array<{
    brand: string;
    model: string;
    partType: string;
    variant: PartVariant;
}> {
    const results: Array<{
        brand: string;
        model: string;
        partType: string;
        variant: PartVariant;
    }> = [];

    const normalizedOEM = oemNumber.toUpperCase().replace(/[-\s]/g, '');

    for (const registry of ALL_REGISTRIES) {
        for (const model of registry.models) {
            for (const [partType, path] of Object.entries(PART_TYPE_MAP)) {
                const parts = getPartsFromModel(model, partType as PartType);
                if (parts) {
                    for (const variant of parts) {
                        const variantOEM = variant.oem.toUpperCase().replace(/[-\s]/g, '');
                        if (variantOEM === normalizedOEM ||
                            variantOEM.includes(normalizedOEM) ||
                            normalizedOEM.includes(variantOEM)) {
                            results.push({
                                brand: registry.brand,
                                model: model.name,
                                partType,
                                variant,
                            });
                        }
                    }
                }
            }
        }
    }

    return results;
}

/**
 * Get all available models for a brand
 */
export function getModelsForBrand(brand: string): string[] {
    const registry = getRegistryByBrand(brand);
    if (!registry) return [];

    return registry.models.map(m => `${m.name} (${m.years[0]}-${m.years[1]})`);
}

/**
 * Get statistics about the registry
 */
export function getRegistryStats(): {
    brands: number;
    models: number;
    oemNumbers: number;
} {
    let models = 0;
    let oemNumbers = 0;

    for (const registry of ALL_REGISTRIES) {
        models += registry.models.length;

        for (const model of registry.models) {
            for (const partType of Object.keys(PART_TYPE_MAP) as PartType[]) {
                const parts = getPartsFromModel(model, partType);
                if (parts) {
                    oemNumbers += parts.length;
                }
            }
        }
    }

    return {
        brands: ALL_REGISTRIES.length,
        models,
        oemNumbers,
    };
}

// ============================================================================
// Exports
// ============================================================================

export {
    OEMRegistry,
    ModelEntry,
    PartVariant,
    PartType,
    OEMLookupQuery,
    OEMLookupResult,
} from './types';

export {
    VOLKSWAGEN_REGISTRY,
    AUDI_REGISTRY,
    SKODA_REGISTRY,
    SEAT_REGISTRY,
};

export default {
    lookupOEM,
    searchOEM,
    getRegistryByBrand,
    findModel,
    getModelsForBrand,
    getRegistryStats,
    ALL_REGISTRIES,
};
