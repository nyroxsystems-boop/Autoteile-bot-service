/**
 * 🚗 VOLKSWAGEN OEM Registry
 * 
 * Comprehensive OEM parts database for all major VW models.
 * Data sourced from official VW parts catalogs and verified suppliers.
 */

import { OEMRegistry, ModelEntry } from '../../types';

// ============================================================================
// VW Golf 7 (Typ 5G, AU) - 2012-2020
// ============================================================================

const GOLF_7: ModelEntry = {
    name: 'Golf 7',
    code: '5G',
    generation: 'Mk7',
    years: [2012, 2020],
    platform: 'MQB',
    engines: ['CHPA', 'CPTA', 'CZEA', 'DADA', 'CJSA', 'CHHB', 'CJXC', 'CRLB', 'CUNA', 'DFGA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5Q0615301F', description: '312x25mm Standard', condition: 'PR 1ZA/1ZD' },
                { oem: '5Q0615301G', description: '340x30mm Performance', condition: 'PR 1ZK (GTI PP/R)' },
                { oem: '5Q0615301H', description: '312x25mm TDI', condition: 'PR 1ZM' },
                { oem: '5Q0615301E', description: '276x24mm Basis', condition: 'PR 1ZE' },
                { oem: '5Q0615301C', description: '312x25mm GTI', condition: 'PR 1ZF' },
            ],
            discRear: [
                { oem: '5Q0615601A', description: '272x10mm Standard', condition: 'PR 1KD' },
                { oem: '5Q0615601G', description: '310x22mm Performance', condition: 'PR 1KT (GTI PP/R)' },
                { oem: '5Q0615601F', description: '286x12mm GTI', condition: 'PR 1KF' },
            ],
            padsFront: [
                { oem: '5Q0698151A', description: 'Bremsbeläge VA Standard', supersededBy: '5Q0698151D' },
                { oem: '5Q0698151D', description: 'Bremsbeläge VA Aktuell' },
                { oem: '5Q0698151M', description: 'Bremsbeläge VA GTI/R (340mm)' },
            ],
            padsRear: [
                { oem: '5Q0698451A', description: 'Bremsbeläge HA Standard', supersededBy: '5Q0698451C' },
                { oem: '5Q0698451C', description: 'Bremsbeläge HA Aktuell' },
                { oem: '5Q0698451N', description: 'Bremsbeläge HA GTI/R Performance' },
            ],
        },
        filters: {
            oil: [
                { oem: '04E115561H', description: 'Ölfilter 1.0-1.4 TSI (EA211)', condition: 'Motor CHZ*/CPT*/CHP*/CZE*' },
                { oem: '04E115561AC', description: 'Ölfilter 1.5 TSI (EA211 evo)', condition: 'Motor DAD*/DPC*' },
                { oem: '06L115562', description: 'Ölfilter 1.8/2.0 TSI (EA888)', condition: 'Motor CJS*/CHH*/CJX*' },
                { oem: '03N115562B', description: 'Ölfilter 2.0 TDI (EA288)', condition: 'Motor CRL*/CUN*/DFG*' },
                { oem: '03N115466A', description: 'Ölfilter 1.6 TDI (EA288)', condition: 'Motor CLH*/CRK*/CXX*' },
            ],
            air: [
                { oem: '5Q0129620B', description: 'Luftfilter Standard', condition: 'Alle Benziner' },
                { oem: '5Q0129620D', description: 'Luftfilter TDI', condition: 'Alle Diesel' },
            ],
            fuel: [
                { oem: '5Q0127177B', description: 'Kraftstofffilter Benzin (im Tank)', condition: 'TSI Motoren' },
                { oem: '5Q0127400F', description: 'Kraftstofffilter Diesel', condition: '1.6 TDI' },
                { oem: '5Q0127400G', description: 'Kraftstofffilter Diesel', condition: '2.0 TDI' },
            ],
            cabin: [
                { oem: '5Q0819653', description: 'Innenraumfilter Standard' },
                { oem: '5Q0819669', description: 'Innenraumfilter Aktivkohle' },
            ],
        },
        cooling: {
            waterPump: [
                { oem: '04E121600AL', description: 'Wasserpumpe 1.0-1.4 TSI', condition: 'EA211 Riemen' },
                { oem: '04E121600CS', description: 'Wasserpumpe 1.5 TSI', condition: 'EA211 evo' },
                { oem: '06L121111H', description: 'Wasserpumpe 1.8/2.0 TSI', condition: 'EA888 Gen3' },
                { oem: '06L121111P', description: 'Wasserpumpe 2.0 TSI (aktuell)', condition: 'EA888 Gen3B', notes: 'Supersedes 06L121111H' },
                { oem: '04L121011L', description: 'Wasserpumpe 2.0 TDI', condition: 'EA288' },
                { oem: '03L121011PX', description: 'Wasserpumpe 1.6 TDI', condition: 'EA288' },
            ],
            thermostat: [
                { oem: '04E121113B', description: 'Thermostat 1.4 TSI', condition: 'EA211' },
                { oem: '06L121111J', description: 'Thermostatgehäuse 1.8/2.0 TSI', condition: 'EA888' },
            ],
        },
        suspension: {
            shockFront: [
                { oem: '5Q0413023FK', description: 'Stoßdämpfer VA Standard', condition: 'Ohne DCC' },
                { oem: '5Q0413031FM', description: 'Stoßdämpfer VA DCC', condition: 'Mit DCC (elektronisch)' },
                { oem: '5Q0413031ED', description: 'Stoßdämpfer VA DCC (Alternative)', condition: 'DCC System' },
            ],
            shockRear: [
                { oem: '5Q0512011S', description: 'Stoßdämpfer HA Standard', condition: 'Ohne DCC' },
                { oem: '5Q0512011T', description: 'Stoßdämpfer HA DCC', condition: 'Mit DCC' },
            ],
            controlArm: [
                { oem: '5Q0407151A', description: 'Querlenker VA Links' },
                { oem: '5Q0407152A', description: 'Querlenker VA Rechts' },
                { oem: '5Q0407151B', description: 'Querlenker VA Links (verstärkt)', condition: 'GTI/R' },
            ],
            wheelBearing: [
                { oem: '5Q0498621', description: 'Radlager VA' },
                { oem: '5Q0598611', description: 'Radlager HA' },
            ],
        },
        engine: {
            timingKit: [
                { oem: '04E198119A', description: 'Zahnriemensatz 1.4 TSI', condition: 'EA211 (Riemen)' },
                { oem: '04E198119E', description: 'Zahnriemensatz 1.5 TSI', condition: 'EA211 evo' },
                { oem: '06K109158AD', description: 'Steuerkettensatz', condition: 'EA888 (Kette)' },
                { oem: '04L198119A', description: 'Zahnriemensatz 2.0 TDI', condition: 'EA288' },
                { oem: '03L198119A', description: 'Zahnriemensatz 1.6 TDI', condition: 'EA288' },
            ],
            sparkPlug: [
                { oem: '04E905612C', description: 'Zündkerze 1.0-1.5 TSI', condition: 'EA211' },
                { oem: '06K905601B', description: 'Zündkerze 2.0 TSI', condition: 'EA888' },
            ],
            turbo: [
                { oem: '06K145874F', description: 'Turbolader 2.0 TSI GTI (IS20)', condition: 'Motor CHH*' },
                { oem: '06K145722H', description: 'Turbolader 2.0 TSI R (IS38)', condition: 'Motor CJX*' },
            ],
        },
    },
};

// ============================================================================
// VW Golf 8 (Typ CD) - 2019-present
// ============================================================================

const GOLF_8: ModelEntry = {
    name: 'Golf 8',
    code: 'CD',
    generation: 'Mk8',
    years: [2019, 2026],
    platform: 'MQB Evo',
    engines: ['DKRF', 'DPCA', 'DPBA', 'DKFA', 'DNUE', 'DFGA', 'DFBA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5Q0615301F', description: '312x25mm Standard', condition: 'PR 1ZA' },
                { oem: '5Q0615301G', description: '340x30mm GTI/R', condition: 'PR 1ZK' },
                { oem: '5H0615301B', description: '357x28mm R 20 Jahre', condition: 'PR 1ZX' },
            ],
            discRear: [
                { oem: '5Q0615601A', description: '272x10mm Standard' },
                { oem: '5Q0615601G', description: '310x22mm GTI/R' },
            ],
            padsFront: [
                { oem: '5Q0698151D', description: 'Bremsbeläge VA Standard' },
                { oem: '5Q0698151M', description: 'Bremsbeläge VA GTI/R' },
            ],
            padsRear: [
                { oem: '5Q0698451C', description: 'Bremsbeläge HA Standard' },
            ],
        },
        filters: {
            oil: [
                { oem: '04E115561AC', description: 'Ölfilter 1.0-1.5 TSI', condition: 'EA211 evo' },
                { oem: '06Q115561B', description: 'Ölfilter 2.0 TSI GTI/R', condition: 'EA888 Gen4' },
                { oem: '03N115562B', description: 'Ölfilter 2.0 TDI', condition: 'EA288 evo' },
            ],
            air: [
                { oem: '5H0129620A', description: 'Luftfilter alle Motoren' },
            ],
            cabin: [
                { oem: '5Q0819653', description: 'Innenraumfilter Standard' },
                { oem: '5Q0819669', description: 'Innenraumfilter Aktivkohle' },
            ],
        },
        cooling: {
            waterPump: [
                { oem: '04E121600CS', description: 'Wasserpumpe 1.0-1.5 TSI', condition: 'EA211 evo' },
                { oem: '06L121111P', description: 'Wasserpumpe 2.0 TSI', condition: 'EA888 Gen4' },
                { oem: '04L121011P', description: 'Wasserpumpe 2.0 TDI', condition: 'EA288 evo' },
            ],
        },
        suspension: {
            shockFront: [
                { oem: '5Q0413023FK', description: 'Stoßdämpfer VA Standard' },
                { oem: '5Q0413031GH', description: 'Stoßdämpfer VA DCC' },
            ],
            shockRear: [
                { oem: '5Q0512011S', description: 'Stoßdämpfer HA Standard' },
            ],
        },
    },
};

// ============================================================================
// VW Passat B8 (Typ 3G) - 2014-present
// ============================================================================

const PASSAT_B8: ModelEntry = {
    name: 'Passat B8',
    code: '3G',
    generation: 'B8',
    years: [2014, 2026],
    platform: 'MQB',
    engines: ['CZEA', 'DADA', 'CHHB', 'CWZA', 'CRLB', 'CUAA', 'DFHA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5Q0615301F', description: '312x25mm Standard', condition: '150PS Motoren' },
                { oem: '3Q0615301A', description: '340x30mm', condition: '190PS+ Motoren' },
            ],
            discRear: [
                { oem: '3Q0615601A', description: '300x12mm Standard' },
                { oem: '3Q0615601B', description: '310x22mm', condition: 'Mit ePB' },
            ],
            padsFront: [
                { oem: '5Q0698151D', description: 'Bremsbeläge VA 312mm' },
                { oem: '3Q0698151B', description: 'Bremsbeläge VA 340mm' },
            ],
            padsRear: [
                { oem: '3Q0698451A', description: 'Bremsbeläge HA' },
            ],
        },
        filters: {
            oil: [
                { oem: '04E115561H', description: 'Ölfilter 1.4 TSI' },
                { oem: '04E115561AC', description: 'Ölfilter 1.5 TSI' },
                { oem: '06L115562', description: 'Ölfilter 2.0 TSI' },
                { oem: '03N115562B', description: 'Ölfilter 2.0 TDI' },
            ],
            air: [
                { oem: '3Q0129620A', description: 'Luftfilter Benziner' },
                { oem: '3Q0129620B', description: 'Luftfilter Diesel' },
            ],
            cabin: [
                { oem: '5Q0819653', description: 'Innenraumfilter Standard' },
            ],
        },
        cooling: {
            waterPump: [
                { oem: '04E121600AL', description: 'Wasserpumpe 1.4 TSI' },
                { oem: '06L121111H', description: 'Wasserpumpe 2.0 TSI' },
                { oem: '04L121011L', description: 'Wasserpumpe 2.0 TDI' },
            ],
        },
    },
};

// ============================================================================
// VW Tiguan 2 (Typ AD) - 2016-present
// ============================================================================

const TIGUAN_2: ModelEntry = {
    name: 'Tiguan 2',
    code: 'AD',
    generation: 'AD1',
    years: [2016, 2026],
    platform: 'MQB',
    engines: ['CZEA', 'DADA', 'DKZA', 'CRLB', 'CUAA', 'DFGB'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5Q0615301F', description: '312x25mm Standard' },
                { oem: '5NA615301A', description: '340x30mm', condition: '190PS+ / R-Line' },
            ],
            discRear: [
                { oem: '5Q0615601A', description: '272x10mm Standard' },
                { oem: '5NA615601A', description: '300x12mm', condition: 'R-Line' },
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
                { oem: '04E115561H', description: 'Ölfilter 1.4 TSI' },
                { oem: '06L115562', description: 'Ölfilter 2.0 TSI' },
                { oem: '03N115562B', description: 'Ölfilter 2.0 TDI' },
            ],
            air: [
                { oem: '5QF129620A', description: 'Luftfilter alle Motoren' },
            ],
        },
        cooling: {
            waterPump: [
                { oem: '04E121600AL', description: 'Wasserpumpe 1.4 TSI' },
                { oem: '06L121111H', description: 'Wasserpumpe 2.0 TSI' },
                { oem: '04L121011L', description: 'Wasserpumpe 2.0 TDI' },
            ],
        },
    },
};

// ============================================================================
// VW Polo 6 (Typ AW) - 2017-present
// ============================================================================

const POLO_6: ModelEntry = {
    name: 'Polo 6',
    code: 'AW',
    generation: 'Mk6',
    years: [2017, 2026],
    platform: 'MQB A0',
    engines: ['DKRA', 'DKRF', 'CZCA', 'DPNB', 'DXDB'],
    parts: {
        brakes: {
            discFront: [
                { oem: '2Q0615301A', description: '256x22mm Standard', condition: '65-95PS' },
                { oem: '2Q0615301B', description: '288x25mm', condition: '110PS+' },
                { oem: '2Q0615301D', description: '312x25mm GTI', condition: 'PR 1ZK' },
            ],
            discRear: [
                { oem: '2Q0615601A', description: '232x9mm Trommel Standard', condition: 'Basis' },
                { oem: '2Q0615601B', description: '272x10mm Scheibe', condition: 'GTI' },
            ],
            padsFront: [
                { oem: '2Q0698151F', description: 'Bremsbeläge VA Standard' },
                { oem: '2Q0698151H', description: 'Bremsbeläge VA GTI' },
            ],
        },
        filters: {
            oil: [
                { oem: '04C115561J', description: 'Ölfilter 1.0 TSI/MPI' },
                { oem: '04E115561H', description: 'Ölfilter 1.5 TSI' },
                { oem: '03N115562B', description: 'Ölfilter 1.6 TDI' },
            ],
            air: [
                { oem: '2Q0129620B', description: 'Luftfilter alle Benziner' },
            ],
        },
        cooling: {
            waterPump: [
                { oem: '04C121600L', description: 'Wasserpumpe 1.0 TSI' },
                { oem: '04E121600CS', description: 'Wasserpumpe 1.5 TSI' },
            ],
        },
    },
};

// ============================================================================
// VW T-Roc (Typ A1) - 2017-present
// ============================================================================

const T_ROC: ModelEntry = {
    name: 'T-Roc',
    code: 'A1',
    generation: 'A11',
    years: [2017, 2026],
    platform: 'MQB A1',
    engines: ['DKRF', 'DADA', 'DPCA', 'CRLB', 'DFGA'],
    parts: {
        brakes: {
            discFront: [
                { oem: '5Q0615301F', description: '312x25mm Standard' },
                { oem: '2GA615301A', description: '340x30mm R', condition: 'T-Roc R' },
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
                { oem: '06L115562', description: 'Ölfilter 2.0 TSI' },
                { oem: '03N115562B', description: 'Ölfilter 2.0 TDI' },
            ],
        },
        cooling: {
            waterPump: [
                { oem: '04E121600CS', description: 'Wasserpumpe 1.0-1.5 TSI' },
                { oem: '06L121111P', description: 'Wasserpumpe 2.0 TSI' },
            ],
        },
    },
};

// ============================================================================
// VW Transporter T6 (Typ SG) - 2015-present
// ============================================================================

const TRANSPORTER_T6: ModelEntry = {
    name: 'Transporter T6',
    code: 'SG',
    generation: 'T6',
    years: [2015, 2026],
    platform: 'MQB Nutz',
    engines: ['CAAC', 'CXHA', 'DAUA', 'DTRD'],
    parts: {
        brakes: {
            discFront: [
                { oem: '7E0615301F', description: '308x29mm Standard' },
                { oem: '7E0615301G', description: '340x32mm', condition: 'Verstärkt' },
            ],
            discRear: [
                { oem: '7E0615601A', description: '294x22mm Standard' },
            ],
            padsFront: [
                { oem: '7H0698151', description: 'Bremsbeläge VA' },
            ],
            padsRear: [
                { oem: '7H0698451', description: 'Bremsbeläge HA' },
            ],
        },
        filters: {
            oil: [
                { oem: '03L115562', description: 'Ölfilter 2.0 TDI' },
            ],
            air: [
                { oem: '7E0129620C', description: 'Luftfilter Diesel' },
            ],
        },
    },
};

// ============================================================================
// VW Caddy 4/5 - 2015-present
// ============================================================================

const CADDY: ModelEntry = {
    name: 'Caddy 4/5',
    code: 'SA/SK',
    generation: 'Mk4/5',
    years: [2015, 2026],
    platform: 'MQB',
    engines: ['CZCA', 'DPCA', 'CLHB', 'DFSD'],
    parts: {
        brakes: {
            discFront: [
                { oem: '2K0615301J', description: '288x25mm Standard' },
                { oem: '2K0615301K', description: '312x25mm', condition: 'Maxi/verstärkt' },
            ],
            discRear: [
                { oem: '2K0615601A', description: '272x10mm Standard' },
            ],
            padsFront: [
                { oem: '2K0698151F', description: 'Bremsbeläge VA' },
            ],
        },
        filters: {
            oil: [
                { oem: '04E115561H', description: 'Ölfilter TSI' },
                { oem: '03N115562B', description: 'Ölfilter TDI' },
            ],
        },
    },
};

// ============================================================================
// Export Registry
// ============================================================================

export const VOLKSWAGEN_REGISTRY: OEMRegistry = {
    brand: 'Volkswagen',
    brandCode: 'VW',
    group: 'VAG',
    models: [
        GOLF_7,
        GOLF_8,
        PASSAT_B8,
        TIGUAN_2,
        POLO_6,
        T_ROC,
        TRANSPORTER_T6,
        CADDY,
    ],
};

export default VOLKSWAGEN_REGISTRY;
