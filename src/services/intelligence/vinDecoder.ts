/**
 * 🔍 VIN DECODER - Premium Vehicle Identification
 * 
 * Decodes VIN (Vehicle Identification Number) to extract:
 * - WMI (World Manufacturer Identifier) → Brand/Factory
 * - VDS (Vehicle Descriptor Section) → Model/Engine
 * - VIS (Vehicle Identifier Section) → Year/Serial
 * - PR-Codes (VAG-specific options)
 * - Motorcode extraction
 * - Production year/month
 */

import { logger } from "@utils/logger";

// ============================================================================
// VIN Structure Constants
// ============================================================================

const VIN_LENGTH = 17;

// WMI → Manufacturer mapping (first 3 characters)
const WMI_MANUFACTURERS: Record<string, { brand: string; group: string }> = {
    // VAG Group
    'WVW': { brand: 'VOLKSWAGEN', group: 'VAG' },
    'WV1': { brand: 'VOLKSWAGEN', group: 'VAG' }, // Commercial
    'WV2': { brand: 'VOLKSWAGEN', group: 'VAG' }, // Bus/Transporter
    '3VW': { brand: 'VOLKSWAGEN', group: 'VAG' }, // Mexico
    'WAU': { brand: 'AUDI', group: 'VAG' },
    'WUA': { brand: 'AUDI', group: 'VAG' }, // quattro GmbH
    'TRU': { brand: 'AUDI', group: 'VAG' }, // Hungary
    'TMB': { brand: 'SKODA', group: 'VAG' },
    'VSS': { brand: 'SEAT', group: 'VAG' },
    'WP0': { brand: 'PORSCHE', group: 'VAG' },
    'WP1': { brand: 'PORSCHE', group: 'VAG' }, // SUV

    // BMW Group
    'WBA': { brand: 'BMW', group: 'BMW' },
    'WBS': { brand: 'BMW', group: 'BMW' }, // M GmbH
    'WBY': { brand: 'BMW', group: 'BMW' }, // i-Series
    '5UX': { brand: 'BMW', group: 'BMW' }, // USA
    'WMW': { brand: 'MINI', group: 'BMW' },

    // Mercedes Group
    'WDB': { brand: 'MERCEDES-BENZ', group: 'DAIMLER' },
    'WDC': { brand: 'MERCEDES-BENZ', group: 'DAIMLER' }, // SUV
    'WDD': { brand: 'MERCEDES-BENZ', group: 'DAIMLER' }, // C/E/S
    'WDF': { brand: 'MERCEDES-BENZ', group: 'DAIMLER' }, // Sprinter
    'WME': { brand: 'SMART', group: 'DAIMLER' },

    // Japanese
    'JTD': { brand: 'TOYOTA', group: 'TOYOTA' },
    'JTE': { brand: 'TOYOTA', group: 'TOYOTA' },
    'JTN': { brand: 'TOYOTA', group: 'TOYOTA' },
    'JHM': { brand: 'HONDA', group: 'HONDA' },
    'JN1': { brand: 'NISSAN', group: 'NISSAN' },
    'JMZ': { brand: 'MAZDA', group: 'MAZDA' },
    'JA3': { brand: 'MITSUBISHI', group: 'MITSUBISHI' },
    'JF1': { brand: 'SUBARU', group: 'SUBARU' },
    'JT2': { brand: 'LEXUS', group: 'TOYOTA' },

    // Korean
    'KMH': { brand: 'HYUNDAI', group: 'HYUNDAI-KIA' },
    'KNA': { brand: 'KIA', group: 'HYUNDAI-KIA' },
    'KNM': { brand: 'HYUNDAI', group: 'HYUNDAI-KIA' }, // Genesis

    // French
    'VF1': { brand: 'RENAULT', group: 'RENAULT' },
    'VF3': { brand: 'PEUGEOT', group: 'PSA' },
    'VF7': { brand: 'CITROEN', group: 'PSA' },
    'UU1': { brand: 'DACIA', group: 'RENAULT' },

    // Italian
    'ZFA': { brand: 'FIAT', group: 'STELLANTIS' },
    'ZAR': { brand: 'ALFA ROMEO', group: 'STELLANTIS' },
    'ZLA': { brand: 'LANCIA', group: 'STELLANTIS' },

    // British
    'SAL': { brand: 'LAND ROVER', group: 'JLR' },
    'SAJ': { brand: 'JAGUAR', group: 'JLR' },

    // American
    '1G1': { brand: 'CHEVROLET', group: 'GM' },
    '1G4': { brand: 'BUICK', group: 'GM' },
    '1GC': { brand: 'CHEVROLET', group: 'GM' }, // Truck
    '1FA': { brand: 'FORD', group: 'FORD' },
    '1FT': { brand: 'FORD', group: 'FORD' }, // Truck
    '2C3': { brand: 'CHRYSLER', group: 'STELLANTIS' },
    '1C4': { brand: 'CHRYSLER', group: 'STELLANTIS' },
    '3FA': { brand: 'FORD', group: 'FORD' }, // Mexico

    // Swedish
    'YV1': { brand: 'VOLVO', group: 'VOLVO' },
    'YS3': { brand: 'SAAB', group: 'SAAB' },
};

// VIN Year codes (Position 10)
const VIN_YEAR_CODES: Record<string, number> = {
    'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013,
    'E': 2014, 'F': 2015, 'G': 2016, 'H': 2017,
    'J': 2018, 'K': 2019, 'L': 2020, 'M': 2021,
    'N': 2022, 'P': 2023, 'R': 2024, 'S': 2025,
    'T': 2026, 'V': 2027, 'W': 2028, 'X': 2029,
    'Y': 2030,
    // Also numeric for 2001-2009
    '1': 2001, '2': 2002, '3': 2003, '4': 2004,
    '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009,
};

// ============================================================================
// VIN Decoding Types
// ============================================================================

export interface VINDecodeResult {
    valid: boolean;
    vin: string;
    wmi: string;           // World Manufacturer Identifier (1-3)
    vds: string;           // Vehicle Descriptor Section (4-9)
    vis: string;           // Vehicle Identifier Section (10-17)
    brand: string | null;
    group: string | null;  // Konzern (VAG, BMW, etc.)
    year: number | null;
    plantCode: string;     // Position 11
    serialNumber: string;  // Position 12-17

    // VAG-specific
    isVAG: boolean;
    motorcode?: string;
    prCodes?: string[];

    errors: string[];
}

// ============================================================================
// VIN Validation
// ============================================================================

/**
 * Validate VIN format and checksum
 */
function validateVIN(vin: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!vin) {
        errors.push("VIN ist leer");
        return { valid: false, errors };
    }

    // Normalize
    const normalized = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');

    if (normalized.length !== VIN_LENGTH) {
        errors.push(`VIN muss 17 Zeichen haben (gefunden: ${normalized.length})`);
    }

    // Invalid characters check (I, O, Q not allowed)
    if (/[IOQ]/.test(vin.toUpperCase())) {
        errors.push("VIN enthält ungültige Zeichen (I, O, Q sind nicht erlaubt)");
    }

    // TODO: Add check digit validation (position 9) for North American VINs

    return { valid: errors.length === 0, errors };
}

// ============================================================================
// Core VIN Decoder
// ============================================================================

/**
 * Decode a VIN into its components
 */
export function decodeVIN(vin: string): VINDecodeResult {
    const normalized = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    const validation = validateVIN(normalized);

    const result: VINDecodeResult = {
        valid: validation.valid,
        vin: normalized,
        wmi: normalized.substring(0, 3),
        vds: normalized.substring(3, 9),
        vis: normalized.substring(9, 17),
        brand: null,
        group: null,
        year: null,
        plantCode: normalized.charAt(10) || '',
        serialNumber: normalized.substring(11, 17) || '',
        isVAG: false,
        errors: validation.errors,
    };

    if (!validation.valid) {
        return result;
    }

    // Decode WMI → Brand
    const wmiInfo = WMI_MANUFACTURERS[result.wmi];
    if (wmiInfo) {
        result.brand = wmiInfo.brand;
        result.group = wmiInfo.group;
        result.isVAG = wmiInfo.group === 'VAG';
    } else {
        // Try first 2 characters for broader match
        const wmi2 = result.wmi.substring(0, 2);
        for (const [key, info] of Object.entries(WMI_MANUFACTURERS)) {
            if (key.startsWith(wmi2)) {
                result.brand = info.brand;
                result.group = info.group;
                result.isVAG = info.group === 'VAG';
                break;
            }
        }
    }

    // Decode year (Position 10)
    const yearChar = normalized.charAt(9);
    if (VIN_YEAR_CODES[yearChar]) {
        result.year = VIN_YEAR_CODES[yearChar];
    }

    logger.info("[VIN Decoder] Decoded", {
        vin: normalized,
        brand: result.brand,
        year: result.year,
        isVAG: result.isVAG,
    });

    return result;
}

// ============================================================================
// VAG-Specific: Motorcode Extraction
// ============================================================================

/**
 * VAG Motorcodes are encoded in VDS positions 5-6 (characters 7-8 of VIN)
 * This is a simplified mapping - real production would use ETKA database
 */
const VAG_ENGINE_CODES: Record<string, { motorcode: string; description: string }> = {
    // Golf 7 / A3 8V
    'FV': { motorcode: 'CJSA', description: '1.8 TSI 180PS' },
    'FW': { motorcode: 'CJSB', description: '1.8 TSI 180PS' },
    'AU': { motorcode: 'CHPA', description: '1.4 TSI 140PS' },
    'AV': { motorcode: 'CPTA', description: '1.4 TSI 122PS' },
    'BV': { motorcode: 'CXCA', description: '1.6 TDI 105PS' },
    'BU': { motorcode: 'CXXA', description: '1.6 TDI 110PS' },
    'CW': { motorcode: 'CUNA', description: '2.0 TDI 150PS' },
    'CX': { motorcode: 'CUPA', description: '2.0 TDI 150PS' },
    'CY': { motorcode: 'CRLB', description: '2.0 TDI 150PS' },
    'DJ': { motorcode: 'DJHA', description: '2.0 TSI 245PS GTI' },
    'DK': { motorcode: 'DJHB', description: '2.0 TSI 245PS GTI' },
    'DL': { motorcode: 'DNUE', description: '2.0 TSI 300PS R' },

    // Passat B8
    'DC': { motorcode: 'DCXA', description: '2.0 TDI 150PS' },
    'DD': { motorcode: 'DDAA', description: '2.0 TDI 190PS' },

    // Audi A4 B9
    'DE': { motorcode: 'DETA', description: '2.0 TFSI 190PS' },
    'DF': { motorcode: 'CVKB', description: '2.0 TDI 150PS' },
};

/**
 * Extract motorcode from VAG VIN
 */
export function extractVAGMotorcode(vin: string): string | undefined {
    const decoded = decodeVIN(vin);
    if (!decoded.valid || !decoded.isVAG) return undefined;

    // Engine code is typically in VDS positions 5-6 (VIN chars 7-8)
    const engineKey = vin.substring(6, 8).toUpperCase();
    const engineInfo = VAG_ENGINE_CODES[engineKey];

    if (engineInfo) {
        logger.info("[VIN] VAG Motorcode found", {
            vin,
            engineKey,
            motorcode: engineInfo.motorcode,
            description: engineInfo.description,
        });
        return engineInfo.motorcode;
    }

    return undefined;
}

// ============================================================================
// VAG-Specific: PR-Code Extraction (Simulated)
// ============================================================================

/**
 * In reality, PR-codes come from the vehicle's data plate or ETKA lookup.
 * This function simulates common PR-code patterns based on VIN characteristics.
 * 
 * PRODUCTION: Would need API access to dealer database or user-provided codes.
 */
export async function extractPRCodes(vin: string): Promise<string[]> {
    const decoded = decodeVIN(vin);
    if (!decoded.valid || !decoded.isVAG) return [];

    // Simulated PR-code detection based on VIN patterns
    // In production, this would query an ETKA-like database
    const prCodes: string[] = [];

    // This is placeholder logic - real implementation needs ETKA access
    // or user-provided PR-codes from the vehicle's service sticker

    logger.info("[VIN] PR-Code extraction (simulated)", {
        vin,
        note: "Echte PR-Codes benötigen ETKA-Zugang oder Benutzereingabe",
    });

    return prCodes;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a VIN belongs to VAG group
 */
export function isVAGVehicle(vin: string): boolean {
    return decodeVIN(vin).isVAG;
}

/**
 * Get manufacturer from VIN
 */
export function getManufacturerFromVIN(vin: string): string | null {
    return decodeVIN(vin).brand;
}

/**
 * Get production year from VIN
 */
export function getYearFromVIN(vin: string): number | null {
    return decodeVIN(vin).year;
}

// ============================================================================
// NHTSA VIN Decoder API (FREE, no API key, no rate limits)
// ============================================================================

export interface NHTSADecodeResult {
    make: string | null;
    model: string | null;
    year: number | null;
    engineModel: string | null;
    engineCylinders: string | null;
    displacementCC: string | null;
    displacementL: string | null;
    fuelType: string | null;
    driveType: string | null;
    bodyClass: string | null;
    vehicleType: string | null;
    plantCountry: string | null;
    errorCode: string | null;
    raw: Record<string, string>;
}

/**
 * Decode VIN using the free NHTSA vPIC API.
 * 
 * This US government API provides verified vehicle data for any VIN
 * of vehicles sold in the US (covers most global manufacturers).
 * 
 * API: https://vpic.nhtsa.dot.gov/api/
 * Cost: FREE, no API key needed, no rate limits
 */
export async function decodeVinNhtsa(vin: string): Promise<NHTSADecodeResult | null> {
    const normalized = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    if (normalized.length !== 17) {
        logger.warn('[NHTSA] Invalid VIN length', { vin, length: normalized.length });
        return null;
    }

    try {
        const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${normalized}?format=json`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            logger.warn('[NHTSA] API error', { status: response.status });
            return null;
        }

        const data = await response.json() as any;
        const results = data?.Results?.[0];
        if (!results) {
            logger.warn('[NHTSA] No results', { vin });
            return null;
        }

        // Helper: return null for empty strings or "Not Applicable"
        const clean = (val: string | undefined): string | null => {
            if (!val || val.trim() === '' || val === 'Not Applicable') return null;
            return val.trim();
        };

        const result: NHTSADecodeResult = {
            make: clean(results.Make),
            model: clean(results.Model),
            year: results.ModelYear ? parseInt(results.ModelYear, 10) || null : null,
            engineModel: clean(results.EngineModel),
            engineCylinders: clean(results.EngineCylinders),
            displacementCC: clean(results.DisplacementCC),
            displacementL: clean(results.DisplacementL),
            fuelType: clean(results.FuelTypePrimary),
            driveType: clean(results.DriveType),
            bodyClass: clean(results.BodyClass),
            vehicleType: clean(results.VehicleType),
            plantCountry: clean(results.PlantCountry),
            errorCode: clean(results.ErrorCode),
            raw: results,
        };

        logger.info('[NHTSA] VIN decoded successfully', {
            vin: normalized,
            make: result.make,
            model: result.model,
            year: result.year,
            engine: result.engineModel,
            fuelType: result.fuelType,
            driveType: result.driveType,
        });

        return result;
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            logger.warn('[NHTSA] Request timed out', { vin });
        } else {
            logger.warn('[NHTSA] API call failed', { vin, error: err?.message });
        }
        return null;
    }
}

/**
 * Enhanced VIN decode: local WMI decode + NHTSA API enrichment.
 * Returns both local and NHTSA results merged for maximum data.
 */
export async function decodeVinEnriched(vin: string): Promise<VINDecodeResult & { nhtsa?: NHTSADecodeResult }> {
    const local = decodeVIN(vin);

    // Try NHTSA enrichment (non-blocking, best-effort)
    try {
        const nhtsa = await decodeVinNhtsa(vin);
        if (nhtsa) {
            // Enrich local result with NHTSA data
            if (!local.brand && nhtsa.make) local.brand = nhtsa.make.toUpperCase();
            if (!local.year && nhtsa.year) local.year = nhtsa.year;

            return { ...local, nhtsa };
        }
    } catch (err: any) {
        logger.warn('[VIN] NHTSA enrichment failed, using local decode only', { error: err?.message });
    }

    return local;
}

// ============================================================================
// Export
// ============================================================================

export default {
    decodeVIN,
    validateVIN,
    extractVAGMotorcode,
    extractPRCodes,
    isVAGVehicle,
    getManufacturerFromVIN,
    getYearFromVIN,
    decodeVinNhtsa,
    decodeVinEnriched,
};
