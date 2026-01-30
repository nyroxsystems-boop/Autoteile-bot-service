/**
 * 🚗 HONDA OEM Registry
 * 
 * Comprehensive OEM parts database for major Honda models.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// Civic FC/FK (2016-2021)
// ============================================================================

const CIVIC_FC_FK: ModelEntry = {
    name: 'Civic FC/FK',
    code: 'FC/FK',
    generation: '10. Gen',
    years: [2016, 2021],
    platform: 'Compact Global',
    engines: ['1.5 VTEC Turbo', '1.0 VTEC Turbo', '2.0 Type R'],
    parts: {
        brakes: {
            discFront: [
                { oem: '45251-TEA-T00', description: '262x22mm Vented', condition: '1.0/1.5 VTEC JDM' },
                { oem: '45251-TGH-A01', description: '282x25mm Vented', condition: '1.5 Turbo USDM 2020+' },
                { oem: '45251-TGH-A00', description: '300x28mm Vented', condition: 'Type R FK8' },
            ],
            discRear: [
                { oem: '42510-TEA-T00', description: '257x10mm Solid', condition: 'Standard' },
                { oem: '42510-TGH-A00', description: '282x10mm Solid', condition: 'Type R' },
            ],
        },
        filters: {
            oil: [
                { oem: '15400-PLM-A02', description: 'Oil Filter 1.5 VTEC Turbo' },
            ],
            air: [
                { oem: '17220-5AA-A00', description: 'Air Filter 1.5 VTEC Turbo' },
            ],
            cabin: [
                { oem: '80292-TBA-A11', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Civic FL/FE (2021-present)
// ============================================================================

const CIVIC_FL_FE: ModelEntry = {
    name: 'Civic FL/FE',
    code: 'FL/FE',
    generation: '11. Gen',
    years: [2021, 2026],
    platform: 'Honda Architecture',
    engines: ['1.5 VTEC Turbo', '2.0 NA', '2.0 Type R'],
    parts: {
        brakes: {
            discFront: [
                { oem: '45251-T47-A00', description: '282x25mm Vented', condition: '1.5 Turbo Standard' },
                { oem: '45251-TYB-A00', description: '350x32mm Vented', condition: 'Type R FL5' },
            ],
            discRear: [
                { oem: '42510-T47-A00', description: '282x10mm Solid' },
                { oem: '42510-TYB-A00', description: '305x12mm Solid', condition: 'Type R' },
            ],
        },
        filters: {
            oil: [
                { oem: '15400-PLM-A02', description: 'Oil Filter 1.5/2.0' },
            ],
            air: [
                { oem: '17220-5AA-A00', description: 'Air Filter 1.5 Turbo' },
                { oem: '17220-6F0-A00', description: 'Air Filter 2.0 NA' },
            ],
            cabin: [
                { oem: '80292-TBA-A11', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// CR-V RW (2017-2023)
// ============================================================================

const CR_V_RW: ModelEntry = {
    name: 'CR-V RW',
    code: 'RW',
    generation: '5. Gen',
    years: [2017, 2023],
    platform: 'Compact Global',
    engines: ['1.5 VTEC Turbo', '2.0 i-MMD Hybrid'],
    parts: {
        brakes: {
            discFront: [
                { oem: '45251-TLA-A00', description: '304x28mm Vented', condition: '1.5T FWD' },
                { oem: '45251-TLA-A01', description: '330x28mm Vented', condition: 'AWD / Hybrid' },
            ],
            discRear: [
                { oem: '42510-TLA-A00', description: '302x11mm Solid' },
            ],
        },
        filters: {
            oil: [
                { oem: '15400-PLM-A02', description: 'Oil Filter 1.5 VTEC Turbo' },
                { oem: '15400-R5G-H01', description: 'Oil Filter 2.0 Hybrid' },
            ],
            air: [
                { oem: '17220-5AA-A00', description: 'Air Filter 1.5 Turbo' },
                { oem: '17220-5RH-A00', description: 'Air Filter 2.0 Hybrid' },
            ],
            cabin: [
                { oem: '80292-TLA-A01', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const HONDA_REGISTRY: OEMRegistry = {
    brand: 'Honda',
    brandCode: 'HONDA',
    group: 'HONDA',
    models: [
        CIVIC_FC_FK,
        CIVIC_FL_FE,
        CR_V_RW,
    ],
};

export default HONDA_REGISTRY;
