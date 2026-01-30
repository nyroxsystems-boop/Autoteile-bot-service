/**
 * 🚗 SEAT/CUPRA OEM Registry
 * 
 * Comprehensive OEM parts database for SEAT and Cupra models.
 * Almost all parts shared with VW/Audi due to MQB platform.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// SEAT Leon 3 (Typ 5F) - 2012-2020
// ============================================================================

const LEON_3: ModelEntry = {
    name: 'Leon 3',
    code: '5F',
    generation: 'Mk3',
    years: [2012, 2020],
    platform: 'MQB',
    engines: ['CHPA', 'CZEA', 'DADA', 'CJSA', 'CHHB', 'CJXF', 'CRLB', 'CUNA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5Q0615301F', description: '312x25mm Standard' },
                { oem: '5Q0615301G', description: '340x30mm Cupra', condition: 'Cupra/FR' },
                { oem: '5F0615301D', description: '340x30mm Cupra R', condition: 'Cupra R' },
            ],
            discRear: [
                { oem: '5Q0615601A', description: '272x10mm Standard' },
                { oem: '5Q0615601G', description: '310x22mm Cupra' },
            ],
            padsFront: [
                { oem: '5Q0698151D', description: 'Bremsbeläge VA Standard' },
                { oem: '5Q0698151M', description: 'Bremsbeläge VA Cupra' },
            ],
            padsRear: [
                { oem: '5Q0698451C', description: 'Bremsbeläge HA Standard' },
            ],
        },
        filters: {
            oil: [
                { oem: '04E115561H', description: 'Ölfilter 1.4 TSI' },
                { oem: '06L115562', description: 'Ölfilter 1.8/2.0 TSI' },
                { oem: '03N115562B', description: 'Ölfilter 2.0 TDI' },
            ],
            air: [
                { oem: '5Q0129620B', description: 'Luftfilter Benziner' },
                { oem: '5Q0129620D', description: 'Luftfilter Diesel' },
            ],
            cabin: [
                { oem: '5Q0819653', description: 'Innenraumfilter Standard' },
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
                { oem: '5Q0413031FM', description: 'Stoßdämpfer VA DCC' },
            ],
            controlArm: [
                { oem: '5Q0407151A', description: 'Querlenker VA Links' },
                { oem: '5Q0407152A', description: 'Querlenker VA Rechts' },
            ],
        },
        engine: {
            turbo: [
                { oem: '06K145874F', description: 'Turbolader Cupra (IS20)', condition: 'Motor CHH*' },
                { oem: '06K145722H', description: 'Turbolader Cupra R (IS38)', condition: 'Motor CJX*' },
            ],
        },
    },
};

// ============================================================================
// SEAT Leon 4 / Cupra Leon (Typ KL) - 2020-present
// ============================================================================

const LEON_4: ModelEntry = {
    name: 'Leon 4 / Cupra Leon',
    code: 'KL',
    generation: 'Mk4',
    years: [2020, 2026],
    platform: 'MQB Evo',
    engines: ['DPBA', 'DPCA', 'DKFA', 'DNUE', 'DFGA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5Q0615301F', description: '312x25mm Standard' },
                { oem: '5Q0615301G', description: '340x30mm Cupra' },
                { oem: '5H0615301B', description: '357x28mm Cupra VZ', condition: 'VZ Performance' },
            ],
            discRear: [
                { oem: '5Q0615601A', description: '272x10mm Standard' },
                { oem: '5Q0615601G', description: '310x22mm Cupra' },
            ],
            padsFront: [
                { oem: '5Q0698151D', description: 'Bremsbeläge VA Standard' },
                { oem: '5Q0698151M', description: 'Bremsbeläge VA Cupra' },
            ],
        },
        filters: {
            oil: [
                { oem: '04E115561AC', description: 'Ölfilter 1.0-1.5 TSI' },
                { oem: '06Q115561B', description: 'Ölfilter 2.0 TSI Cupra' },
            ],
        },
    },
};

// ============================================================================
// SEAT Ibiza 4/5 - 2008-present
// ============================================================================

const IBIZA: ModelEntry = {
    name: 'Ibiza 4/5',
    code: '6J/6F/KJ',
    generation: 'Mk4/5',
    years: [2008, 2026],
    platform: 'PQ25/MQB A0',
    engines: ['CHYA', 'CHZB', 'DKRA', 'CZCA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '6R0615301B', description: '256x22mm Standard', condition: 'Basis' },
                { oem: '2Q0615301B', description: '288x25mm FR', condition: 'FR / Cupra' },
            ],
            discRear: [
                { oem: '6R0609617A', description: '200mm Trommel', condition: 'Standard' },
                { oem: '2Q0615601A', description: '232x9mm Scheibe', condition: 'FR' },
            ],
            padsFront: [
                { oem: '6R0698151A', description: 'Bremsbeläge VA' },
            ],
        },
        filters: {
            oil: [
                { oem: '04C115561J', description: 'Ölfilter 1.0 TSI/MPI' },
                { oem: '04E115561H', description: 'Ölfilter 1.5 TSI' },
            ],
            air: [
                { oem: '2Q0129620B', description: 'Luftfilter Benziner' },
            ],
        },
    },
};

// ============================================================================
// SEAT Ateca / Cupra Ateca - 2016-present
// ============================================================================

const ATECA: ModelEntry = {
    name: 'Ateca / Cupra Ateca',
    code: '5FP',
    generation: 'Mk1',
    years: [2016, 2026],
    platform: 'MQB A1',
    engines: ['DADA', 'DPCA', 'DJHB', 'DFGA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5Q0615301F', description: '312x25mm Standard' },
                { oem: '5FJ615301A', description: '340x30mm Cupra', condition: 'Cupra Ateca' },
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
                { oem: '04E115561AC', description: 'Ölfilter 1.5 TSI' },
                { oem: '06L115562', description: 'Ölfilter 2.0 TSI' },
                { oem: '03N115562B', description: 'Ölfilter 2.0 TDI' },
            ],
        },
        cooling: {
            waterPump: [
                { oem: '04E121600CS', description: 'Wasserpumpe 1.5 TSI' },
                { oem: '06L121111P', description: 'Wasserpumpe 2.0 TSI' },
            ],
        },
    },
};

// ============================================================================
// SEAT Arona - 2017-present
// ============================================================================

const ARONA: ModelEntry = {
    name: 'Arona',
    code: 'KJ7',
    generation: 'Mk1',
    years: [2017, 2026],
    platform: 'MQB A0',
    engines: ['DKRA', 'DKRF', 'CZCA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '2Q0615301A', description: '256x22mm Standard' },
                { oem: '2Q0615301B', description: '288x25mm FR' },
            ],
            discRear: [
                { oem: '2Q0615601A', description: '232x9mm Standard' },
            ],
            padsFront: [
                { oem: '2Q0698151F', description: 'Bremsbeläge VA' },
            ],
        },
        filters: {
            oil: [
                { oem: '04C115561J', description: 'Ölfilter 1.0 TSI' },
                { oem: '04E115561AC', description: 'Ölfilter 1.5 TSI' },
            ],
        },
    },
};

// ============================================================================
// Cupra Formentor - 2020-present
// ============================================================================

const FORMENTOR: ModelEntry = {
    name: 'Formentor',
    code: 'KM',
    generation: 'Mk1',
    years: [2020, 2026],
    platform: 'MQB Evo',
    engines: ['DADA', 'DKFA', 'DNUE', 'DFGA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5Q0615301F', description: '312x25mm Standard', condition: '150PS' },
                { oem: '5Q0615301G', description: '340x30mm', condition: '245PS' },
                { oem: '5H0615301B', description: '357x28mm VZ5', condition: 'VZ5 (390PS)' },
            ],
            discRear: [
                { oem: '5Q0615601A', description: '272x10mm Standard' },
                { oem: '5Q0615601G', description: '310x22mm VZ' },
            ],
            padsFront: [
                { oem: '5Q0698151D', description: 'Bremsbeläge VA Standard' },
                { oem: '5Q0698151M', description: 'Bremsbeläge VA VZ' },
            ],
        },
        filters: {
            oil: [
                { oem: '04E115561AC', description: 'Ölfilter 1.5 TSI' },
                { oem: '06Q115561B', description: 'Ölfilter 2.0 TSI' },
            ],
        },
        cooling: {
            waterPump: [
                { oem: '04E121600CS', description: 'Wasserpumpe 1.5 TSI' },
                { oem: '06L121111P', description: 'Wasserpumpe 2.0 TSI' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const SEAT_REGISTRY: OEMRegistry = {
    brand: 'SEAT/Cupra',
    brandCode: 'SEAT',
    group: 'VAG',
    models: [
        LEON_3,
        LEON_4,
        IBIZA,
        ATECA,
        ARONA,
        FORMENTOR,
    ],
};

export default SEAT_REGISTRY;
