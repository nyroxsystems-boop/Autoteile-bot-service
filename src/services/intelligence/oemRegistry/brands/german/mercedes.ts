/**
 * 🚗 MERCEDES-BENZ OEM Registry
 * 
 * Comprehensive OEM parts database for major Mercedes-Benz models.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// C-Class W205 (2014-2021)
// ============================================================================

const C_CLASS_W205: ModelEntry = {
    name: 'C-Class W205',
    code: 'W205',
    generation: 'W205',
    years: [2014, 2021],
    platform: 'MRA',
    engines: ['OM654', 'OM651', 'M274', 'M264'],
    parts: {
        brakes: {
            discFront: [
                { oem: 'A0004212412', description: '295mm Vented Standard', condition: 'C180/C200/C220d' },
                { oem: 'A0004212612', description: '318mm Vented Sport', condition: 'AMG Line / Sport' },
                { oem: 'A0004212212', description: '342mm Vented/Drilled', condition: 'C300/C400 AMG Packet' },
            ],
            discRear: [
                { oem: 'A0004230512', description: '300mm Solid Standard' },
                { oem: 'A0004231212', description: '320mm Vented' },
            ],
            padsFront: [
                { oem: 'A0084200620', description: 'Brake Pads Front Standard' },
                { oem: 'A0084201820', description: 'Brake Pads Front AMG Line' },
            ],
            padsRear: [
                { oem: 'A0084201920', description: 'Brake Pads Rear Standard' },
            ],
        },
        filters: {
            oil: [
                { oem: 'A6541801100', description: 'Oil Filter OM654', condition: 'C200d/C220d (2018+)' },
                { oem: 'A6511800109', description: 'Oil Filter OM651', condition: 'C220d/C250d (pre-2018)' },
                { oem: 'A2701800109', description: 'Oil Filter M274/M270', condition: 'C180/C200/C250 Petrol' },
            ],
            air: [
                { oem: 'A6540940004', description: 'Air Filter OM654 Diesel' },
                { oem: 'A6510940404', description: 'Air Filter OM651 Diesel' },
                { oem: 'A2740940104', description: 'Air Filter M274 Petrol' },
            ],
            fuel: [
                { oem: 'A6540920005', description: 'Fuel Filter OM654 Diesel' },
                { oem: 'A6510901652', description: 'Fuel Filter OM651 Diesel' },
            ],
            cabin: [
                { oem: 'A2058350147', description: 'Cabin Filter Standard' },
                { oem: 'A2058350047', description: 'Cabin Filter Carbon' },
            ],
        },
    },
};

// ============================================================================
// E-Class W213 (2016-2023)
// ============================================================================

const E_CLASS_W213: ModelEntry = {
    name: 'E-Class W213',
    code: 'W213',
    generation: 'W213',
    years: [2016, 2023],
    platform: 'MRA',
    engines: ['OM654', 'OM656', 'M274', 'M264', 'M256'],
    parts: {
        brakes: {
            discFront: [
                { oem: 'A0004212612', description: '318mm Vented Standard' },
                { oem: 'A0004212812', description: '342mm Vented/Drilled Sport', condition: 'AMG Line' },
                { oem: 'A0004212012', description: '360mm Vented/Drilled', condition: 'E43/E53 AMG' },
            ],
            discRear: [
                { oem: 'A0004230512', description: '300mm Solid Standard' },
                { oem: 'A0004231212', description: '320mm Vented' },
            ],
            padsFront: [
                { oem: 'A0004205000', description: 'Brake Pads Front Standard' },
                { oem: 'A0004205100', description: 'Brake Pads Front AMG Line' },
            ],
        },
        filters: {
            oil: [
                { oem: 'A6541801100', description: 'Oil Filter OM654/OM656 Diesel' },
                { oem: 'A2701800109', description: 'Oil Filter M274 Petrol' },
            ],
            air: [
                { oem: 'A6540940004', description: 'Air Filter OM654 Diesel' },
                { oem: 'A2740940204', description: 'Air Filter M274 Petrol' },
            ],
            fuel: [
                { oem: 'A6540920005', description: 'Fuel Filter OM654 Diesel' },
                { oem: 'A6420906352', description: 'Fuel Filter OM642 Diesel V6' },
            ],
            cabin: [
                { oem: 'A2058350147', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// A-Class W177 (2018-present)
// ============================================================================

const A_CLASS_W177: ModelEntry = {
    name: 'A-Class W177',
    code: 'W177',
    generation: 'W177',
    years: [2018, 2026],
    platform: 'MFA2',
    engines: ['OM608', 'OM654', 'M282', 'M260'],
    parts: {
        brakes: {
            discFront: [
                { oem: 'A2474210900', description: '295mm Vented Standard', condition: 'Standard Brakes' },
                { oem: 'A2474212012', description: '330mm Drilled', condition: 'AMG Line / Sport' },
            ],
            discRear: [
                { oem: 'A2474230000', description: '280mm Solid Standard' },
            ],
            padsFront: [
                { oem: 'A0004207902', description: 'Brake Pads Front Standard' },
                { oem: 'A0004207802', description: 'Brake Pads Front AMG Line' },
            ],
        },
        filters: {
            oil: [
                { oem: 'A6541801100', description: 'Oil Filter OM654 Diesel (A200d/A220d)' },
                { oem: 'A6081800009', description: 'Oil Filter OM608 Diesel (A180d)' },
                { oem: 'A2811800210', description: 'Oil Filter M282 Petrol (A180/A200)' },
            ],
            air: [
                { oem: 'A6540940004', description: 'Air Filter OM654 Diesel' },
                { oem: 'A2820940004', description: 'Air Filter M282 Petrol' },
            ],
            fuel: [
                { oem: 'A6540920005', description: 'Fuel Filter OM654 Diesel' },
                { oem: 'A6080920000', description: 'Fuel Filter OM608 Diesel' },
            ],
            cabin: [
                { oem: 'A2478301702', description: 'Cabin Filter Standard' },
            ],
        },
    },
};

// ============================================================================
// Sprinter W907/W910 (2018-present)
// ============================================================================

const SPRINTER_907: ModelEntry = {
    name: 'Sprinter 907/910',
    code: 'W907',
    generation: 'VS30',
    years: [2018, 2026],
    platform: 'VS30',
    engines: ['OM654', 'OM642', 'OM651'],
    parts: {
        brakes: {
            discFront: [
                { oem: 'A9104210000', description: '300x28mm Standard' },
                { oem: 'A9064210412', description: '300x28mm (Older spec)' },
            ],
            discRear: [
                { oem: 'A9104230100', description: '298mm Standard' },
                { oem: 'A9064230412', description: '303mm' },
            ],
            padsFront: [
                { oem: 'A9104200300', description: 'Brake Pads Front' },
            ],
        },
        filters: {
            oil: [
                { oem: 'A6541801100', description: 'Oil Filter OM654 (2020+)' },
                { oem: 'A6511800109', description: 'Oil Filter OM651 (pre-2020)' },
                { oem: 'A6421800009', description: 'Oil Filter OM642 V6' },
            ],
            air: [
                { oem: 'A9060940004', description: 'Air Filter OM651/642' },
            ],
            cabin: [
                { oem: 'A9068300318', description: 'Cabin Filter' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const MERCEDES_REGISTRY: OEMRegistry = {
    brand: 'Mercedes-Benz',
    brandCode: 'MB',
    group: 'DAIMLER',
    models: [
        C_CLASS_W205,
        E_CLASS_W213,
        A_CLASS_W177,
        SPRINTER_907,
    ],
};

export default MERCEDES_REGISTRY;
