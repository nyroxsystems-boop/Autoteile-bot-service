/**
 * 🚗 KIA OEM Registry
 * 
 * Comprehensive OEM parts database for major KIA models.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// Ceed (CD) (2018-present)
// ============================================================================

const CEED_CD: ModelEntry = {
    name: 'Ceed CD',
    code: 'CD',
    generation: '3. Gen',
    years: [2018, 2026],
    platform: 'K2',
    engines: ['1.0 T-GDI', '1.4 T-GDI', '1.5 T-GDI', '1.6 CRDi', '1.6 GDI Hybrid'],
    parts: {
        brakes: {
            discFront: [
                { oem: '51712-D7000', description: '280x23mm Vented', condition: 'Standard 15 Inch' },
                { oem: '51712-F2000', description: '305x25mm Vented', condition: '16/17 Inch Wheels' },
            ],
            discRear: [
                { oem: '58411-G4100', description: '272x10mm Solid', condition: 'Standard' },
                { oem: '58411-G3100', description: '284x10mm Solid', condition: 'Electronic Parking Brake' },
            ],
            padsFront: [
                { oem: '58101-G4A00', description: 'Brake Pads Front' },
            ],
        },
        filters: {
            oil: [
                { oem: '26300-35505', description: 'Oil Filter 1.0/1.4/1.5 T-GDI' },
                { oem: '26320-2U000', description: 'Oil Filter 1.6 CRDi Diesel' },
            ],
            air: [
                { oem: '28113-F2000', description: 'Air Filter Standard' },
            ],
            cabin: [
                { oem: '97133-F2000', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Sportage (NQ5) (2021-present)
// ============================================================================

const SPORTAGE_NQ5: ModelEntry = {
    name: 'Sportage NQ5',
    code: 'NQ5',
    generation: '5. Gen',
    years: [2021, 2026],
    platform: 'N3',
    engines: ['1.6 T-GDI', '1.6 CRDi', '1.6 Hybrid'],
    parts: {
        brakes: {
            discFront: [
                { oem: '51712-L1100', description: '305x25mm Vented', condition: 'Standard' },
                { oem: '51712-C1000', description: '320x28mm Vented', condition: 'Hybrid / GT-Line' },
            ],
            discRear: [
                { oem: '58411-N9000', description: '300x10mm Solid' },
            ],
        },
        filters: {
            oil: [
                { oem: '26300-35505', description: 'Oil Filter 1.6 T-GDI' },
                { oem: '26350-2M800', description: 'Oil Filter 1.6 Hybrid/Diesel' },
            ],
            air: [
                { oem: '28113-P0400', description: 'Air Filter 1.6 T-GDI' },
            ],
            cabin: [
                { oem: '97133-L1000', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Niro (SG2) (2022-present)
// ============================================================================

const NIRO_SG2: ModelEntry = {
    name: 'Niro SG2',
    code: 'SG2',
    generation: '2. Gen',
    years: [2022, 2026],
    platform: 'K3',
    engines: ['1.6 GDI Hybrid', 'EV'],
    parts: {
        brakes: {
            discFront: [
                { oem: '51712-G2000', description: '280x23mm Vented', condition: 'Hybrid' },
                { oem: '51712-Q4000', description: '305x25mm Vented', condition: 'EV' },
            ],
            discRear: [
                { oem: '58411-G2000', description: '262x10mm Solid', condition: 'Hybrid' },
            ],
        },
        filters: {
            oil: [
                { oem: '26300-35505', description: 'Oil Filter Hybrid' },
            ],
            air: [
                { oem: '28113-Q4000', description: 'Air Filter Hybrid' },
            ],
            cabin: [
                { oem: '97133-Q4000', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const KIA_REGISTRY: OEMRegistry = {
    brand: 'KIA',
    brandCode: 'KIA',
    group: 'HYUNDAI',
    models: [
        CEED_CD,
        SPORTAGE_NQ5,
        NIRO_SG2,
    ],
};

export default KIA_REGISTRY;
