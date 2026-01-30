/**
 * 🚗 AUDI OEM Registry
 * 
 * Comprehensive OEM parts database for all major Audi models.
 * Many parts shared with VW due to MQB/MLB platform sharing.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// Audi A3 8V (Typ 8V) - 2012-2020
// ============================================================================

const A3_8V: ModelEntry = {
    name: 'A3 8V',
    code: '8V',
    generation: '3. Gen',
    years: [2012, 2020],
    platform: 'MQB',
    engines: ['CJSA', 'CXSA', 'CZPB', 'CHHB', 'DJHA', 'CRLB', 'CUNA', 'DFGA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5Q0615301F', description: '312x25mm Standard', condition: 'Alle außer S3' },
                { oem: '5Q0615301P', description: '340x30mm S3', condition: 'S3 8V / RS3' },
                { oem: '8V0615301B', description: '312x25mm A3 Sportback e-tron' },
            ],
            discRear: [
                { oem: '5Q0615601A', description: '272x10mm Standard' },
                { oem: '5Q0615601E', description: '310x22mm S3/RS3', condition: 'S-Line / S3' },
                { oem: '8V0615601N', description: '310x22mm RS3' },
            ],
            padsFront: [
                { oem: '5Q0698151D', description: 'Bremsbeläge VA Standard' },
                { oem: '8V0698151L', description: 'Bremsbeläge VA S3/RS3' },
            ],
            padsRear: [
                { oem: '5Q0698451C', description: 'Bremsbeläge HA Standard' },
                { oem: '8V0698451J', description: 'Bremsbeläge HA S3/RS3' },
            ],
        },
        filters: {
            oil: [
                { oem: '04E115561H', description: 'Ölfilter 1.4 TFSI' },
                { oem: '06L115562', description: 'Ölfilter 1.8/2.0 TFSI' },
                { oem: '03N115562B', description: 'Ölfilter 2.0 TDI' },
            ],
            air: [
                { oem: '5Q0129620B', description: 'Luftfilter Benziner' },
                { oem: '5Q0129620D', description: 'Luftfilter Diesel' },
            ],
            cabin: [
                { oem: '5Q0819653', description: 'Innenraumfilter Standard' },
                { oem: '5Q0819669', description: 'Innenraumfilter Aktivkohle' },
            ],
        },
        cooling: {
            waterPump: [
                { oem: '04E121600AL', description: 'Wasserpumpe 1.4 TFSI', condition: 'EA211' },
                { oem: '06L121111H', description: 'Wasserpumpe 1.8/2.0 TFSI', condition: 'EA888 Gen3' },
                { oem: '04L121011L', description: 'Wasserpumpe 2.0 TDI', condition: 'EA288' },
            ],
        },
        suspension: {
            shockFront: [
                { oem: '5Q0413023FK', description: 'Stoßdämpfer VA Standard' },
                { oem: '5Q0413031FM', description: 'Stoßdämpfer VA DCC' },
            ],
            shockRear: [
                { oem: '5Q0512011S', description: 'Stoßdämpfer HA Standard' },
            ],
            controlArm: [
                { oem: '5Q0407151A', description: 'Querlenker VA Links' },
                { oem: '5Q0407152A', description: 'Querlenker VA Rechts' },
            ],
        },
        engine: {
            timingKit: [
                { oem: '04E198119A', description: 'Zahnriemensatz 1.4 TFSI', condition: 'EA211' },
                { oem: '06K109158AD', description: 'Steuerkettensatz', condition: 'EA888' },
            ],
        },
    },
};

// ============================================================================
// Audi A3 8Y (Typ 8Y) - 2020-present
// ============================================================================

const A3_8Y: ModelEntry = {
    name: 'A3 8Y',
    code: '8Y',
    generation: '4. Gen',
    years: [2020, 2026],
    platform: 'MQB Evo',
    engines: ['DPBA', 'DFYA', 'DNUE', 'DFGA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5Q0615301F', description: '312x25mm Standard' },
                { oem: '5Q0615301G', description: '340x30mm S3' },
            ],
            discRear: [
                { oem: '5Q0615601A', description: '272x10mm Standard' },
                { oem: '5Q0615601G', description: '310x22mm S3' },
            ],
        },
        filters: {
            oil: [
                { oem: '04E115561AC', description: 'Ölfilter 1.5 TFSI' },
                { oem: '06Q115561B', description: 'Ölfilter 2.0 TFSI S3' },
            ],
        },
    },
};

// ============================================================================
// Audi A4 B8 (Typ 8K) - 2007-2015
// ============================================================================

const A4_B8: ModelEntry = {
    name: 'A4 B8',
    code: '8K',
    generation: 'B8',
    years: [2007, 2015],
    platform: 'MLB',
    engines: ['CABA', 'CDAA', 'CDNC', 'CAEB', 'CAHA', 'CAGB'],
    parts: {
        brakes: {
            discFront: [
                { oem: '8K0615301A', description: '314x25mm Standard' },
                { oem: '8K0615301K', description: '345x30mm S4/S5', condition: 'quattro Sport' },
            ],
            discRear: [
                { oem: '8K0615601A', description: '300x12mm Standard' },
                { oem: '8K0615601M', description: '330x22mm S4/S5' },
            ],
            padsFront: [
                { oem: '8K0698151H', description: 'Bremsbeläge VA 314mm' },
                { oem: '8K0698151K', description: 'Bremsbeläge VA 345mm' },
            ],
            padsRear: [
                { oem: '8K0698451F', description: 'Bremsbeläge HA' },
            ],
        },
        filters: {
            oil: [
                { oem: '06L115562', description: 'Ölfilter 1.8/2.0 TFSI' },
                { oem: '03L115562', description: 'Ölfilter 2.0 TDI' },
                { oem: '059115561B', description: 'Ölfilter 2.7/3.0 TDI V6' },
            ],
            air: [
                { oem: '8K0133843D', description: 'Luftfilter 2.0 TFSI/TDI' },
                { oem: '8K0133843K', description: 'Luftfilter 3.0 TDI V6' },
            ],
        },
        cooling: {
            waterPump: [
                { oem: '06H121026DD', description: 'Wasserpumpe 1.8/2.0 TFSI', condition: 'EA888 Gen2' },
                { oem: '03L121011E', description: 'Wasserpumpe 2.0 TDI', condition: 'EA189' },
            ],
        },
        engine: {
            timingKit: [
                { oem: '06H109469AH', description: 'Steuerkettensatz', condition: 'EA888' },
            ],
        },
    },
};

// ============================================================================
// Audi A4 B9 (Typ 8W) - 2015-present
// ============================================================================

const A4_B9: ModelEntry = {
    name: 'A4 B9',
    code: '8W',
    generation: 'B9',
    years: [2015, 2026],
    platform: 'MLB Evo',
    engines: ['CVKB', 'CYRB', 'DETA', 'DEUA', 'DHEA', 'DTUA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '8W0615301T', description: '314x25mm Standard' },
                { oem: '8W0615301AB', description: '338x30mm', condition: 'Sport-Paket' },
                { oem: '8W0615301N', description: '375x36mm S4/RS4' },
            ],
            discRear: [
                { oem: '8W0615601K', description: '330x22mm Standard' },
                { oem: '8W0615601E', description: '330x22mm (Alternative)' },
            ],
            padsFront: [
                { oem: '8W0698151AG', description: 'Bremsbeläge VA 314mm' },
                { oem: '8W0698151AH', description: 'Bremsbeläge VA 338mm' },
            ],
            padsRear: [
                { oem: '8W0698451L', description: 'Bremsbeläge HA' },
            ],
        },
        filters: {
            oil: [
                { oem: '06L115562', description: 'Ölfilter 2.0 TFSI', condition: 'EA888 Gen3' },
                { oem: '04L115561B', description: 'Ölfilter 2.0 TDI', condition: 'EA288' },
                { oem: '059115561B', description: 'Ölfilter 3.0 TDI V6' },
            ],
            air: [
                { oem: '8W0133843A', description: 'Luftfilter 2.0 TFSI/TDI' },
                { oem: '8W0133843C', description: 'Luftfilter 3.0 TDI' },
            ],
            cabin: [
                { oem: '4M0819439A', description: 'Innenraumfilter Standard' },
            ],
        },
        cooling: {
            waterPump: [
                { oem: '06L121111H', description: 'Wasserpumpe 2.0 TFSI', condition: 'EA888 Gen3' },
                { oem: '04L121011K', description: 'Wasserpumpe 2.0 TDI', condition: 'EA288' },
            ],
        },
    },
};

// ============================================================================
// Audi Q5 8R (Typ 8R) - 2008-2017
// ============================================================================

const Q5_8R: ModelEntry = {
    name: 'Q5 8R',
    code: '8R',
    generation: '1. Gen',
    years: [2008, 2017],
    platform: 'MLB',
    engines: ['CDNC', 'CNCD', 'CAHA', 'CGLA', 'CCWA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '8K0615301A', description: '320x30mm Standard' },
                { oem: '8R0615301H', description: '345x30mm SQ5', condition: 'S-Line' },
            ],
            discRear: [
                { oem: '8K0615601A', description: '300x12mm Standard' },
                { oem: '8R0615601B', description: '330x22mm SQ5' },
            ],
            padsFront: [
                { oem: '8K0698151L', description: 'Bremsbeläge VA' },
            ],
            padsRear: [
                { oem: '8K0698451F', description: 'Bremsbeläge HA' },
            ],
        },
        filters: {
            oil: [
                { oem: '06L115562', description: 'Ölfilter 2.0 TFSI' },
                { oem: '03L115562', description: 'Ölfilter 2.0 TDI' },
                { oem: '059115561B', description: 'Ölfilter 3.0 TDI' },
            ],
            air: [
                { oem: '8R0133843K', description: 'Luftfilter' },
            ],
        },
    },
};

// ============================================================================
// Audi Q5 FY (Typ FY) - 2017-present
// ============================================================================

const Q5_FY: ModelEntry = {
    name: 'Q5 FY',
    code: 'FY',
    generation: '2. Gen',
    years: [2017, 2026],
    platform: 'MLB Evo',
    engines: ['DETA', 'DEUA', 'DHEA', 'DTUA', 'DHLA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '80A615301A', description: '338x30mm Standard' },
                { oem: '80A615301B', description: '350x34mm SQ5' },
            ],
            discRear: [
                { oem: '80A615601B', description: '330x22mm Standard' },
            ],
            padsFront: [
                { oem: '80A698151B', description: 'Bremsbeläge VA' },
            ],
            padsRear: [
                { oem: '80A698451A', description: 'Bremsbeläge HA' },
            ],
        },
        filters: {
            oil: [
                { oem: '06L115562', description: 'Ölfilter 2.0 TFSI' },
                { oem: '04L115561B', description: 'Ölfilter 2.0 TDI' },
            ],
            air: [
                { oem: '80A133843A', description: 'Luftfilter alle Motoren' },
            ],
        },
    },
};

// ============================================================================
// Audi TT 8S (Typ 8S/FV) - 2014-present
// ============================================================================

const TT_8S: ModelEntry = {
    name: 'TT 8S',
    code: '8S',
    generation: '3. Gen',
    years: [2014, 2026],
    platform: 'MQB',
    engines: ['CHHC', 'CJXH', 'DKTB', 'DKTC'],
    parts: {
        brakes: {
            discFront: [
                { oem: '8S0615301B', description: '312x25mm TT Standard' },
                { oem: '8S0615301F', description: '340x30mm TTS', condition: 'TTS' },
                { oem: '8V0615301S', description: '370x34mm TTRS', condition: 'TTRS' },
            ],
            discRear: [
                { oem: '8S0615601A', description: '272x10mm Standard' },
                { oem: '8S0615601C', description: '310x22mm TTS/TTRS' },
            ],
            padsFront: [
                { oem: '8S0698151A', description: 'Bremsbeläge VA TT' },
                { oem: '8V0698151S', description: 'Bremsbeläge VA TTS/TTRS' },
            ],
        },
        filters: {
            oil: [
                { oem: '06L115562', description: 'Ölfilter 2.0 TFSI' },
            ],
            air: [
                { oem: '8S0129620A', description: 'Luftfilter' },
            ],
        },
        cooling: {
            waterPump: [
                { oem: '06L121111H', description: 'Wasserpumpe 2.0 TFSI' },
                { oem: '06L121111P', description: 'Wasserpumpe 2.0 TFSI evo' },
            ],
        },
    },
};

// ============================================================================
// Audi A6 C7 (Typ 4G) - 2011-2018
// ============================================================================

const A6_C7: ModelEntry = {
    name: 'A6 C7',
    code: '4G',
    generation: 'C7',
    years: [2011, 2018],
    platform: 'MLB',
    engines: ['CYPA', 'CHVA', 'CGWD', 'CDUC', 'CTUC'],
    parts: {
        brakes: {
            discFront: [
                { oem: '4G0615301AH', description: '320x30mm Standard' },
                { oem: '4G0615301K', description: '356x34mm S6' },
            ],
            discRear: [
                { oem: '4G0615601F', description: '302x22mm Standard' },
                { oem: '4G0615601K', description: '330x22mm S6' },
            ],
            padsFront: [
                { oem: '4G0698151F', description: 'Bremsbeläge VA' },
            ],
            padsRear: [
                { oem: '4G0698451B', description: 'Bremsbeläge HA' },
            ],
        },
        filters: {
            oil: [
                { oem: '06L115562', description: 'Ölfilter 2.0 TFSI' },
                { oem: '059115561B', description: 'Ölfilter 3.0 TDI' },
            ],
            air: [
                { oem: '4G0133843A', description: 'Luftfilter' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const AUDI_REGISTRY: OEMRegistry = {
    brand: 'Audi',
    brandCode: 'AUDI',
    group: 'VAG',
    models: [
        A3_8V,
        A3_8Y,
        A4_B8,
        A4_B9,
        Q5_8R,
        Q5_FY,
        TT_8S,
        A6_C7,
    ],
};

export default AUDI_REGISTRY;
