/**
 * 🚗 CITROEN OEM Registry
 * 
 * Comprehensive OEM parts database for major Citroen models.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// C3 III (2016-present)
// ============================================================================

const CITROEN_C3_III: ModelEntry = {
    name: 'C3 III',
    code: 'SX',
    generation: '3. Gen',
    years: [2016, 2026],
    platform: 'CMP',
    engines: ['1.2 PureTech', '1.5 BlueHDi'],
    parts: {
        brakes: {
            discFront: [
                { oem: '1613191380', description: '266x22mm Vented', condition: 'PureTech 82/110' },
                { oem: '1617279580', description: '283x26mm Vented', condition: 'PureTech 130' },
            ],
            discRear: [
                { oem: '424918', description: '249x10mm Solid w/ Bearing' },
            ],
        },
        filters: {
            oil: [
                { oem: '1109AL', description: 'Oil Filter 1.2 PureTech' },
                { oem: '9809721080', description: 'Oil Filter 1.5 BlueHDi' },
            ],
            air: [
                { oem: '9805552080', description: 'Air Filter 1.2 PureTech' },
                { oem: '9813908880', description: 'Air Filter 1.5 BlueHDi' },
            ],
            cabin: [
                { oem: '9821501880', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// C4 III (2020-present)
// ============================================================================

const CITROEN_C4_III: ModelEntry = {
    name: 'C4 III',
    code: 'C41',
    generation: '3. Gen',
    years: [2020, 2026],
    platform: 'CMP',
    engines: ['1.2 PureTech', '1.5 BlueHDi', 'Electric'],
    parts: {
        brakes: {
            discFront: [
                { oem: '1618862780', description: '283x26mm Vented', condition: 'PureTech' },
                { oem: '1618862980', description: '304x28mm Vented', condition: 'BlueHDi / Electric' },
            ],
            discRear: [
                { oem: '1619237980', description: '268x12mm Solid' },
            ],
        },
        filters: {
            oil: [
                { oem: '9818914980', description: 'Oil Filter 1.2 PureTech' },
                { oem: '9809721080', description: 'Oil Filter 1.5 BlueHDi' },
            ],
            air: [
                { oem: '9805552080', description: 'Air Filter 1.2 PureTech' },
            ],
            cabin: [
                { oem: '9813942880', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// C5 Aircross (2018-present)
// ============================================================================

const CITROEN_C5_AIRCROSS: ModelEntry = {
    name: 'C5 Aircross',
    code: 'C84',
    generation: '1. Gen',
    years: [2018, 2026],
    platform: 'EMP2',
    engines: ['1.2 PureTech', '1.6 THP', '1.5 BlueHDi', '2.0 BlueHDi', 'PHEV'],
    parts: {
        brakes: {
            discFront: [
                { oem: '1618862780', description: '283x26mm Vented', condition: 'PureTech / 1.5 BlueHDi' },
                { oem: '1618862980', description: '304x28mm Vented', condition: '2.0 BlueHDi / PHEV' },
            ],
            discRear: [
                { oem: '1619237980', description: '268x12mm Solid' },
                { oem: '1619238780', description: '290x12mm Solid', condition: 'PHEV' },
            ],
        },
        filters: {
            oil: [
                { oem: '9818914980', description: 'Oil Filter 1.2 PureTech' },
                { oem: '9809721080', description: 'Oil Filter BlueHDi' },
            ],
            air: [
                { oem: '9805552080', description: 'Air Filter 1.2 PureTech' },
                { oem: '1444TV', description: 'Air Filter 1.6 THP' },
            ],
            cabin: [
                { oem: '9813942880', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const CITROEN_REGISTRY: OEMRegistry = {
    brand: 'Citroen',
    brandCode: 'CITROEN',
    group: 'STELLANTIS',
    models: [
        CITROEN_C3_III,
        CITROEN_C4_III,
        CITROEN_C5_AIRCROSS,
    ],
};

export default CITROEN_REGISTRY;
