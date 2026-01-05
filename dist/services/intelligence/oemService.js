"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveOEM = resolveOEM;
exports.resolveOEMForOrder = resolveOEMForOrder;
const oemRequiredFieldsService_1 = require("./oemRequiredFieldsService");
const oemResolver_1 = require("./oemResolver");
const oemWebFinder_1 = require("./oemWebFinder");
// Vereinfachte Legacy-Signatur: nutzt den neuen Web-Finder
async function resolveOEM(vehicle, part) {
    const missing = (0, oemRequiredFieldsService_1.determineRequiredFields)(vehicle);
    if (missing.length > 0) {
        return { success: false, requiredFields: missing, message: "Es fehlen Fahrzeugdaten." };
    }
    const ctx = {
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
    const res = await (0, oemWebFinder_1.findBestOemForVehicle)(ctx, true);
    return {
        success: !!res.bestOem,
        oemNumber: res.bestOem,
        message: res.bestOem ? undefined : "Keine OEM gefunden",
        oemData: { candidates: res.candidates, histogram: res.histogram, fallbackUsed: res.fallbackUsed }
    };
}
function extractSuspectedArticleNumber(text) {
    if (!text)
        return null;
    const match = text.match(/\b([A-Z0-9][A-Z0-9\-\.\s]{4,})\b/i);
    if (!match)
        return null;
    const cleaned = match[1].replace(/[\s\.]+/g, "");
    return cleaned.length >= 5 ? cleaned : null;
}
/**
 * Unified OEM resolver entry that delegates to the new resolver (multi-source/scoring).
 * Bot flow should call ONLY this from now on.
 */
async function resolveOEMForOrder(orderId, vehicle, partText) {
    const normalizedPartText = partText || "";
    const suspectedArticle = extractSuspectedArticleNumber(normalizedPartText);
    // Einheitlicher Multi-Source-Resolver (TecDoc + Web-Scrape + LLM), mit suspectedNumber als Hint
    const req = {
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
    const result = await (0, oemResolver_1.resolveOEM)(req);
    return { ...result, tecdocPartsouqResult: undefined };
}
