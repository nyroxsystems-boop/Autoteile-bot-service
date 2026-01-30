/**
 * 🚗 SKODA OEM Registry
 * 
 * Comprehensive OEM parts database for all major Skoda models.
 * Most parts shared with VW/Audi due to MQB platform.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// Skoda Octavia 3 (Typ 5E) - 2012-2020
// ============================================================================

const OCTAVIA_3: ModelEntry = {
    name: 'Octavia 3',
    code: '5E',
    generation: 'Mk3',
    years: [2012, 2020],
    platform: 'MQB',
    engines: ['CHPA', 'CZEA', 'DADA', 'CJSA', 'DJHA', 'CRLB', 'CUNA', 'DDYA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5Q0615301F', description: '312x25mm Standard', condition: 'Alle außer RS' },
                { oem: '5E0615301C', description: '340x30mm RS', condition: 'Octavia RS' },
            ],
            discRear: [
                { oem: '5Q0615601A', description: '272x10mm Standard' },
                { oem: '5E0615601B', description: '286x12mm RS' },
            ],
            padsFront: [
                { oem: '5Q0698151D', description: 'Bremsbeläge VA Standard' },
                { oem: '5E0698151B', description: 'Bremsbeläge VA RS' },
            ],
            padsRear: [
                { oem: '5Q0698451C', description: 'Bremsbeläge HA' },
            ],
        },
        filters: {
            oil: [
                { oem: '04E115561H', description: 'Ölfilter 1.4 TSI' },
                { oem: '04E115561AC', description: 'Ölfilter 1.5 TSI' },
                { oem: '06L115562', description: 'Ölfilter 1.8/2.0 TSI' },
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
                { oem: '04E121600AL', description: 'Wasserpumpe 1.4 TSI' },
                { oem: '06L121111H', description: 'Wasserpumpe 1.8/2.0 TSI' },
                { oem: '04L121011L', description: 'Wasserpumpe 2.0 TDI' },
            ],
        },
        suspension: {
            shockFront: [
                { oem: '5Q0413023FK', description: 'Stoßdämpfer VA Standard' },
            ],
            controlArm: [
                { oem: '5Q0407151A', description: 'Querlenker VA Links' },
                { oem: '5Q0407152A', description: 'Querlenker VA Rechts' },
            ],
        },
    },
};

// ============================================================================
// Skoda Octavia 4 (Typ NX) - 2020-present
// ============================================================================

const OCTAVIA_4: ModelEntry = {
    name: 'Octavia 4',
    code: 'NX',
    generation: 'Mk4',
    years: [2020, 2026],
    platform: 'MQB Evo',
    engines: ['DPBA', 'DPCA', 'DKFA', 'DFGA', 'DTHA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5Q0615301F', description: '312x25mm Standard' },
                { oem: '5Q0615301G', description: '340x30mm RS' },
            ],
            discRear: [
                { oem: '5Q0615601A', description: '272x10mm Standard' },
            ],
            padsFront: [
                { oem: '5Q0698151D', description: 'Bremsbeläge VA' },
            ],
            padsRear: [
                { oem: '5Q0698451C', description: 'Bremsbeläge HA' },
            ],
        },
        filters: {
            oil: [
                { oem: '04E115561AC', description: 'Ölfilter 1.0-1.5 TSI' },
                { oem: '06Q115561B', description: 'Ölfilter 2.0 TSI RS' },
                { oem: '03N115562B', description: 'Ölfilter 2.0 TDI' },
            ],
        },
    },
};

// ============================================================================
// Skoda Superb 3 (Typ 3V) - 2015-present
// ============================================================================

const SUPERB_3: ModelEntry = {
    name: 'Superb 3',
    code: '3V',
    generation: 'Mk3',
    years: [2015, 2026],
    platform: 'MQB',
    engines: ['CZEA', 'DADA', 'DJHB', 'CUAA', 'DFHA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '3Q0615301A', description: '340x30mm Standard' },
                { oem: '3Q0615301B', description: '340x30mm (Alternative)' },
            ],
            discRear: [
                { oem: '3Q0615601A', description: '300x12mm Standard' },
            ],
            padsFront: [
                { oem: '3Q0698151B', description: 'Bremsbeläge VA' },
            ],
            padsRear: [
                { oem: '3Q0698451A', description: 'Bremsbeläge HA' },
            ],
        },
        filters: {
            oil: [
                { oem: '04E115561H', description: 'Ölfilter 1.4 TSI' },
                { oem: '06L115562', description: 'Ölfilter 2.0 TSI' },
                { oem: '03N115562B', description: 'Ölfilter 2.0 TDI' },
            ],
            air: [
                { oem: '3Q0129620A', description: 'Luftfilter alle Motoren' },
            ],
        },
    },
};

// ============================================================================
// Skoda Kodiaq (Typ NS) - 2016-present
// ============================================================================

const KODIAQ: ModelEntry = {
    name: 'Kodiaq',
    code: 'NS',
    generation: 'Mk1',
    years: [2016, 2026],
    platform: 'MQB',
    engines: ['CZEA', 'DADA', 'DJKC', 'CUAA', 'DFHA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5NA615301A', description: '340x30mm Standard' },
                { oem: '565615301B', description: '357x28mm RS', condition: 'Kodiaq RS' },
            ],
            discRear: [
                { oem: '5NA615601A', description: '300x12mm Standard' },
                { oem: '565615601A', description: '310x22mm RS' },
            ],
            padsFront: [
                { oem: '5NA698151A', description: 'Bremsbeläge VA' },
            ],
            padsRear: [
                { oem: '5NA698451A', description: 'Bremsbeläge HA' },
            ],
        },
        filters: {
            oil: [
                { oem: '04E115561H', description: 'Ölfilter 1.5 TSI' },
                { oem: '06L115562', description: 'Ölfilter 2.0 TSI' },
                { oem: '03N115562B', description: 'Ölfilter 2.0 TDI' },
            ],
        },
    },
};

// ============================================================================
// Skoda Karoq (Typ NU) - 2017-present
// ============================================================================

const KAROQ: ModelEntry = {
    name: 'Karoq',
    code: 'NU',
    generation: 'Mk1',
    years: [2017, 2026],
    platform: 'MQB A1',
    engines: ['DKRF', 'DADA', 'DFGA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5Q0615301F', description: '312x25mm Standard' },
            ],
            discRear: [
                { oem: '5Q0615601A', description: '272x10mm Standard' },
            ],
            padsFront: [
                { oem: '5Q0698151D', description: 'Bremsbeläge VA' },
            ],
        },
        filters: {
            oil: [
                { oem: '04E115561AC', description: 'Ölfilter 1.0-1.5 TSI' },
                { oem: '03N115562B', description: 'Ölfilter 2.0 TDI' },
            ],
        },
    },
};

// ============================================================================
// Skoda Fabia 3/4 - 2014-present
// ============================================================================

const FABIA: ModelEntry = {
    name: 'Fabia 3/4',
    code: 'NJ/PJ',
    generation: 'Mk3/4',
    years: [2014, 2026],
    platform: 'MQB A0',
    engines: ['CHYA', 'CHZB', 'DKRA', 'CZCA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '6R0615301B', description: '256x22mm Standard' },
                { oem: '6R0615301D', description: '288x25mm Monte Carlo' },
            ],
            discRear: [
                { oem: '6R0609617A', description: '200mm Trommel', condition: 'Standard' },
            ],
            padsFront: [
                { oem: '6R0698151A', description: 'Bremsbeläge VA' },
            ],
        },
        filters: {
            oil: [
                { oem: '04C115561J', description: 'Ölfilter 1.0 TSI/MPI' },
            ],
            air: [
                { oem: '6R0129620A', description: 'Luftfilter' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const SKODA_REGISTRY: OEMRegistry = {
    brand: 'Skoda',
    brandCode: 'SKODA',
    group: 'VAG',
    models: [
        OCTAVIA_3,
        OCTAVIA_4,
        SUPERB_3,
        KODIAQ,
        KAROQ,
        FABIA,
    ],
};

export default SKODA_REGISTRY;
