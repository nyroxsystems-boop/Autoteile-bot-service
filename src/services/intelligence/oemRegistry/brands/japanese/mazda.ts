/**
 * 🚗 MAZDA OEM Registry
 * 
 * Comprehensive OEM parts database for major Mazda models.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// Mazda 3 BP (2019-present)
// ============================================================================

const MAZDA_3_BP: ModelEntry = {
    name: 'Mazda 3 BP',
    code: 'BP',
    generation: '4. Gen',
    years: [2019, 2026],
    platform: 'Skyactiv',
    engines: ['Skyactiv-G 1.5', 'Skyactiv-G 2.0', 'Skyactiv-G 2.5', 'Skyactiv-X 2.0', 'Skyactiv-D 1.8'],
    parts: {
        brakes: {
            discFront: [
                { oem: 'B45A-33-251A', description: '277x24mm Vented', condition: '2.0L Mexico/Japan' },
                { oem: 'B45G-33-251A', description: '295x26mm Vented', condition: '2.5L Turbo' },
                { oem: 'BDTS-33-251', description: '295x26mm Vented', condition: '2.5 FWD 2019+' },
            ],
            discRear: [
                { oem: 'B45A-26-251A', description: '265x10mm Solid' },
                { oem: 'BHN1-26-251C', description: '280x12mm Solid', condition: 'AWD / Turbo' },
            ],
            padsFront: [
                { oem: 'B45A-33-28Z', description: 'Brake Pads Front' },
            ],
        },
        filters: {
            oil: [
                { oem: 'PE01-14-302A', description: 'Oil Filter Skyactiv-G 2.0/2.5' },
                { oem: 'SH01-14-302A', description: 'Oil Filter Skyactiv-D 1.8' },
            ],
            air: [
                { oem: 'PE07-13-3A0A', description: 'Air Filter Skyactiv-G' },
                { oem: 'SH01-13-3A0A', description: 'Air Filter Skyactiv-D' },
            ],
            cabin: [
                { oem: 'KD45-61-J6X', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Mazda CX-5 KF (2017-present)
// ============================================================================

const MAZDA_CX5_KF: ModelEntry = {
    name: 'CX-5 KF',
    code: 'KF',
    generation: '2. Gen',
    years: [2017, 2026],
    platform: 'Skyactiv',
    engines: ['Skyactiv-G 2.0', 'Skyactiv-G 2.5', 'Skyactiv-G 2.5T', 'Skyactiv-D 2.2'],
    parts: {
        brakes: {
            discFront: [
                { oem: 'K123-33-251', description: '297x28mm Vented', condition: 'Standard' },
                { oem: 'K165-33-251A', description: '320x28mm Vented', condition: '2.5T AWD' },
            ],
            discRear: [
                { oem: 'K123-26-251A', description: '303x14mm Vented' },
            ],
        },
        filters: {
            oil: [
                { oem: 'PE01-14-302A', description: 'Oil Filter Skyactiv-G' },
                { oem: 'SH01-14-302A', description: 'Oil Filter Skyactiv-D 2.2' },
            ],
            air: [
                { oem: 'PE07-13-3A0A', description: 'Air Filter Non-Turbo' },
                { oem: 'PY8W-13-3A0A', description: 'Air Filter 2.5T' },
            ],
            cabin: [
                { oem: 'KD45-61-J6X', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Mazda CX-30 DM (2019-present)
// ============================================================================

const MAZDA_CX30_DM: ModelEntry = {
    name: 'CX-30 DM',
    code: 'DM',
    generation: '1. Gen',
    years: [2019, 2026],
    platform: 'Skyactiv',
    engines: ['Skyactiv-G 2.0', 'Skyactiv-X 2.0', 'Skyactiv-G 2.5T'],
    parts: {
        brakes: {
            discFront: [
                { oem: 'DMCK-33-251', description: '275x26mm Vented', condition: 'FWD' },
                { oem: 'DMCL-33-251', description: '297x28mm Vented', condition: 'AWD / Turbo' },
            ],
            discRear: [
                { oem: 'DMCK-26-251', description: '265x10mm Solid' },
            ],
        },
        filters: {
            oil: [
                { oem: 'PE01-14-302A', description: 'Oil Filter Skyactiv-G' },
            ],
            air: [
                { oem: 'PE07-13-3A0A', description: 'Air Filter Standard' },
            ],
            cabin: [
                { oem: 'KD45-61-J6X', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const MAZDA_REGISTRY: OEMRegistry = {
    brand: 'Mazda',
    brandCode: 'MAZDA',
    group: 'MAZDA',
    models: [
        MAZDA_3_BP,
        MAZDA_CX5_KF,
        MAZDA_CX30_DM,
    ],
};

export default MAZDA_REGISTRY;
