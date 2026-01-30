/**
 * 🚗 VOLVO OEM Registry
 * 
 * Comprehensive OEM parts database for major Volvo models.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// XC60 II SPA (2017-present)
// ============================================================================

const XC60_II: ModelEntry = {
    name: 'XC60 II',
    code: 'SPA',
    generation: '2. Gen',
    years: [2017, 2026],
    platform: 'SPA',
    engines: ['T5', 'T6', 'T8 PHEV', 'B4', 'B5', 'B6', 'D4', 'D5'],
    parts: {
        brakes: {
            discFront: [
                { oem: '31687968', description: '322x28mm Vented', condition: 'D4/B4/T5 17 Inch' },
                { oem: '31471034', description: '328x28mm Vented', condition: 'D5/B5/T5 Standard' },
                { oem: '32223903', description: '345x30mm Vented', condition: 'T6/T8/B6 AWD 18+ Inch' },
                { oem: '32223905', description: '366x32mm Vented', condition: 'Polestar Engineered' },
            ],
            discRear: [
                { oem: '31471746', description: '302x12mm Solid', condition: 'Electric Park Brake' },
                { oem: '32235107', description: '320x22mm Vented', condition: 'T8 PHEV / Polestar' },
            ],
        },
        filters: {
            oil: [
                { oem: '31372212', description: 'Oil Filter T5/T6/B5/B6' },
                { oem: '31339023', description: 'Oil Filter D4/D5' },
            ],
            air: [
                { oem: '31370161', description: 'Air Filter Standard' },
            ],
            cabin: [
                { oem: '31390880', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// XC40 CMA (2018-present)
// ============================================================================

const XC40: ModelEntry = {
    name: 'XC40',
    code: 'CMA',
    generation: '1. Gen',
    years: [2018, 2026],
    platform: 'CMA',
    engines: ['T3', 'T4', 'T5', 'B3', 'B4', 'B5', 'D3', 'D4', 'Electric'],
    parts: {
        brakes: {
            discFront: [
                { oem: '32206306', description: '300x25mm Vented', condition: 'T3/B3/D3' },
                { oem: '32260853', description: '340x30mm Vented', condition: 'T5/B5 AWD' },
                { oem: '32261064', description: '345x30mm Vented', condition: 'Recharge Electric' },
            ],
            discRear: [
                { oem: '32206308', description: '290x12mm Solid' },
                { oem: '32261066', description: '330x18mm Vented', condition: 'Electric' },
            ],
        },
        filters: {
            oil: [
                { oem: '31372212', description: 'Oil Filter T3/T4/T5/B Series' },
                { oem: '31339023', description: 'Oil Filter D3/D4' },
            ],
            air: [
                { oem: '31474521', description: 'Air Filter T/B Series' },
            ],
            cabin: [
                { oem: '32369415', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// V60 II SPA (2018-present)
// ============================================================================

const V60_II: ModelEntry = {
    name: 'V60 II',
    code: 'SPA',
    generation: '2. Gen',
    years: [2018, 2026],
    platform: 'SPA',
    engines: ['T5', 'T6', 'T8 PHEV', 'B4', 'B5', 'D3', 'D4'],
    parts: {
        brakes: {
            discFront: [
                { oem: '31687968', description: '322x28mm Vented', condition: 'B4/D3/D4' },
                { oem: '32223903', description: '345x30mm Vented', condition: 'T6/T8/B5' },
            ],
            discRear: [
                { oem: '31471746', description: '302x12mm Solid' },
            ],
        },
        filters: {
            oil: [
                { oem: '31372212', description: 'Oil Filter Petrol' },
                { oem: '31339023', description: 'Oil Filter Diesel' },
            ],
            air: [
                { oem: '31370161', description: 'Air Filter Standard' },
            ],
            cabin: [
                { oem: '31390880', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const VOLVO_REGISTRY: OEMRegistry = {
    brand: 'Volvo',
    brandCode: 'VOLVO',
    group: 'GEELY',
    models: [
        XC60_II,
        XC40,
        V60_II,
    ],
};

export default VOLVO_REGISTRY;
