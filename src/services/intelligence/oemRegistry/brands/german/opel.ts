/**
 * 🚗 OPEL OEM Registry
 * 
 * Comprehensive OEM parts database for major Opel models.
 * Mix of GM (pre-2017) and PSA/Stellantis (post-2017) platforms.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// Astra K (2015-2021)
// ============================================================================

const ASTRA_K: ModelEntry = {
    name: 'Astra K',
    code: 'B16',
    generation: 'K',
    years: [2015, 2021],
    platform: 'D2XX',
    engines: ['B10XFL', 'B14XFT', 'B16SHT', 'B16DTH', 'B16DTR'],
    parts: {
        brakes: {
            discFront: [
                { oem: '13502213', description: '296x26mm Vented', condition: '15/16 Inch Wheels' },
                { oem: '13502214', description: '300x26mm Vented', condition: '16/17 Inch Wheels' },
            ],
            discRear: [
                { oem: '13509119', description: '264x10mm Solid', condition: 'Standard' },
                { oem: '13514612', description: '288x12mm Solid', condition: 'Heavy Duty' },
            ],
            padsFront: [
                { oem: '1605252', description: 'Brake Pads Front' },
            ],
            padsRear: [
                { oem: '1605294', description: 'Brake Pads Rear' },
            ],
        },
        filters: {
            oil: [
                { oem: '55594651', description: 'Oil Filter 1.0/1.4 Turbo' },
                { oem: '55588497', description: 'Oil Filter 1.6 CDTI Diesel' },
            ],
            air: [
                { oem: '39023476', description: 'Air Filter 1.4 Turbo' },
                { oem: '13367308', description: 'Air Filter 1.6 CDTI' },
            ],
            fuel: [
                { oem: '13463671', description: 'Fuel Filter 1.6 CDTI Diesel' },
            ],
            cabin: [
                { oem: '13271191', description: 'Cabin Filter Standard' },
                { oem: '13503675', description: 'Cabin Filter Carbon' },
            ],
        },
    },
};

// ============================================================================
// Corsa F (2019-present)
// ============================================================================

const CORSA_F: ModelEntry = {
    name: 'Corsa F',
    code: 'P2JO',
    generation: 'F',
    years: [2019, 2026],
    platform: 'CMP',
    engines: ['F12XEL', 'F12XHT', 'F15DT'],
    parts: {
        brakes: {
            discFront: [
                { oem: '9829345680', description: '283x26mm Vented', condition: 'Standard' },
                { oem: '1686717080', description: '266x22mm Vented', condition: '1.2 Non-Turbo' },
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
                { oem: '9818914980', description: 'Oil Filter 1.2 PureTech/Turbo' },
                { oem: '9809721080', description: 'Oil Filter 1.5 Diesel' },
            ],
            air: [
                { oem: '9805552080', description: 'Air Filter 1.2 Turbo' },
            ],
            cabin: [
                { oem: '9821501880', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Insignia B (2017-2022)
// ============================================================================

const INSIGNIA_B: ModelEntry = {
    name: 'Insignia B',
    code: 'Z18',
    generation: 'B',
    years: [2017, 2022],
    platform: 'E2XX',
    engines: ['B15XFT', 'B20DTH', 'D20DTR'],
    parts: {
        brakes: {
            discFront: [
                { oem: '13597463', description: '300x26mm Vented', condition: '16 Inch Wheels' },
                { oem: '13597465', description: '321x30mm Vented', condition: '17 Inch Wheels' },
                { oem: '23116347', description: '345x30mm Vented', condition: 'GSI / Brembo' },
            ],
            discRear: [
                { oem: '13597473', description: '288x12mm Solid' },
                { oem: '13597475', description: '315x23mm Vented' },
            ],
        },
        filters: {
            oil: [
                { oem: '12605566', description: 'Oil Filter 2.0 Turbo' },
                { oem: '55595505', description: 'Oil Filter 2.0 CDTI' },
            ],
            air: [
                { oem: '84030830', description: 'Air Filter All Engines' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const OPEL_REGISTRY: OEMRegistry = {
    brand: 'Opel',
    brandCode: 'OPEL',
    group: 'STELLANTIS',
    models: [
        ASTRA_K,
        CORSA_F,
        INSIGNIA_B,
    ],
};

export default OPEL_REGISTRY;
