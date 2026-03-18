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
import { resolveOemV2 } from "./v2/oemEngine";
import { logger } from "@utils/logger";

// ============================================================================
// Feature Flag: OEM Engine V2
// v2 is now the DEFAULT. Set OEM_ENGINE_V2=false to revert to legacy APEX.
// ============================================================================
const USE_V2_ENGINE = process.env.OEM_ENGINE_V2 !== 'false';

if (USE_V2_ENGINE) {
  logger.info('[OEMService] 🚀 v2 Engine ACTIVE — using new OEM Intelligence Engine');
}

export interface OemResolutionResult {
  success: boolean;
  oemNumber?: string | null;
  requiredFields?: string[];
  message?: string;
  oemData?: Record<string, any>;
}

/**
 * Simple OEM lookup — used by routes/oem.ts, langchainTools.ts, botLogicService.ts.
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
    const resolver = USE_V2_ENGINE ? resolveOemV2 : resolveOemApex;
    const result = await resolver(req);
    return {
      success: !!result.primaryOEM,
      oemNumber: result.primaryOEM,
      message: result.primaryOEM ? undefined : "Keine OEM gefunden",
      oemData: { candidates: result.candidates, notes: result.notes },
    };
  } catch (err: any) {
    logger.warn("[OEMService] resolveOEM failed:", { error: err?.message, engine: USE_V2_ENGINE ? 'v2' : 'apex' });
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
 * Primary OEM resolver entry — uses v2 engine (if enabled), APEX, or legacy.
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
  partText: string,
  position?: 'front' | 'rear' | 'left' | 'right' | 'front-left' | 'front-right' | 'rear-left' | 'rear-right' | 'any'
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
      suspectedNumber: suspectedArticle,
      position: position
    }
  };

  // v2 Engine — ONLY resolver (no external platforms)
  // Uses: Gemini AI + local SQLite DB. NO TecDoc, NO ScraperAPI, NO Apify.
  try {
    return await resolveOemV2(req);
  } catch (err: any) {
    logger.error("[OEMService] v2 engine failed:", { error: err?.message, orderId });
    return {
      primaryOEM: undefined,
      candidates: [],
      overallConfidence: 0,
      notes: `OEM-Suche fehlgeschlagen: ${err?.message}`,
    };
  }
}
