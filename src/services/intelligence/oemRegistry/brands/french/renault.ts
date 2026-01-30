/**
 * 🚗 RENAULT OEM Registry
 * 
 * Comprehensive OEM parts database for major Renault models.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// Clio 5 (2019-present)
// ============================================================================

const CLIO_V: ModelEntry = {
    name: 'Clio V',
    code: 'BF',
    generation: '5. Gen',
    years: [2019, 2026],
    platform: 'CMF-B',
    engines: ['1.0 SCe', '1.0 TCe', '1.3 TCe', '1.5 Blue dCi', '1.6 E-Tech'],
    parts: {
        brakes: {
            discFront: [
                { oem: '402062212R', description: '258x22mm Vented', condition: '1.0 SCe / 1.0 TCe' },
                { oem: '402067501R', description: '280x24mm Vented', condition: '1.3 TCe / 1.5 dCi' },
            ],
            discRear: [
                { oem: '432007821R', description: '260x8mm Solid w/ Bearing' },
            ],
            padsFront: [
                { oem: '410605055R', description: 'Brake Pads Front' },
            ],
        },
        filters: {
            oil: [
                { oem: '152095084R', description: 'Oil Filter 1.0/1.3 TCe' },
                { oem: '152089599R', description: 'Oil Filter 1.5 Blue dCi' },
            ],
            air: [
                { oem: '165466859R', description: 'Air Filter 1.0/1.3 TCe' },
                { oem: '165464947R', description: 'Air Filter 1.5 Blue dCi' },
            ],
            cabin: [
                { oem: '272773151R', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Megane 4 (2016-2024)
// ============================================================================

const MEGANE_IV: ModelEntry = {
    name: 'Megane IV',
    code: 'B9A/M',
    generation: '4. Gen',
    years: [2016, 2024],
    platform: 'CMF-CD',
    engines: ['1.2 TCe', '1.3 TCe', '1.5 dCi', '1.6 dCi', '1.8 RS'],
    parts: {
        brakes: {
            discFront: [
                { oem: '402064151R', description: '280x24mm Vented', condition: 'Standard 1.2/1.5' },
                { oem: '402064408R', description: '296x26mm Vented', condition: 'GT Line / 1.6 dCi' },
                { oem: '402067753R', description: '320x28mm Vented', condition: 'Megane GT' },
                { oem: '402069958R', description: '355x28mm Bi-Material', condition: 'RS / Trophy' },
            ],
            discRear: [
                { oem: '432001539R', description: '260x8mm Solid w/ Bearing' },
                { oem: '432007253R', description: '290x11mm Solid (Electric HB)' },
            ],
        },
        filters: {
            oil: [
                { oem: '152095084R', description: 'Oil Filter 1.2/1.3 TCe' },
                { oem: '152089599R', description: 'Oil Filter 1.5/1.6 dCi' },
            ],
            air: [
                { oem: '165467860R', description: 'Air Filter 1.2/1.3 TCe' },
                { oem: '165464593R', description: 'Air Filter 1.5/1.6 dCi' },
            ],
            cabin: [
                { oem: '272774812R', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const RENAULT_REGISTRY: OEMRegistry = {
    brand: 'Renault',
    brandCode: 'RENAULT',
    group: 'RENAULT',
    models: [
        CLIO_V,
        MEGANE_IV,
    ],
};

export default RENAULT_REGISTRY;
