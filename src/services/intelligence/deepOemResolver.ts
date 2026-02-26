/**
 * 🎯 DEEP OEM RESOLVER - Premium 10/10 Integration
 * 
 * This module integrates all deep OEM resolution components:
 * - VIN Decoding (brand, year, motorcode extraction)
 * - PR-Code Resolution (brake/suspension variants)
 * - Motorcode Resolution (engine-specific parts)
 * - Facelift Detection (pre/post facelift OEMs)
 * - Supersession Tracking (old→current OEM)
 * 
 * Called BEFORE the main oemResolver to add high-confidence candidates
 * based on vehicle-specific intelligence.
 */

import { logger } from "@utils/logger";
import { OEMResolverRequest, OEMCandidate } from "./types";

// Import all deep resolution modules
import { decodeVIN, decodeVinEnriched, extractVAGMotorcode, isVAGVehicle } from "./vinDecoder";
import { resolveByPRCode, detectPartCategory, suggestPRCodes } from "./prCodeResolver";
import { resolveByMotorcode, detectEnginePartCategory, findMotorcodesForModel } from "./motorcodeResolver";
import { detectFacelift, isFaceliftSensitivePart } from "./faceliftDetector";
import { checkSupersession, resolveToCurrentOEM } from "./supersessionTracker";
import { lookupBMWOEM, isBMWVehicle } from "./bmwOemDatabase";

// ============================================================================
// Deep Resolution Result
// ============================================================================

export interface DeepResolutionResult {
    candidates: OEMCandidate[];
    enrichedRequest: OEMResolverRequest;
    metadata: {
        vinDecoded: boolean;
        prCodeUsed?: string;
        motorcodeUsed?: string;
        faceliftStatus?: string;
        suggestions: {
            possiblePRCodes?: string[];
            possibleMotorcodes?: string[];
        };
    };
}

// ============================================================================
// Main Deep Resolution Function
// ============================================================================

/**
 * Perform deep OEM resolution using vehicle-specific intelligence
 * Returns high-confidence candidates and enriched request
 */
export async function performDeepResolution(
    req: OEMResolverRequest
): Promise<DeepResolutionResult> {
    const candidates: OEMCandidate[] = [];
    const enrichedRequest = { ...req, vehicle: { ...req.vehicle } };

    const metadata: DeepResolutionResult["metadata"] = {
        vinDecoded: false,
        suggestions: {},
    };

    logger.info("[Deep OEM] Starting deep resolution", {
        orderId: req.orderId,
        hasVIN: !!req.vehicle.vin,
        hasPRCodes: !!(req.vehicle.prCodes?.length),
        hasMotorcode: !!req.vehicle.motorcode,
        partQuery: req.partQuery.rawText.substring(0, 50),
    });

    // =========================================================================
    // Step 1: VIN Decoding
    // =========================================================================
    if (req.vehicle.vin) {
        // Use NHTSA-enriched VIN decoding (local + free US government API)
        const vinResult = await decodeVinEnriched(req.vehicle.vin);

        if (vinResult.valid) {
            metadata.vinDecoded = true;

            // Enrich request with VIN data if missing
            if (!enrichedRequest.vehicle.make && vinResult.brand) {
                enrichedRequest.vehicle.make = vinResult.brand;
            }
            if (!enrichedRequest.vehicle.year && vinResult.year) {
                enrichedRequest.vehicle.year = vinResult.year;
            }

            // NHTSA enrichment: extract engine data from government API
            if (vinResult.nhtsa) {
                if (!enrichedRequest.vehicle.motorcode && vinResult.nhtsa.engineModel) {
                    enrichedRequest.vehicle.motorcode = vinResult.nhtsa.engineModel;
                    logger.info("[Deep OEM] NHTSA engine model extracted", {
                        engine: vinResult.nhtsa.engineModel,
                        cylinders: vinResult.nhtsa.engineCylinders,
                        displacement: vinResult.nhtsa.displacementL,
                    });
                }
                // Log additional enrichment data
                logger.info("[Deep OEM] NHTSA VIN enrichment", {
                    make: vinResult.nhtsa.make,
                    model: vinResult.nhtsa.model,
                    year: vinResult.nhtsa.year,
                    fuelType: vinResult.nhtsa.fuelType,
                    driveType: vinResult.nhtsa.driveType,
                });
            }

            // Extract motorcode for VAG vehicles (fallback if NHTSA didn't provide)
            if (vinResult.isVAG && !enrichedRequest.vehicle.motorcode) {
                const motorcode = extractVAGMotorcode(req.vehicle.vin);
                if (motorcode) {
                    enrichedRequest.vehicle.motorcode = motorcode;
                    logger.info("[Deep OEM] Motorcode extracted from VIN", { motorcode });
                }
            }
        }
    }

    // =========================================================================
    // Step 2: Detect Part Category
    // =========================================================================
    const partQuery = req.partQuery.rawText;
    const brakeCategory = detectPartCategory(partQuery);
    const engineCategory = detectEnginePartCategory(partQuery);
    const partCategory = brakeCategory || engineCategory;

    if (partCategory) {
        enrichedRequest.partQuery = {
            ...enrichedRequest.partQuery,
            partCategory,
        };
    }

    // =========================================================================
    // Step 2.5: BMW OEM Database Lookup (Premium Feature)
    // =========================================================================
    const isBMW = enrichedRequest.vehicle.make &&
        isBMWVehicle(enrichedRequest.vehicle.make);

    if (isBMW && enrichedRequest.vehicle.model) {
        const bmwResult = lookupBMWOEM(
            enrichedRequest.vehicle.model,
            partQuery,
            enrichedRequest.vehicle.year
        );

        if (bmwResult.found && bmwResult.candidates.length > 0) {
            for (const bmwCandidate of bmwResult.candidates) {
                candidates.push({
                    oem: bmwCandidate.oem,
                    brand: "BMW",
                    source: bmwCandidate.source,
                    confidence: bmwCandidate.confidence,
                    meta: {
                        description: bmwCandidate.description,
                        position: bmwCandidate.position,
                        chassisCodes: bmwResult.chassisDetected,
                        partType: bmwResult.partTypeDetected,
                    },
                });
            }

            logger.info("[Deep OEM] BMW Database OEM found", {
                count: bmwResult.candidates.length,
                topOEM: bmwResult.candidates[0]?.oem,
                chassis: bmwResult.chassisDetected,
            });
        }
    }

    // =========================================================================
    // Step 3: PR-Code Resolution (VAG Brakes/Suspension)
    // =========================================================================
    const isVAG = enrichedRequest.vehicle.make &&
        ['VOLKSWAGEN', 'VW', 'AUDI', 'SKODA', 'SEAT', 'PORSCHE', 'CUPRA']
            .includes(enrichedRequest.vehicle.make.toUpperCase());

    if (isVAG && brakeCategory && enrichedRequest.vehicle.prCodes?.length) {
        for (const prCode of enrichedRequest.vehicle.prCodes) {
            const prResult = resolveByPRCode(prCode, brakeCategory, enrichedRequest.vehicle.model);

            if (prResult.found && prResult.oemMapping) {
                candidates.push({
                    oem: prResult.oemMapping.oem,
                    brand: enrichedRequest.vehicle.make,
                    source: `pr_code_${prCode}`,
                    confidence: 0.95, // High confidence for PR-code match
                    meta: {
                        prCode,
                        partCategory: brakeCategory,
                        description: prResult.oemMapping.description,
                    },
                });

                metadata.prCodeUsed = prCode;
                logger.info("[Deep OEM] PR-Code OEM found", {
                    prCode,
                    oem: prResult.oemMapping.oem,
                });
            }
        }
    }

    // Suggest possible PR-codes if none provided
    if (isVAG && brakeCategory && !enrichedRequest.vehicle.prCodes?.length && enrichedRequest.vehicle.model) {
        const suggestions = suggestPRCodes(
            enrichedRequest.vehicle.model,
            undefined,
            enrichedRequest.vehicle.kw
        );
        metadata.suggestions.possiblePRCodes = suggestions.brakes;

        logger.info("[Deep OEM] PR-Code suggestions", {
            model: enrichedRequest.vehicle.model,
            possibleCodes: suggestions.brakes,
        });
    }

    // =========================================================================
    // Step 4: Motorcode Resolution (Engine Parts)
    // =========================================================================
    if (engineCategory && enrichedRequest.vehicle.motorcode) {
        const mcResult = resolveByMotorcode(enrichedRequest.vehicle.motorcode, engineCategory);

        if (mcResult.found && mcResult.oemMapping) {
            candidates.push({
                oem: mcResult.oemMapping.oem,
                brand: enrichedRequest.vehicle.make,
                source: `motorcode_${enrichedRequest.vehicle.motorcode}`,
                confidence: 0.93, // High confidence for motorcode match
                meta: {
                    motorcode: enrichedRequest.vehicle.motorcode,
                    partCategory: engineCategory,
                    description: mcResult.oemMapping.description,
                    engineInfo: mcResult.engineInfo,
                },
            });

            metadata.motorcodeUsed = enrichedRequest.vehicle.motorcode;
            logger.info("[Deep OEM] Motorcode OEM found", {
                motorcode: enrichedRequest.vehicle.motorcode,
                oem: mcResult.oemMapping.oem,
            });
        }
    }

    // Suggest possible motorcodes if none provided
    if (isVAG && engineCategory && !enrichedRequest.vehicle.motorcode && enrichedRequest.vehicle.model) {
        const possibleEngines = findMotorcodesForModel(
            enrichedRequest.vehicle.model,
            enrichedRequest.vehicle.year
        );
        metadata.suggestions.possibleMotorcodes = possibleEngines.map(e => e.motorcode);

        logger.info("[Deep OEM] Motorcode suggestions", {
            model: enrichedRequest.vehicle.model,
            count: possibleEngines.length,
        });
    }

    // =========================================================================
    // Step 5: Facelift Detection
    // =========================================================================
    if (enrichedRequest.vehicle.make && enrichedRequest.vehicle.model && enrichedRequest.vehicle.year) {
        const faceliftResult = detectFacelift(
            enrichedRequest.vehicle.make,
            enrichedRequest.vehicle.model,
            enrichedRequest.vehicle.year,
            enrichedRequest.vehicle.month
        );

        if (faceliftResult.detected) {
            enrichedRequest.vehicle.faceliftStatus = faceliftResult.status;
            metadata.faceliftStatus = faceliftResult.status;

            // Add warning for facelift-sensitive parts
            if (partCategory && isFaceliftSensitivePart(partCategory)) {
                logger.warn("[Deep OEM] Facelift-sensitive part detected", {
                    status: faceliftResult.status,
                    part: partCategory,
                });
            }
        }
    }

    // =========================================================================
    // Step 6: Supersession Check (Post-process candidates)
    // =========================================================================
    for (const candidate of candidates) {
        const supersessionResult = checkSupersession(candidate.oem);

        if (supersessionResult.isOutdated) {
            // Update to current OEM
            candidate.meta = {
                ...candidate.meta,
                originalOEM: candidate.oem,
                superseded: true,
                supersessionReason: supersessionResult.supersessionChain?.reason,
            };
            candidate.oem = supersessionResult.currentOEM;

            logger.info("[Deep OEM] Supersession applied", {
                original: supersessionResult.originalOEM,
                current: supersessionResult.currentOEM,
            });
        }
    }

    logger.info("[Deep OEM] Resolution complete", {
        candidateCount: candidates.length,
        metadata,
    });

    return {
        candidates,
        enrichedRequest,
        metadata,
    };
}

// ============================================================================
// Quick Lookup Functions
// ============================================================================

/**
 * Quick check if we can do deep resolution for this request
 */
export function canDoDeepResolution(req: OEMResolverRequest): boolean {
    return !!(
        req.vehicle.vin ||
        req.vehicle.prCodes?.length ||
        req.vehicle.motorcode ||
        (req.vehicle.make && req.vehicle.model && req.vehicle.year)
    );
}

/**
 * Resolve supersession for any OEM (can be called on scraper results)
 */
export function applySupersession(oem: string): {
    oem: string;
    wasSuperseded: boolean;
    original?: string;
} {
    const result = checkSupersession(oem);
    return {
        oem: result.currentOEM,
        wasSuperseded: result.isOutdated,
        original: result.isOutdated ? result.originalOEM : undefined,
    };
}

// ============================================================================
// Export
// ============================================================================

export default {
    performDeepResolution,
    canDoDeepResolution,
    applySupersession,
};
