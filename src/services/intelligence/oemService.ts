export interface VehicleLookup {
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
  vin?: string;
  hsn?: string;
  tsn?: string;
}
/** @deprecated Use VehicleLookup instead */
export type TecDocVehicleLookup = VehicleLookup;
import { determineRequiredFields } from "./oemRequiredFieldsService";
import { resolveOEM as resolveOEMUnified } from "./oemResolver";
import { OEMResolverRequest, OEMResolverResult } from "./types";
import { resolveOemApex } from "./apexPipeline";
import { logger } from "@utils/logger";

export interface OemResolutionResult {
  success: boolean;
  oemNumber?: string | null;
  requiredFields?: string[];
  message?: string;
  oemData?: Record<string, any>;
}

/**
 * Simple OEM lookup — used by routes/oem.ts, langchainTools.ts, botLogicService.ts.
 * Routes through APEX pipeline now instead of deleted oemWebFinder.
 */
export async function resolveOEM(vehicle: VehicleLookup, part: string): Promise<OemResolutionResult> {
  const missing = determineRequiredFields(vehicle);
  if (missing.length > 0) {
    return { success: false, requiredFields: missing, message: "Es fehlen Fahrzeugdaten." };
  }

  const req: OEMResolverRequest = {
    orderId: "lookup",
    vehicle: {
      make: vehicle.make ?? undefined,
      model: vehicle.model ?? undefined,
      year: vehicle.year ?? undefined,
      vin: vehicle.vin ?? undefined,
      hsn: vehicle.hsn ?? undefined,
      tsn: vehicle.tsn ?? undefined,
    },
    partQuery: {
      rawText: part || "",
      suspectedNumber: null,
    },
  };

  try {
    const result = await resolveOemApex(req);
    return {
      success: !!result.primaryOEM,
      oemNumber: result.primaryOEM,
      message: result.primaryOEM ? undefined : "Keine OEM gefunden",
      oemData: { candidates: result.candidates, notes: result.notes },
    };
  } catch (err: any) {
    logger.warn("[OEMService] resolveOEM APEX failed:", { error: err?.message });
    return { success: false, message: `Fehler: ${err?.message}` };
  }
}

function extractSuspectedArticleNumber(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/\b([A-Z0-9][A-Z0-9\-\.\s]{4,})\b/i);
  if (!match) return null;
  const cleaned = match[1].replace(/[\s\.]+/g, "");
  return cleaned.length >= 5 ? cleaned : null;
}

/**
 * Primary OEM resolver entry — uses APEX dual-AI pipeline.
 * Emergency fallback to legacy resolver only if APEX completely crashes.
 * Bot flow calls this exclusively.
 */
export async function resolveOEMForOrder(
  orderId: string,
  vehicle: {
    make?: string | null;
    model?: string | null;
    year?: number | null;
    engine?: string | null;
    engineKw?: number | null;
    vin?: string | null;
    hsn?: string | null;
    tsn?: string | null;
  },
  partText: string
): Promise<OEMResolverResult> {
  const normalizedPartText = partText || "";
  const suspectedArticle = extractSuspectedArticleNumber(normalizedPartText);

  const req: OEMResolverRequest = {
    orderId,
    vehicle: {
      make: vehicle.make ?? undefined,
      model: vehicle.model ?? undefined,
      year: vehicle.year ?? undefined,
      kw: vehicle.engineKw ?? undefined,
      vin: vehicle.vin ?? undefined,
      hsn: vehicle.hsn ?? undefined,
      tsn: vehicle.tsn ?? undefined
    },
    partQuery: {
      rawText: normalizedPartText,
      suspectedNumber: suspectedArticle
    }
  };

  try {
    return await resolveOemApex(req);
  } catch (err: any) {
    logger.error("[OEMService] APEX pipeline crashed — falling back to legacy:", { error: err?.message });
    try {
      return await resolveOEMUnified(req);
    } catch (legacyErr: any) {
      logger.error("[OEMService] Legacy resolver also failed:", { error: legacyErr?.message });
      return {
        primaryOEM: undefined,
        candidates: [],
        overallConfidence: 0,
        notes: `Both APEX and legacy resolver failed: ${err?.message}`,
      };
    }
  }
}
