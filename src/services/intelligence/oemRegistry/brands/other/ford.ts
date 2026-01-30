/**
 * 🚗 FORD OEM Registry
 * 
 * Comprehensive OEM parts database for major Ford models (Europe).
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// Focus Mk4 (2018-present)
// ============================================================================

const FOCUS_MK4: ModelEntry = {
    name: 'Focus Mk4',
    code: 'C519',
    generation: 'Mk4',
    years: [2018, 2026],
    platform: 'C2',
    engines: ['1.0 EcoBoost', '1.5 EcoBoost', '1.5 EcoBlue', '2.0 EcoBlue', '2.3 EcoBoost'],
    parts: {
        brakes: {
            discFront: [
                { oem: '2234850', description: '282x27mm Vented', condition: '1.0 EcoBoost' },
                { oem: '2234852', description: '308x27mm Vented', condition: '1.5/2.0 Engines' },
                { oem: '2258837', description: '330x27mm Vented', condition: 'ST Engine' },
            ],
            discRear: [
                { oem: '2178652', description: '271x11mm Solid', condition: 'Standard' },
                { oem: '2178654', description: '302x11mm Solid', condition: 'ST' },
            ],
            padsFront: [
                { oem: '2242137', description: 'Brake Pads Front Standard' },
            ],
        },
        filters: {
            oil: [
                { oem: '2468342', description: 'Oil Filter 1.0 EcoBoost', notes: 'Replaces 1807516/2007929' },
                { oem: '2193141', description: 'Oil Filter 1.5 EcoBlue Diesel' },
            ],
            air: [
                { oem: '1848220', description: 'Air Filter 1.0/1.5 EcoBoost' },
                { oem: '2214346', description: 'Air Filter 1.5/2.0 EcoBlue' },
            ],
            fuel: [
                { oem: '2403632', description: 'Fuel Filter 2.0 EcoBlue Diesel' },
            ],
            cabin: [
                { oem: '2240909', description: 'Cabin Filter Standard' },
            ],
        },
    },
};

// ============================================================================
// Fiesta Mk8 (2017-2023)
// ============================================================================

const FIESTA_MK8: ModelEntry = {
    name: 'Fiesta Mk8',
    code: 'B479',
    generation: 'Mk8',
    years: [2017, 2023],
    platform: 'Global B',
    engines: ['1.0 EcoBoost', '1.1 Ti-VCT', '1.5 EcoBoost'],
    parts: {
        brakes: {
            discFront: [
                { oem: '2112444', description: '262x23mm Vented', condition: '1.0/1.1 Standard' },
                { oem: '2095058', description: '278x23mm Vented', condition: 'ST / Active' },
            ],
            discRear: [
                { oem: '1761180', description: '253x10mm Solid', condition: 'ST / High Spec' },
            ],
            padsFront: [
                { oem: '2118320', description: 'Brake Pads Front Standard' },
            ],
        },
        filters: {
            oil: [
                { oem: '2468342', description: 'Oil Filter 1.0 EcoBoost' },
                { oem: '1714387', description: 'Oil Filter 1.5 TDCi' },
            ],
            air: [
                { oem: '2121345', description: 'Air Filter 1.0 EcoBoost' },
            ],
            cabin: [
                { oem: '1839688', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Kuga Mk3 (2019-present)
// ============================================================================

const KUGA_MK3: ModelEntry = {
    name: 'Kuga Mk3',
    code: 'CX482',
    generation: 'Mk3',
    years: [2019, 2026],
    platform: 'C2',
    engines: ['1.5 EcoBoost', '2.5 Hybrid', '2.0 EcoBlue'],
    parts: {
        brakes: {
            discFront: [
                { oem: '2352525', description: '308x27mm Vented Standard' },
                { oem: '2352527', description: '330x27mm Vented', condition: 'Hybrid / High Spec' },
            ],
            discRear: [
                { oem: '2366870', description: '302x11mm Solid' },
            ],
        },
        filters: {
            oil: [
                { oem: '2265903', description: 'Oil Filter 2.5 Hybrid' },
                { oem: '2193141', description: 'Oil Filter 2.0 EcoBlue' },
            ],
            air: [
                { oem: '2364778', description: 'Air Filter 2.5 Hybrid' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const FORD_REGISTRY: OEMRegistry = {
    brand: 'Ford',
    brandCode: 'FORD',
    group: 'FORD',
    models: [
        FOCUS_MK4,
        FIESTA_MK8,
        KUGA_MK3,
    ],
};

export default FORD_REGISTRY;
