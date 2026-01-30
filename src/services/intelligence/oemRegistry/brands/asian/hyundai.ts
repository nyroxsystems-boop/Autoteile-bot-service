/**
 * 🚗 HYUNDAI OEM Registry
 * 
 * Comprehensive OEM parts database for major Hyundai models.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// i30 (PD) (2017-2024)
// ============================================================================

const I30_PD: ModelEntry = {
    name: 'i30 PD',
    code: 'PD',
    generation: '3. Gen',
    years: [2017, 2024],
    platform: 'K2',
    engines: ['1.0 T-GDI', '1.4 T-GDI', '1.5 T-GDI', '1.6 CRDi', '2.0 N'],
    parts: {
        brakes: {
            discFront: [
                { oem: '51712-G4000', description: '288x25mm Vented', condition: 'Standard 15 Inch' },
                { oem: '51712-F2000', description: '305x25mm Vented', condition: '16 Inch Wheels' },
                { oem: '51712-S0100', description: '360x30mm Vented', condition: 'i30 N Performance' },
            ],
            discRear: [
                { oem: '58411-G3100', description: '272x10mm Solid', condition: 'Standard' },
                { oem: '58411-S0100', description: '314x20mm Vented', condition: 'i30 N' },
            ],
            padsFront: [
                { oem: '58101-G4A00', description: 'Brake Pads Front Standard' },
                { oem: '58101-S0A00', description: 'Brake Pads Front i30 N' },
            ],
        },
        filters: {
            oil: [
                { oem: '26300-35505', description: 'Oil Filter Spin-on (All Petrol/Diesel 2020+)' },
                { oem: '26320-2M000', description: 'Oil Filter Cartridge (Some 1.6 CRDi)' },
            ],
            air: [
                { oem: '28113-F2000', description: 'Air Filter 1.0/1.4 T-GDI' },
                { oem: '28113-S0100', description: 'Air Filter i30 N' },
            ],
            fuel: [
                { oem: '31922-2E900', description: 'Fuel Filter Diesel' },
            ],
            cabin: [
                { oem: '97133-F2000', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Tucson (NX4) (2020-present)
// ============================================================================

const TUCSON_NX4: ModelEntry = {
    name: 'Tucson NX4',
    code: 'NX4',
    generation: '4. Gen',
    years: [2020, 2026],
    platform: 'N3',
    engines: ['1.6 T-GDI', '1.6 CRDi', '1.6 Hybrid'],
    parts: {
        brakes: {
            discFront: [
                { oem: '51712-L1100', description: '305x25mm Vented', condition: 'Standard' },
                { oem: '51712-N9000', description: '320x28mm Vented', condition: 'Hybrid / N-Line' },
            ],
            discRear: [
                { oem: '58411-N9000', description: '300x10mm Solid' },
            ],
        },
        filters: {
            oil: [
                { oem: '26300-35505', description: 'Oil Filter Spin-on 1.6 T-GDI' },
                { oem: '26350-2M800', description: 'Oil Filter Cartridge 1.6 Hybrid/Diesel' },
            ],
            air: [
                { oem: '28113-N9000', description: 'Air Filter 1.6 T-GDI / Hybrid' },
            ],
            cabin: [
                { oem: '97133-N9000', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Kona (OS) (2017-2023)
// ============================================================================

const KONA_OS: ModelEntry = {
    name: 'Kona',
    code: 'OS',
    generation: '1. Gen',
    years: [2017, 2023],
    platform: 'GB',
    engines: ['1.0 T-GDI', '1.6 T-GDI', 'EV'],
    parts: {
        brakes: {
            discFront: [
                { oem: '51712-J9100', description: '305x25mm Vented Standard' },
            ],
            discRear: [
                { oem: '58411-G3100', description: '284x10mm Solid' },
            ],
        },
        filters: {
            oil: [
                { oem: '26300-35505', description: 'Oil Filter Petrol' },
            ],
            air: [
                { oem: '28113-J9100', description: 'Air Filter Petrol' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const HYUNDAI_REGISTRY: OEMRegistry = {
    brand: 'Hyundai',
    brandCode: 'HYUNDAI',
    group: 'HYUNDAI',
    models: [
        I30_PD,
        TUCSON_NX4,
        KONA_OS,
    ],
};

export default HYUNDAI_REGISTRY;
