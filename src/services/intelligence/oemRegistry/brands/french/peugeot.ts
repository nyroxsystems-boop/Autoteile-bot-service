/**
 * 🚗 PEUGEOT OEM Registry
 * 
 * Comprehensive OEM parts database for major Peugeot models.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// 208 II (2019-present)
// ============================================================================

const PEUGEOT_208_II: ModelEntry = {
    name: '208 II',
    code: 'UB',
    generation: 'P21',
    years: [2019, 2026],
    platform: 'CMP',
    engines: ['1.2 PureTech', '1.5 BlueHDi', 'Electric'],
    parts: {
        brakes: {
            discFront: [
                { oem: '9806743980', description: '266x22mm Vented', condition: 'PureTech 75/100' },
                { oem: '9813214480', description: '283x26mm Vented', condition: 'PureTech 130 / GT' },
            ],
            discRear: [
                { oem: '1643574180', description: '249x10mm Solid w/ Bearing', condition: 'Standard' },
            ],
            padsFront: [
                { oem: '1647860280', description: 'Brake Pads Front' },
            ],
        },
        filters: {
            oil: [
                { oem: '9818914980', description: 'Oil Filter 1.2 PureTech' },
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
// 3008 II (2016-2023)
// ============================================================================

const PEUGEOT_3008_II: ModelEntry = {
    name: '3008 II',
    code: 'P84',
    generation: '2. Gen',
    years: [2016, 2023],
    platform: 'EMP2',
    engines: ['1.2 PureTech', '1.6 THP', '1.5 BlueHDi', '2.0 BlueHDi'],
    parts: {
        brakes: {
            discFront: [
                { oem: '1618862780', description: '283x26mm Vented', condition: '1.2 PureTech / 1.5 BlueHDi' },
                { oem: '1618862980', description: '304x28mm Vented', condition: '1.6 THP / 2.0 BlueHDi' },
            ],
            discRear: [
                { oem: '1619237980', description: '268x12mm Solid' },
                { oem: '1619238780', description: '290x12mm Solid', condition: 'Hybrid / GT' },
            ],
        },
        filters: {
            oil: [
                { oem: '9818914980', description: 'Oil Filter 1.2 PureTech' },
                { oem: '9809721080', description: 'Oil Filter 1.5 BlueHDi' },
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

export const PEUGEOT_REGISTRY: OEMRegistry = {
    brand: 'Peugeot',
    brandCode: 'PEUGEOT',
    group: 'STELLANTIS',
    models: [
        PEUGEOT_208_II,
        PEUGEOT_3008_II,
    ],
};

export default PEUGEOT_REGISTRY;
