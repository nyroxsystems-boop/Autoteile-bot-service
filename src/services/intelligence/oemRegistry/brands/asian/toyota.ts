/**
 * 🚗 TOYOTA OEM Registry
 * 
 * Comprehensive OEM parts database for major Toyota models.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// Corolla (E210) (2018-present)
// ============================================================================

const COROLLA_E210: ModelEntry = {
    name: 'Corolla E210',
    code: 'E210',
    generation: '12. Gen',
    years: [2018, 2026],
    platform: 'TNGA-C',
    engines: ['1.8 Hybrid', '2.0 Hybrid', '1.2 Turbo'],
    parts: {
        brakes: {
            discFront: [
                { oem: '43512-02370', description: '282x25mm Vented', condition: '1.8 Hybrid (2ZR-FXE)' },
                { oem: '43512-F4010', description: '296x28mm Vented', condition: '2.0 Hybrid (M20A-FKS)' },
            ],
            discRear: [
                { oem: '42431-02310', description: '270x10mm Solid', condition: 'Standard' },
            ],
            padsFront: [
                { oem: '04465-02480', description: 'Brake Pads Front' },
            ],
        },
        filters: {
            oil: [
                { oem: '90915-YZZN1', description: 'Oil Filter Spin-on 1.8/2.0 Hybrid' },
            ],
            air: [
                { oem: '17801-0T020', description: 'Air Filter 1.8 Hybrid' },
                { oem: '17801-F0020', description: 'Air Filter 2.0 Hybrid' },
            ],
            cabin: [
                { oem: '87139-0E040', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Yaris (XP210) (2020-present)
// ============================================================================

const YARIS_XP210: ModelEntry = {
    name: 'Yaris XP210',
    code: 'XP210',
    generation: '4. Gen',
    years: [2020, 2026],
    platform: 'TNGA-B',
    engines: ['1.5 Hybrid', '1.6 Turbo (GR)'],
    parts: {
        brakes: {
            discFront: [
                { oem: '43512-52180', description: '255x22mm Vented', condition: '1.0/1.5 Hybrid Standard' },
                { oem: '43512-52310', description: '356x28mm Slotted (GR)', condition: 'GR Yaris' },
            ],
            discRear: [
                { oem: '42431-52150', description: '253x9mm Solid', condition: 'Standard' },
                { oem: '42431-52180', description: '297x18mm Slotted (GR)', condition: 'GR Yaris' },
            ],
        },
        filters: {
            oil: [
                { oem: '90915-YZZE1', description: 'Oil Filter 1.5 Hybrid' },
                { oem: '90915-YZZJ1', description: 'Oil Filter 1.6 GR Turbo' },
            ],
            air: [
                { oem: '17801-0T090', description: 'Air Filter 1.5 Hybrid' },
                { oem: '17801-21060', description: 'Air Filter 1.6 GR' },
            ],
            cabin: [
                { oem: '87139-58010', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// RAV4 (XA50) (2018-present)
// ============================================================================

const RAV4_XA50: ModelEntry = {
    name: 'RAV4 XA50',
    code: 'XA50',
    generation: '5. Gen',
    years: [2018, 2026],
    platform: 'TNGA-K',
    engines: ['2.5 Hybrid', '2.5 PHEV'],
    parts: {
        brakes: {
            discFront: [
                { oem: '43512-42100', description: '305x28mm Vented' },
                { oem: '43512-42170', description: '328x28mm Vented', condition: 'Prime / PHEV' },
            ],
            discRear: [
                { oem: '42431-42080', description: '317x12mm Solid' },
            ],
        },
        filters: {
            oil: [
                { oem: '90915-YZZN1', description: 'Oil Filter 2.5 Hybrid' },
            ],
            air: [
                { oem: '17801-F0050', description: 'Air Filter 2.5 Hybrid' },
            ],
            cabin: [
                { oem: '87139-0K070', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const TOYOTA_REGISTRY: OEMRegistry = {
    brand: 'Toyota',
    brandCode: 'TOYOTA',
    group: 'TOYOTA',
    models: [
        COROLLA_E210,
        YARIS_XP210,
        RAV4_XA50,
    ],
};

export default TOYOTA_REGISTRY;
