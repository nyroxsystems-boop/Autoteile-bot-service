"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tecdocVinRestSource = void 0;
const baseSource_1 = require("./baseSource");
const tecdocClient_1 = require("../../tecdocClient");
/**
 * Premium source using VIN decoding via TecDoc.
 * Most accurate way to find the exact vehicle and its specific OE numbers.
 */
exports.tecdocVinRestSource = {
    name: "tecdoc_vin",
    async resolveCandidates(req) {
        if (!req.vehicle.vin)
            return [];
        try {
            // 1. Decode VIN
            const vinResponse = await tecdocClient_1.tecdocApi.getVehicleByVin({
                vin: req.vehicle.vin,
                country: "DE"
            });
            const vehicleId = vinResponse.data?.[0]?.vehicleId;
            if (!vehicleId)
                return [];
            // 2. Find Category
            const categories = await tecdocClient_1.tecdocApi.getCategoryV3({ carId: vehicleId, country: "DE" });
            const cat = (0, tecdocClient_1.findCategoryByName)(req.partQuery.rawText, categories.data || []);
            if (!cat)
                return [];
            // 3. Get Articles
            const articles = await tecdocClient_1.tecdocApi.getArticlesList({
                carId: vehicleId,
                linkageTargetType: "P",
                genericArticleId: cat.genericArticleId,
                country: "DE",
                includeAe: true
            });
            const candidates = (articles.data || []).flatMap((art) => (art.oeNumbers || []).map((oe) => ({
                oem: String(oe.oeNumber).toUpperCase().replace(/[^A-Z0-9]/g, ""),
                brand: art.brandName,
                source: this.name,
                confidence: (0, baseSource_1.clampConfidence)(0.95), // VIN Match is very precise
                meta: { vin: req.vehicle.vin, articleNo: art.articleNo }
            })));
            (0, baseSource_1.logSourceResult)(this.name, candidates.length);
            return candidates;
        }
        catch (err) {
            return [];
        }
    }
};
