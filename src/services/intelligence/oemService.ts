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
import { findBestOemForVehicle, VehicleData, SearchContext } from "./oemWebFinder";
import { resolveOemApex } from "./apexPipeline";

export interface OemResolutionResult {
  success: boolean;
  oemNumber?: string | null;
  requiredFields?: string[];
  message?: string;
  oemData?: Record<string, any>;
}

// Vereinfachte Legacy-Signatur: nutzt den neuen Web-Finder
export async function resolveOEM(vehicle: VehicleLookup, part: string): Promise<OemResolutionResult> {
  const missing = determineRequiredFields(vehicle);
  if (missing.length > 0) {
    return { success: false, requiredFields: missing, message: "Es fehlen Fahrzeugdaten." };
  }
  const ctx: SearchContext = {
    vehicle: {
      vin: vehicle.vin || undefined,
      brand: vehicle.make || undefined,
      model: vehicle.model || undefined,
      year: vehicle.year || undefined,
      engineCode: vehicle.engine || undefined,
      hsn: vehicle.hsn || undefined,
      tsn: vehicle.tsn || undefined
    },
    userQuery: part
  };
  const res = await findBestOemForVehicle(ctx, true);
  return {
    success: !!res.bestOem,
    oemNumber: res.bestOem,
    message: res.bestOem ? undefined : "Keine OEM gefunden",
    oemData: { candidates: res.candidates, histogram: res.histogram, fallbackUsed: res.fallbackUsed }
  };
}

function extractSuspectedArticleNumber(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/\b([A-Z0-9][A-Z0-9\-\.\s]{4,})\b/i);
  if (!match) return null;
  const cleaned = match[1].replace(/[\s\.]+/g, "");
  return cleaned.length >= 5 ? cleaned : null;
}

/**
 * Unified OEM resolver entry — now uses APEX dual-AI pipeline.
 * Falls back to old resolver if APEX pipeline is unavailable.
 * Bot flow should call ONLY this from now on.
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
    // APEX: Dual-AI pipeline (Gemini + Claude)
    const result = await resolveOemApex(req);
    return result;
  } catch (err: any) {
    // Fallback: old multi-source resolver if APEX fails
    console.warn("[OEMService] APEX pipeline failed, falling back to legacy resolver:", err?.message);
    const result = await resolveOEMUnified(req);
    return result;
  }
}

