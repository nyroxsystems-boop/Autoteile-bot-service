/**
 * 🚗 NISSAN OEM Registry
 * 
 * Comprehensive OEM parts database for major Nissan models.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// Qashqai J11 (2014-2021)
// ============================================================================

const QASHQAI_J11: ModelEntry = {
    name: 'Qashqai J11',
    code: 'J11',
    generation: '2. Gen',
    years: [2014, 2021],
    platform: 'CMF-C/D',
    engines: ['1.2 DIG-T', '1.3 DIG-T', '1.5 dCi', '1.6 DIG-T', '2.0 dCi'],
    parts: {
        brakes: {
            discFront: [
                { oem: '40206-4EA0A', description: '296x26mm Vented', condition: 'Standard' },
                { oem: '40206-4EA0B', description: '296x26mm Vented', condition: 'Supersession' },
                { oem: '40206-4BA2A', description: '320x28mm Vented', condition: 'High Power' },
            ],
            discRear: [
                { oem: '43206-4EA0A', description: '292x12mm Solid' },
            ],
        },
        filters: {
            oil: [
                { oem: '152095084R', description: 'Oil Filter 1.2/1.3 DIG-T (Renault)' },
                { oem: '15208-BN700', description: 'Oil Filter 1.5/2.0 dCi' },
            ],
            air: [
                { oem: '16546-4BA1B', description: 'Air Filter 1.2/1.3 DIG-T' },
                { oem: '16546-4EA1B', description: 'Air Filter 1.5/2.0 dCi' },
            ],
            cabin: [
                { oem: '27277-4EA0A', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Qashqai J12 (2021-present)
// ============================================================================

const QASHQAI_J12: ModelEntry = {
    name: 'Qashqai J12',
    code: 'J12',
    generation: '3. Gen',
    years: [2021, 2026],
    platform: 'CMF-C',
    engines: ['1.3 DIG-T', '1.5 e-POWER'],
    parts: {
        brakes: {
            discFront: [
                { oem: '40206-6NA0A', description: '296x26mm Vented', condition: 'Standard' },
                { oem: '40206-6NA1A', description: '320x28mm Vented', condition: 'Tekna/e-POWER' },
            ],
            discRear: [
                { oem: '43206-6NA0A', description: '292x12mm Solid' },
            ],
        },
        filters: {
            oil: [
                { oem: '152095084R', description: 'Oil Filter 1.3 DIG-T' },
                { oem: '152093920R', description: 'Oil Filter e-POWER' },
            ],
            air: [
                { oem: '16546-6NA0A', description: 'Air Filter 1.3 DIG-T' },
            ],
            cabin: [
                { oem: '27277-6NA0A', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// X-Trail T32 (2014-2022)
// ============================================================================

const X_TRAIL_T32: ModelEntry = {
    name: 'X-Trail T32',
    code: 'T32',
    generation: '3. Gen',
    years: [2014, 2022],
    platform: 'CMF-C/D',
    engines: ['1.6 DIG-T', '2.0 MR20DD', '1.6 dCi', '2.0 dCi'],
    parts: {
        brakes: {
            discFront: [
                { oem: '40206-4BA0A', description: '320x28mm Vented' },
            ],
            discRear: [
                { oem: '43206-4BA0A', description: '292x12mm Solid' },
            ],
        },
        filters: {
            oil: [
                { oem: '15208-65F0D', description: 'Oil Filter Petrol' },
                { oem: '15208-BN700', description: 'Oil Filter Diesel' },
            ],
            air: [
                { oem: '16546-4BA1A', description: 'Air Filter' },
            ],
            cabin: [
                { oem: '27277-4BA0A', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const NISSAN_REGISTRY: OEMRegistry = {
    brand: 'Nissan',
    brandCode: 'NISSAN',
    group: 'RENAULT-NISSAN',
    models: [
        QASHQAI_J11,
        QASHQAI_J12,
        X_TRAIL_T32,
    ],
};

export default NISSAN_REGISTRY;
