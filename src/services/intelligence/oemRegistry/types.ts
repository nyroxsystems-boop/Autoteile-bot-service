/**
 * 🚗 OEM Registry Types
 * 
 * Centrale Typdefinitionen für das OEM-Nummern-Register.
 */

// ============================================================================
// Core Interfaces
// ============================================================================

export interface OEMRegistry {
    brand: string;
    brandCode: string;        // "VW", "AUDI", "MB", "BMW"
    group: BrandGroup;
    models: ModelEntry[];
}

export type BrandGroup = 'VAG' | 'DAIMLER' | 'BMW' | 'STELLANTIS' | 'RENAULT' | 'RENAULT-NISSAN' | 'HYUNDAI' | 'TOYOTA' | 'FORD' | 'MAZDA' | 'HONDA' | 'GEELY' | 'OTHER';

export interface ModelEntry {
    name: string;             // "Golf 7"
    code: string;             // "5G", "AU"
    generation?: string;      // "Mk7", "B9"
    years: [number, number];  // [2012, 2020]
    platform?: string;        // "MQB", "MLB Evo"
    engines?: string[];       // ["CHPA", "CRLB", "CJSA"]
    parts: PartRegistry;
}

// ============================================================================
// Part Categories
// ============================================================================

export interface PartRegistry {
    brakes?: BrakeParts;
    filters?: FilterParts;
    cooling?: CoolingParts;
    suspension?: SuspensionParts;
    drivetrain?: DrivetrainParts;
    engine?: EngineParts;
}

export interface BrakeParts {
    discFront?: PartVariant[];
    discRear?: PartVariant[];
    padsFront?: PartVariant[];
    padsRear?: PartVariant[];
    caliper?: PartVariant[];
}

export interface FilterParts {
    oil?: PartVariant[];
    air?: PartVariant[];
    fuel?: PartVariant[];
    cabin?: PartVariant[];
}

export interface CoolingParts {
    waterPump?: PartVariant[];
    thermostat?: PartVariant[];
    radiator?: PartVariant[];
    fanClutch?: PartVariant[];
}

export interface SuspensionParts {
    shockFront?: PartVariant[];
    shockRear?: PartVariant[];
    springFront?: PartVariant[];
    springRear?: PartVariant[];
    controlArm?: PartVariant[];
    tieRod?: PartVariant[];
    wheelBearing?: PartVariant[];
    stabilizer?: PartVariant[];
}

export interface DrivetrainParts {
    clutchKit?: PartVariant[];
    flywheel?: PartVariant[];
    driveShaft?: PartVariant[];
    cv?: PartVariant[];
}

export interface EngineParts {
    timingKit?: PartVariant[];
    sparkPlug?: PartVariant[];
    ignitionCoil?: PartVariant[];
    turbo?: PartVariant[];
    injector?: PartVariant[];
}

// ============================================================================
// Part Variant
// ============================================================================

export interface PartVariant {
    oem: string;              // "5Q0615301H"
    description: string;      // "345mm Performance"
    condition?: string;       // "PR-Code 1ZK" or "Motor CJSA"
    supersededBy?: string;    // Newer OEM if obsolete
    notes?: string;           // Additional info
}

// ============================================================================
// Lookup Types
// ============================================================================

export interface OEMLookupQuery {
    brand?: string;
    model?: string;
    year?: number;
    engine?: string;
    partType: PartType;
}

export type PartType =
    | 'DISC_FRONT' | 'DISC_REAR'
    | 'PADS_FRONT' | 'PADS_REAR'
    | 'OIL_FILTER' | 'AIR_FILTER' | 'FUEL_FILTER' | 'CABIN_FILTER'
    | 'WATER_PUMP' | 'THERMOSTAT' | 'RADIATOR'
    | 'SHOCK_FRONT' | 'SHOCK_REAR'
    | 'SPRING_FRONT' | 'SPRING_REAR'
    | 'CONTROL_ARM' | 'TIE_ROD' | 'WHEEL_BEARING' | 'STABILIZER'
    | 'CLUTCH_KIT' | 'FLYWHEEL' | 'DRIVE_SHAFT'
    | 'TIMING_KIT' | 'SPARK_PLUG' | 'IGNITION_COIL' | 'TURBO';

export interface OEMLookupResult {
    found: boolean;
    oem?: string;
    alternatives?: PartVariant[];
    confidence: number;
    source: 'REGISTRY' | 'MOTORCODE' | 'PRCODE' | 'FALLBACK';
}

// ============================================================================
// Export
// ============================================================================

export default {
    // Type exports only - no runtime values
};
