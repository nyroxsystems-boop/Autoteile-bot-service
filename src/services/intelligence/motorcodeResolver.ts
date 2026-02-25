/**
 * 🔧 MOTORCODE RESOLVER - Engine-Specific OEM Parts
 * 
 * Same model can have completely different OEMs based on engine variant.
 * This is CRITICAL for:
 * - Water pumps (different mounting, different impeller)
 * - Timing belts/chains (different sizes)
 * - Turbochargers (different specs)
 * - Fuel system components (diesel vs petrol)
 * - Engine mounts (different torque ratings)
 */

import { logger } from "@utils/logger";

// ============================================================================
// Engine Type Classification
// ============================================================================

export type EngineType = 'PETROL' | 'DIESEL' | 'HYBRID' | 'ELECTRIC';
export type FuelInjection = 'TSI' | 'TFSI' | 'FSI' | 'MPI' | 'TDI' | 'SDI' | 'GTI' | 'NA';
export type TimingType = 'BELT' | 'CHAIN' | 'GEAR';

export interface EngineInfo {
    motorcode: string;
    engineType: EngineType;
    fuelInjection: FuelInjection;
    displacement: number;    // in liters (1.4, 2.0, etc.)
    power: number;           // in kW
    torque?: number;         // in Nm
    cylinders: number;
    timingType: TimingType;
    turbo: boolean;
    years: [number, number]; // [fromYear, toYear]
    platforms: string[];     // MQB, MQB Evo, PQ35, etc.
    models: string[];
}

// ============================================================================
// VAG Engine Database (Core Critical Data)
// ============================================================================

const VAG_ENGINES: Record<string, EngineInfo> = {
    // =========================================================================
    // EA211 - 1.0 TSI/MPI (3-Cylinder) - Complete List
    // =========================================================================
    'CHYA': { motorcode: 'CHYA', engineType: 'PETROL', fuelInjection: 'MPI', displacement: 1.0, power: 55, cylinders: 3, timingType: 'CHAIN', turbo: false, years: [2014, 2020], platforms: ['MQB'], models: ['Polo', 'Up!', 'Ibiza'] },
    'CHYB': { motorcode: 'CHYB', engineType: 'PETROL', fuelInjection: 'MPI', displacement: 1.0, power: 55, cylinders: 3, timingType: 'CHAIN', turbo: false, years: [2014, 2020], platforms: ['MQB'], models: ['Polo', 'Up!'] },
    'CHZB': { motorcode: 'CHZB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.0, power: 85, cylinders: 3, timingType: 'CHAIN', turbo: true, years: [2014, 2020], platforms: ['MQB'], models: ['Golf 7', 'Polo AW', 'T-Roc', 'T-Cross'] },
    'CHZC': { motorcode: 'CHZC', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.0, power: 81, cylinders: 3, timingType: 'CHAIN', turbo: true, years: [2014, 2020], platforms: ['MQB'], models: ['Golf 7', 'Polo AW'] },
    'CHZD': { motorcode: 'CHZD', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.0, power: 70, cylinders: 3, timingType: 'CHAIN', turbo: true, years: [2014, 2020], platforms: ['MQB'], models: ['Polo', 'Ibiza'] },
    'CHZE': { motorcode: 'CHZE', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.0, power: 70, cylinders: 3, timingType: 'CHAIN', turbo: true, years: [2014, 2020], platforms: ['MQB'], models: ['Polo'] },
    'DKRA': { motorcode: 'DKRA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.0, power: 85, cylinders: 3, timingType: 'CHAIN', turbo: true, years: [2017, 2026], platforms: ['MQB Evo'], models: ['Polo AW', 'Taigo'] },
    'DKRB': { motorcode: 'DKRB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.0, power: 81, cylinders: 3, timingType: 'CHAIN', turbo: true, years: [2017, 2026], platforms: ['MQB Evo'], models: ['T-Cross'] },
    'DKRF': { motorcode: 'DKRF', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.0, power: 81, cylinders: 3, timingType: 'CHAIN', turbo: true, years: [2019, 2026], platforms: ['MQB Evo'], models: ['Golf 8', 'T-Cross', 'Taigo'] },
    'DSHA': { motorcode: 'DSHA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.0, power: 85, cylinders: 3, timingType: 'CHAIN', turbo: true, years: [2017, 2026], platforms: ['MQB Evo'], models: ['Polo AWE'] },

    // =========================================================================
    // EA211 - 1.2 TSI (4-Cylinder)
    // =========================================================================
    'CJZA': { motorcode: 'CJZA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.2, power: 77, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2012, 2018], platforms: ['MQB'], models: ['Golf 7', 'Polo 6C', 'Jetta'] },
    'CJZB': { motorcode: 'CJZB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.2, power: 63, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2012, 2018], platforms: ['MQB'], models: ['Polo', 'Ibiza'] },
    'CJZC': { motorcode: 'CJZC', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.2, power: 66, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2012, 2018], platforms: ['MQB'], models: ['Golf 7', 'Ibiza'] },
    'CJZD': { motorcode: 'CJZD', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.2, power: 81, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2012, 2018], platforms: ['MQB'], models: ['Golf 7', 'A3 8V'] },
    'CYVA': { motorcode: 'CYVA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.2, power: 66, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2014, 2018], platforms: ['MQB'], models: ['Golf 7 Sportsvan'] },
    'CYVB': { motorcode: 'CYVB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.2, power: 81, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2014, 2018], platforms: ['MQB'], models: ['Golf 7'] },

    // =========================================================================
    // EA211 - 1.4 TSI (4-Cylinder) - Complete List
    // =========================================================================
    'CHPA': { motorcode: 'CHPA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.4, power: 103, cylinders: 4, timingType: 'BELT', turbo: true, years: [2012, 2018], platforms: ['MQB'], models: ['Golf 7', 'A3 8V', 'Leon 5F', 'Octavia 3'] },
    'CPTA': { motorcode: 'CPTA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.4, power: 90, cylinders: 4, timingType: 'BELT', turbo: true, years: [2012, 2018], platforms: ['MQB'], models: ['Golf 7', 'A3 8V'] },
    'CPVA': { motorcode: 'CPVA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.4, power: 92, cylinders: 4, timingType: 'BELT', turbo: true, years: [2012, 2018], platforms: ['MQB'], models: ['Golf 7', 'Octavia'] },
    'CPVB': { motorcode: 'CPVB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.4, power: 90, cylinders: 4, timingType: 'BELT', turbo: true, years: [2012, 2018], platforms: ['MQB'], models: ['Golf 7'] },
    'CPWA': { motorcode: 'CPWA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.4, power: 81, cylinders: 4, timingType: 'BELT', turbo: true, years: [2012, 2018], platforms: ['MQB'], models: ['Jetta'] },
    'CMBA': { motorcode: 'CMBA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.4, power: 90, cylinders: 4, timingType: 'BELT', turbo: true, years: [2012, 2018], platforms: ['MQB'], models: ['Golf 7', 'Tiguan 2'] },
    'CZCA': { motorcode: 'CZCA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.4, power: 92, cylinders: 4, timingType: 'BELT', turbo: true, years: [2014, 2020], platforms: ['MQB'], models: ['Golf 7', 'A3 8V'] },
    'CZDA': { motorcode: 'CZDA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.4, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2014, 2020], platforms: ['MQB'], models: ['Golf 7', 'A3 8V', 'Passat B8'] },
    'CZEA': { motorcode: 'CZEA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.4, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2014, 2020], platforms: ['MQB'], models: ['Golf 7', 'Passat B8', 'Tiguan 2'] },
    'CZTA': { motorcode: 'CZTA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.4, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2014, 2020], platforms: ['MQB'], models: ['Golf Sportsvan'] },
    'CXSA': { motorcode: 'CXSA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.4, power: 92, cylinders: 4, timingType: 'BELT', turbo: true, years: [2014, 2018], platforms: ['MQB'], models: ['Golf 7'] },
    'CUKB': { motorcode: 'CUKB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.4, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2014, 2020], platforms: ['MQB'], models: ['Golf 7 GTE', 'Passat GTE'] },
    'DJKA': { motorcode: 'DJKA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.4, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2017, 2026], platforms: ['MQB'], models: ['T-Roc', 'Taigo'] },

    // =========================================================================
    // EA211 Evo - 1.5 TSI (4-Cylinder) - Complete List
    // =========================================================================
    'DACA': { motorcode: 'DACA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.5, power: 96, cylinders: 4, timingType: 'BELT', turbo: true, years: [2017, 2026], platforms: ['MQB', 'MQB Evo'], models: ['Golf 7.5', 'T-Roc'] },
    'DACB': { motorcode: 'DACB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.5, power: 96, cylinders: 4, timingType: 'BELT', turbo: true, years: [2017, 2026], platforms: ['MQB'], models: ['Golf 7.5'] },
    'DADA': { motorcode: 'DADA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.5, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2017, 2026], platforms: ['MQB', 'MQB Evo'], models: ['Golf 7.5', 'Golf 8', 'T-Roc', 'Passat B8'] },
    'DPBA': { motorcode: 'DPBA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.5, power: 96, cylinders: 4, timingType: 'BELT', turbo: true, years: [2017, 2026], platforms: ['MQB Evo'], models: ['Golf 8', 'Octavia 4'] },
    'DPBE': { motorcode: 'DPBE', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.5, power: 96, cylinders: 4, timingType: 'BELT', turbo: true, years: [2019, 2026], platforms: ['MQB Evo'], models: ['Golf 8'] },
    'DPCA': { motorcode: 'DPCA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.5, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2017, 2026], platforms: ['MQB', 'MQB Evo'], models: ['Golf 8', 'T-Roc', 'Caddy 5'] },
    'DXDB': { motorcode: 'DXDB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.5, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2020, 2026], platforms: ['MQB Evo'], models: ['Golf 8'] },
    'DNKA': { motorcode: 'DNKA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.5, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2020, 2026], platforms: ['MQB Evo'], models: ['Golf 8', 'Tiguan'] },
    'DFYA': { motorcode: 'DFYA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.5, power: 118, cylinders: 4, timingType: 'BELT', turbo: true, years: [2020, 2026], platforms: ['MQB Evo'], models: ['Golf 8 eTSI', 'A3 8Y'] },

    // =========================================================================
    // EA888 Gen 1 - 1.8/2.0 TSI (4-Cylinder)
    // =========================================================================
    'BYT': { motorcode: 'BYT', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.8, power: 118, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2007, 2012], platforms: ['PQ35'], models: ['Passat B6', 'Golf 5', 'A3 8P'] },
    'BZB': { motorcode: 'BZB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.8, power: 118, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2007, 2012], platforms: ['PQ35'], models: ['Passat B6', 'Golf 5'] },
    'CABA': { motorcode: 'CABA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.8, power: 118, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2008, 2013], platforms: ['PQ35'], models: ['A4 B8', 'A5 8T'] },
    'CABB': { motorcode: 'CABB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.8, power: 118, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2008, 2013], platforms: ['PQ35'], models: ['A4 B8'] },
    'CABD': { motorcode: 'CABD', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.8, power: 118, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2008, 2013], platforms: ['PQ35'], models: ['A4 B8', 'A5'] },
    'CAWA': { motorcode: 'CAWA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 147, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2007, 2012], platforms: ['PQ35'], models: ['Passat B6 CC', 'Golf 6 GTI'] },
    'CAWB': { motorcode: 'CAWB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 147, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2007, 2012], platforms: ['PQ35'], models: ['Passat B6', 'Scirocco'] },
    'CBFA': { motorcode: 'CBFA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 147, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2009, 2014], platforms: ['PQ35'], models: ['Golf 6 GTI', 'Jetta'] },
    'CCTA': { motorcode: 'CCTA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 147, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2008, 2013], platforms: ['PQ35'], models: ['Tiguan 1', 'Passat B6'] },
    'CCTB': { motorcode: 'CCTB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 155, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2009, 2014], platforms: ['PQ35'], models: ['Tiguan 1'] },

    // =========================================================================
    // EA888 Gen 2 - 1.8/2.0 TSI (4-Cylinder)
    // =========================================================================
    'CDAA': { motorcode: 'CDAA', engineType: 'PETROL', fuelInjection: 'TFSI', displacement: 1.8, power: 118, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2008, 2015], platforms: ['MLB'], models: ['A4 B8', 'A5 8T', 'Q5'] },
    'CDAB': { motorcode: 'CDAB', engineType: 'PETROL', fuelInjection: 'TFSI', displacement: 1.8, power: 125, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2010, 2015], platforms: ['MLB'], models: ['A4 B8'] },
    'CDHA': { motorcode: 'CDHA', engineType: 'PETROL', fuelInjection: 'TFSI', displacement: 1.8, power: 118, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2010, 2015], platforms: ['MLB'], models: ['A4 B8', 'A5'] },
    'CDHB': { motorcode: 'CDHB', engineType: 'PETROL', fuelInjection: 'TFSI', displacement: 1.8, power: 125, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2011, 2016], platforms: ['MLB'], models: ['A4 B8', 'A5'] },
    'CCZA': { motorcode: 'CCZA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 147, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2009, 2014], platforms: ['PQ46'], models: ['Passat B7', 'Passat CC'] },
    'CCZB': { motorcode: 'CCZB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 155, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2009, 2014], platforms: ['PQ46'], models: ['Tiguan', 'Sharan'] },
    'CCZC': { motorcode: 'CCZC', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 162, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2010, 2015], platforms: ['PQ46'], models: ['Golf 6 GTI Edition 35'] },
    'CCZD': { motorcode: 'CCZD', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 155, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2010, 2014], platforms: ['PQ46'], models: ['Scirocco R'] },
    'CDNB': { motorcode: 'CDNB', engineType: 'PETROL', fuelInjection: 'TFSI', displacement: 2.0, power: 132, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2008, 2015], platforms: ['MLB'], models: ['A4 B8', 'A5 8T'] },
    'CDNC': { motorcode: 'CDNC', engineType: 'PETROL', fuelInjection: 'TFSI', displacement: 2.0, power: 155, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2008, 2015], platforms: ['MLB'], models: ['A4 B8', 'A5 8T', 'Q5'] },
    'CAEA': { motorcode: 'CAEA', engineType: 'PETROL', fuelInjection: 'TFSI', displacement: 2.0, power: 132, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2008, 2015], platforms: ['MLB'], models: ['A4 B8', 'Q5'] },
    'CAEB': { motorcode: 'CAEB', engineType: 'PETROL', fuelInjection: 'TFSI', displacement: 2.0, power: 155, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2008, 2015], platforms: ['MLB'], models: ['A4 B8', 'A5 8T', 'Q5'] },

    // =========================================================================
    // EA888 Gen 3 - 1.8/2.0 TSI (4-Cylinder) - MQB Platform
    // =========================================================================
    'CJSA': { motorcode: 'CJSA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.8, power: 132, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2012, 2018], platforms: ['MQB'], models: ['Golf 7', 'A3 8V', 'Passat B8'] },
    'CJSB': { motorcode: 'CJSB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 1.8, power: 132, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2012, 2018], platforms: ['MQB'], models: ['Golf 7', 'A3 8V'] },
    'CNCB': { motorcode: 'CNCB', engineType: 'PETROL', fuelInjection: 'TFSI', displacement: 1.8, power: 132, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2014, 2019], platforms: ['MLB Evo'], models: ['A4 B9', 'A5 F5'] },
    'CNCD': { motorcode: 'CNCD', engineType: 'PETROL', fuelInjection: 'TFSI', displacement: 1.8, power: 132, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2014, 2019], platforms: ['MLB Evo'], models: ['A4 B9'] },
    'CNCE': { motorcode: 'CNCE', engineType: 'PETROL', fuelInjection: 'TFSI', displacement: 1.8, power: 132, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2015, 2020], platforms: ['MLB Evo'], models: ['A4 B9', 'A5 F5'] },
    'CHHA': { motorcode: 'CHHA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 162, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2012, 2020], platforms: ['MQB'], models: ['Golf 7 GTI', 'A3 8V 40 TFSI'] },
    'CHHB': { motorcode: 'CHHB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 162, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2012, 2020], platforms: ['MQB'], models: ['Golf 7 GTI', 'A3 8V 40 TFSI', 'Leon Cupra'] },
    'CHHC': { motorcode: 'CHHC', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 169, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2013, 2020], platforms: ['MQB'], models: ['Golf 7 GTI Performance'] },
    'CWZA': { motorcode: 'CWZA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 162, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2014, 2020], platforms: ['MQB'], models: ['Passat B8'] },
    'CXCA': { motorcode: 'CXCA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 162, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2015, 2018], platforms: ['MQB'], models: ['Golf 7 GTI US'] },
    'CXCB': { motorcode: 'CXCB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 162, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2016, 2018], platforms: ['MQB'], models: ['Golf 7 GTI US'] },
    'CXDA': { motorcode: 'CXDA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 162, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2014, 2020], platforms: ['MQB'], models: ['Tiguan 2', 'Passat B8'] },
    'CJXA': { motorcode: 'CJXA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 206, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2013, 2017], platforms: ['MQB'], models: ['Golf 7 R', 'S3 8V'] },
    'CJXC': { motorcode: 'CJXC', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 221, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2013, 2020], platforms: ['MQB'], models: ['Golf 7 R', 'S3 8V', 'TT-S'] },
    'CJXE': { motorcode: 'CJXE', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 228, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2015, 2020], platforms: ['MQB'], models: ['Golf 7 R', 'S3 8V'] },
    'CJXG': { motorcode: 'CJXG', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 228, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2016, 2020], platforms: ['MQB'], models: ['Golf 7 R Performance Pack'] },
    'CJXH': { motorcode: 'CJXH', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 221, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2015, 2020], platforms: ['MQB'], models: ['TT-S 8S'] },
    'CYFB': { motorcode: 'CYFB', engineType: 'PETROL', fuelInjection: 'TFSI', displacement: 2.0, power: 221, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2015, 2020], platforms: ['MLB Evo'], models: ['S3 8V', 'TT-S 8S'] },
    'DJHA': { motorcode: 'DJHA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 180, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2017, 2020], platforms: ['MQB'], models: ['Golf 7.5 GTI', 'Golf 7 GTI TCR'] },
    'DJHB': { motorcode: 'DJHB', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 180, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2017, 2020], platforms: ['MQB'], models: ['Golf 7.5 GTI'] },
    'DKFA': { motorcode: 'DKFA', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 180, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2019, 2026], platforms: ['MQB Evo'], models: ['Golf 7.5 GTI US', 'Golf 8 GTI'] },

    // =========================================================================
    // EA888 Gen 4 - Golf 8 GTI/R
    // =========================================================================
    'DNUE': { motorcode: 'DNUE', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 221, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2020, 2026], platforms: ['MQB Evo'], models: ['Golf 8 R', 'S3 8Y'] },
    'DNUF': { motorcode: 'DNUF', engineType: 'PETROL', fuelInjection: 'TSI', displacement: 2.0, power: 245, cylinders: 4, timingType: 'CHAIN', turbo: true, years: [2021, 2026], platforms: ['MQB Evo'], models: ['Golf 8 R', 'S3 8Y Facelift'] },

    // =========================================================================
    // EA288 - 1.6 TDI (4-Cylinder Diesel) - Complete List
    // =========================================================================
    'CLHA': { motorcode: 'CLHA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 1.6, power: 77, cylinders: 4, timingType: 'BELT', turbo: true, years: [2013, 2020], platforms: ['MQB'], models: ['Golf 7', 'A3 8V', 'Leon 5F'] },
    'CLHB': { motorcode: 'CLHB', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 1.6, power: 66, cylinders: 4, timingType: 'BELT', turbo: true, years: [2013, 2020], platforms: ['MQB'], models: ['Golf 7', 'Caddy 4'] },
    'CRKA': { motorcode: 'CRKA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 1.6, power: 66, cylinders: 4, timingType: 'BELT', turbo: true, years: [2013, 2020], platforms: ['MQB'], models: ['Golf 7'] },
    'CRKB': { motorcode: 'CRKB', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 1.6, power: 77, cylinders: 4, timingType: 'BELT', turbo: true, years: [2013, 2020], platforms: ['MQB'], models: ['Golf 7', 'Passat B8'] },
    'CXXA': { motorcode: 'CXXA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 1.6, power: 81, cylinders: 4, timingType: 'BELT', turbo: true, years: [2013, 2020], platforms: ['MQB'], models: ['Golf 7', 'A3 8V', 'Passat B8'] },
    'CXXB': { motorcode: 'CXXB', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 1.6, power: 66, cylinders: 4, timingType: 'BELT', turbo: true, years: [2013, 2020], platforms: ['MQB'], models: ['Golf 7', 'Caddy 4'] },
    'DBKA': { motorcode: 'DBKA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 1.6, power: 85, cylinders: 4, timingType: 'BELT', turbo: true, years: [2017, 2026], platforms: ['MQB'], models: ['Golf 7.5', 'Touran'] },
    'DCXA': { motorcode: 'DCXA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 1.6, power: 85, cylinders: 4, timingType: 'BELT', turbo: true, years: [2017, 2026], platforms: ['MQB'], models: ['A3 8V FL'] },
    'DDYA': { motorcode: 'DDYA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 1.6, power: 85, cylinders: 4, timingType: 'BELT', turbo: true, years: [2017, 2026], platforms: ['MQB'], models: ['Golf 7.5', 'Octavia 3 FL'] },

    // =========================================================================
    // EA288 - 2.0 TDI (4-Cylinder Diesel) - Complete List
    // =========================================================================
    'CRLB': { motorcode: 'CRLB', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2012, 2020], platforms: ['MQB'], models: ['Golf 7', 'A3 8V', 'Passat B8', 'Tiguan 2'] },
    'CRBC': { motorcode: 'CRBC', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2012, 2020], platforms: ['MQB'], models: ['Golf 7'] },
    'CRFC': { motorcode: 'CRFC', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 135, cylinders: 4, timingType: 'BELT', turbo: true, years: [2013, 2020], platforms: ['MQB'], models: ['Golf 7 GTD', 'Passat B8'] },
    'CRFA': { motorcode: 'CRFA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 135, cylinders: 4, timingType: 'BELT', turbo: true, years: [2013, 2020], platforms: ['MQB'], models: ['Passat B8', 'Tiguan 2'] },
    'CRBD': { motorcode: 'CRBD', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2012, 2020], platforms: ['MQB'], models: ['Golf 7'] },
    'CRUA': { motorcode: 'CRUA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2014, 2020], platforms: ['MQB'], models: ['Golf 7 US', 'Jetta'] },
    'CKFC': { motorcode: 'CKFC', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 135, cylinders: 4, timingType: 'BELT', turbo: true, years: [2015, 2020], platforms: ['MQB'], models: ['Passat B8'] },
    'CUNA': { motorcode: 'CUNA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 135, cylinders: 4, timingType: 'BELT', turbo: true, years: [2012, 2018], platforms: ['MQB'], models: ['Golf 7 GTD', 'A3 8V 2.0 TDI'] },
    'CUPA': { motorcode: 'CUPA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2013, 2020], platforms: ['MQB'], models: ['Golf 7', 'A3 8V'] },
    'CUWA': { motorcode: 'CUWA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 140, cylinders: 4, timingType: 'BELT', turbo: true, years: [2015, 2020], platforms: ['MQB'], models: ['Passat B8 Alltrack'] },
    'CUAA': { motorcode: 'CUAA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 135, cylinders: 4, timingType: 'BELT', turbo: true, years: [2013, 2020], platforms: ['MQB'], models: ['Passat B8', 'Tiguan 2', 'A4 B9'] },
    'DEUA': { motorcode: 'DEUA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2015, 2020], platforms: ['MLB Evo'], models: ['A4 B9', 'A5 F5', 'Q5 FY'] },
    'DETA': { motorcode: 'DETA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 140, cylinders: 4, timingType: 'BELT', turbo: true, years: [2015, 2020], platforms: ['MLB Evo'], models: ['A4 B9', 'A5 F5'] },
    'DFGA': { motorcode: 'DFGA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2017, 2026], platforms: ['MQB'], models: ['Golf 7.5', 'Golf 8', 'Passat B8 FL'] },
    'DFGB': { motorcode: 'DFGB', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 110, cylinders: 4, timingType: 'BELT', turbo: true, years: [2017, 2026], platforms: ['MQB'], models: ['Tiguan 2 FL'] },
    'DFHA': { motorcode: 'DFHA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 140, cylinders: 4, timingType: 'BELT', turbo: true, years: [2017, 2026], platforms: ['MQB'], models: ['Golf 8 GTD', 'Passat B8 FL'] },
    'DFBA': { motorcode: 'DFBA', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 150, cylinders: 4, timingType: 'BELT', turbo: true, years: [2019, 2026], platforms: ['MQB Evo'], models: ['Golf 8 GTD'] },
    'DEZB': { motorcode: 'DEZB', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 100, cylinders: 4, timingType: 'BELT', turbo: true, years: [2019, 2026], platforms: ['MQB Evo'], models: ['Golf 8'] },
    'DEZD': { motorcode: 'DEZD', engineType: 'DIESEL', fuelInjection: 'TDI', displacement: 2.0, power: 120, cylinders: 4, timingType: 'BELT', turbo: true, years: [2019, 2026], platforms: ['MQB Evo'], models: ['Golf 8', 'Tiguan FL'] },
};

// ============================================================================
// OEM Mappings by Motorcode + Part
// ============================================================================

interface MotorcodeOEMMapping {
    oem: string;
    description: string;
    note?: string;
}

const MOTORCODE_OEM_MAPPINGS: Record<string, Record<string, MotorcodeOEMMapping>> = {
    // 1.4 TSI Water Pumps (EA211 - BELT DRIVEN)
    'CHPA': {
        'WATER_PUMP': { oem: '04E121600C', description: 'Wasserpumpe 1.4 TSI' },
        'TIMING_BELT_KIT': { oem: '04E198119', description: 'Zahnriemensatz 1.4 TSI' },
        'THERMOSTAT': { oem: '04E121113B', description: 'Thermostat 1.4 TSI' },
    },
    'CPTA': {
        'WATER_PUMP': { oem: '04E121600C', description: 'Wasserpumpe 1.4 TSI' },
        'TIMING_BELT_KIT': { oem: '04E198119', description: 'Zahnriemensatz 1.4 TSI' },
    },
    'CZEA': {
        'WATER_PUMP': { oem: '04E121600D', description: 'Wasserpumpe 1.4 TSI ACT' },
        'TIMING_BELT_KIT': { oem: '04E198119B', description: 'Zahnriemensatz 1.4 TSI ACT' },
    },

    // 1.5 TSI Water Pumps (EA211 evo - BELT DRIVEN)
    'DADA': {
        'WATER_PUMP': { oem: '04E121600N', description: 'Wasserpumpe 1.5 TSI' },
        'TIMING_BELT_KIT': { oem: '04E198119E', description: 'Zahnriemensatz 1.5 TSI' },
    },

    // 1.8/2.0 TSI Water Pumps (EA888 - CHAIN DRIVEN)
    'CJSA': {
        'WATER_PUMP': { oem: '06L121111H', description: 'Wasserpumpe 1.8 TSI' },
        'TIMING_CHAIN_KIT': { oem: '06K109158AD', description: 'Steuerkettensatz EA888' },
        'THERMOSTAT': { oem: '06L121111J', description: 'Thermostatgehäuse 1.8 TSI' },
    },
    'CHHB': {
        'WATER_PUMP': { oem: '06L121111H', description: 'Wasserpumpe 2.0 TSI GTI' },
        'TIMING_CHAIN_KIT': { oem: '06K109158AD', description: 'Steuerkettensatz EA888' },
        'TURBO': { oem: '06K145874F', description: 'Turbolader 2.0 TSI' },
    },
    'CJXC': {
        'WATER_PUMP': { oem: '06L121111J', description: 'Wasserpumpe 2.0 TSI R' },
        'TIMING_CHAIN_KIT': { oem: '06K109158AQ', description: 'Steuerkettensatz EA888 Gen3B' },
        'TURBO': { oem: '06K145722H', description: 'Turbolader IS38 Golf R' },
    },

    // 1.6 TDI Water Pumps (EA288 - BELT DRIVEN)
    'CXXA': {
        'WATER_PUMP': { oem: '03L121011PX', description: 'Wasserpumpe 1.6 TDI' },
        'TIMING_BELT_KIT': { oem: '03L198119A', description: 'Zahnriemensatz 1.6 TDI' },
        'FUEL_FILTER': { oem: '5Q0127400F', description: 'Kraftstofffilter 1.6 TDI' },
    },

    // 2.0 TDI Water Pumps (EA288 - BELT DRIVEN)
    'CRLB': {
        'WATER_PUMP': { oem: '04L121011L', description: 'Wasserpumpe 2.0 TDI' },
        'TIMING_BELT_KIT': { oem: '04L198119', description: 'Zahnriemensatz 2.0 TDI' },
        'FUEL_FILTER': { oem: '5Q0127400G', description: 'Kraftstofffilter 2.0 TDI' },
    },
    'CUNA': {
        'WATER_PUMP': { oem: '04L121011M', description: 'Wasserpumpe 2.0 TDI GTD' },
        'TIMING_BELT_KIT': { oem: '04L198119A', description: 'Zahnriemensatz 2.0 TDI GTD' },
    },
    'DFGA': {
        'WATER_PUMP': { oem: '04L121011P', description: 'Wasserpumpe 2.0 TDI Evo' },
        'TIMING_BELT_KIT': { oem: '04L198119C', description: 'Zahnriemensatz 2.0 TDI Evo' },
    },
};

// ============================================================================
// Main Resolution Functions
// ============================================================================

export interface MotorcodeResolutionResult {
    found: boolean;
    motorcode: string;
    engineInfo?: EngineInfo;
    oemMapping?: MotorcodeOEMMapping;
    warning?: string;
}

/**
 * Get engine info by motorcode
 */
export function getEngineInfo(motorcode: string): EngineInfo | undefined {
    return VAG_ENGINES[motorcode.toUpperCase()];
}

/**
 * Resolve OEM by motorcode and part category
 */
export function resolveByMotorcode(
    motorcode: string,
    partCategory: string
): MotorcodeResolutionResult {
    const normalized = motorcode.toUpperCase().trim();

    const result: MotorcodeResolutionResult = {
        found: false,
        motorcode: normalized,
    };

    const engineInfo = VAG_ENGINES[normalized];
    if (engineInfo) {
        result.engineInfo = engineInfo;
    }

    const mappings = MOTORCODE_OEM_MAPPINGS[normalized];
    if (mappings && mappings[partCategory]) {
        result.found = true;
        result.oemMapping = mappings[partCategory];

        logger.info("[Motorcode] OEM resolved", {
            motorcode: normalized,
            partCategory,
            oem: result.oemMapping.oem,
        });
    } else if (engineInfo) {
        result.warning = `Motorcode ${normalized} erkannt (${engineInfo.displacement}L ${engineInfo.fuelInjection}), aber kein OEM-Mapping für ${partCategory}.`;
    }

    return result;
}

/**
 * Detect part category for engine-specific parts
 */
export function detectEnginePartCategory(query: string): string | null {
    const normalized = query.toLowerCase();

    if (/wasserpumpe|water.*pump|kühlmittelpumpe/i.test(normalized)) return 'WATER_PUMP';
    if (/zahnriemen|timing.*belt|steuerriemen/i.test(normalized)) return 'TIMING_BELT_KIT';
    if (/steuerkette|timing.*chain/i.test(normalized)) return 'TIMING_CHAIN_KIT';
    if (/thermostat/i.test(normalized)) return 'THERMOSTAT';
    if (/turbo|turbolader|turbocharger/i.test(normalized)) return 'TURBO';
    if (/kraftstofffilter|fuel.*filter|dieselfilter/i.test(normalized)) return 'FUEL_FILTER';
    if (/ölfilter|oil.*filter/i.test(normalized)) return 'OIL_FILTER';
    if (/luftfilter|air.*filter/i.test(normalized)) return 'AIR_FILTER';
    if (/zündkerze|spark.*plug/i.test(normalized)) return 'SPARK_PLUG';
    if (/motorlager|engine.*mount|getriebelager/i.test(normalized)) return 'ENGINE_MOUNT';
    // P1: Expanded categories
    if (/kupplung|clutch|kupplungssatz|kupplungskit/i.test(normalized)) return 'CLUTCH_KIT';
    if (/lichtmaschine|alternator|generator/i.test(normalized)) return 'ALTERNATOR';
    if (/anlasser|starter/i.test(normalized)) return 'STARTER';
    if (/agr.*ventil|egr.*valve|abgasrückführ/i.test(normalized)) return 'EGR_VALVE';
    if (/einspritzdüse|injektor|injector|einspritzventil/i.test(normalized)) return 'INJECTOR';
    if (/ölpumpe|oil.*pump/i.test(normalized)) return 'OIL_PUMP';
    if (/partikelfilter|dpf|rußfilter|dieselpartikelfilter/i.test(normalized)) return 'DPF';
    if (/ladeluftkühler|intercooler|ladeluft/i.test(normalized)) return 'INTERCOOLER';

    return null;
}

/**
 * Find possible motorcodes for a model
 */
export function findMotorcodesForModel(model: string, year?: number): EngineInfo[] {
    const normalizedModel = model.toLowerCase();
    const results: EngineInfo[] = [];

    for (const engine of Object.values(VAG_ENGINES)) {
        const modelMatch = engine.models.some(m =>
            m.toLowerCase().includes(normalizedModel) ||
            normalizedModel.includes(m.toLowerCase())
        );

        if (modelMatch) {
            if (year) {
                if (year >= engine.years[0] && year <= engine.years[1]) {
                    results.push(engine);
                }
            } else {
                results.push(engine);
            }
        }
    }

    return results;
}

// ============================================================================
// Export
// ============================================================================

export default {
    getEngineInfo,
    resolveByMotorcode,
    detectEnginePartCategory,
    findMotorcodesForModel,
    VAG_ENGINES,
};
