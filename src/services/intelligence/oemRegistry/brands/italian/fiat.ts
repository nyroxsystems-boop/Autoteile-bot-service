/**
 * 🚗 FIAT OEM Registry
 * 
 * Comprehensive OEM parts database for major Fiat models.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// 500X (2014-present)
// ============================================================================

const FIAT_500X: ModelEntry = {
    name: '500X',
    code: '334',
    generation: '1. Gen',
    years: [2014, 2026],
    platform: 'Small Wide',
    engines: ['1.0 FireFly', '1.3 FireFly', '1.6 E-torQ', '1.3 MultiJet', '1.6 MultiJet', '2.0 MultiJet'],
    parts: {
        brakes: {
            discFront: [
                { oem: '51806278', description: '281x26mm Vented', condition: 'FireFly / 1.6 E-torQ' },
                { oem: '51815312', description: '305x28mm Vented', condition: 'Cross / 2WD High' },
                { oem: '71777095', description: '330x28mm Vented', condition: 'AWD / 2.0 MultiJet' },
            ],
            discRear: [
                { oem: '51935825', description: '278x12mm Solid', condition: 'Standard' },
                { oem: '52041825', description: '290x12mm Solid', condition: 'AWD' },
            ],
        },
        filters: {
            oil: [
                { oem: '55282178', description: 'Oil Filter 1.0/1.3 FireFly' },
                { oem: '55197218', description: 'Oil Filter MultiJet Diesel' },
            ],
            air: [
                { oem: '51885139', description: 'Air Filter FireFly' },
                { oem: '52023602', description: 'Air Filter 1.6 E-torQ' },
            ],
            cabin: [
                { oem: '52081699', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Tipo (2015-present)
// ============================================================================

const FIAT_TIPO: ModelEntry = {
    name: 'Tipo',
    code: '356',
    generation: '1. Gen',
    years: [2015, 2026],
    platform: 'Small Wide',
    engines: ['1.0 FireFly', '1.4 T-Jet', '1.6 E-torQ', '1.3 MultiJet', '1.6 MultiJet'],
    parts: {
        brakes: {
            discFront: [
                { oem: '51931092', description: '257x22mm Vented', condition: '1.0/1.4 Standard' },
                { oem: '51987581', description: '281x26mm Vented', condition: '1.6 / Diesel' },
            ],
            discRear: [
                { oem: '51987589', description: '251x10mm Solid' },
            ],
        },
        filters: {
            oil: [
                { oem: '55282178', description: 'Oil Filter 1.0/1.4' },
                { oem: '55197218', description: 'Oil Filter MultiJet' },
            ],
            air: [
                { oem: '51939049', description: 'Air Filter 1.4 T-Jet' },
                { oem: '51885139', description: 'Air Filter 1.0 FireFly' },
            ],
            cabin: [
                { oem: '52081699', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Panda III (2012-present)
// ============================================================================

const FIAT_PANDA_III: ModelEntry = {
    name: 'Panda III',
    code: '319',
    generation: '3. Gen',
    years: [2012, 2026],
    platform: 'Mini',
    engines: ['1.0 FireFly Hybrid', '1.2 Fire', '0.9 TwinAir', '1.3 MultiJet'],
    parts: {
        brakes: {
            discFront: [
                { oem: '51889819', description: '257x20mm Vented', condition: 'Standard' },
                { oem: '51931092', description: '257x22mm Vented', condition: 'Cross 4x4' },
            ],
            discRear: [
                { oem: '52115490', description: 'Drum Brake', condition: 'Standard' },
            ],
        },
        filters: {
            oil: [
                { oem: '55282178', description: 'Oil Filter 1.0/1.2 FireFly' },
                { oem: '55197218', description: 'Oil Filter 1.3 MultiJet' },
            ],
            air: [
                { oem: '51885139', description: 'Air Filter 1.0 Hybrid' },
                { oem: '51775324', description: 'Air Filter 0.9 TwinAir' },
            ],
            cabin: [
                { oem: '71775824', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const FIAT_REGISTRY: OEMRegistry = {
    brand: 'Fiat',
    brandCode: 'FIAT',
    group: 'STELLANTIS',
    models: [
        FIAT_500X,
        FIAT_TIPO,
        FIAT_PANDA_III,
    ],
};

export default FIAT_REGISTRY;
