"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tecdocLightSource = void 0;
const baseSource_1 = require("./baseSource");
const tecdocClient_1 = require("../../tecdocClient");
/**
 * High-confidence source using the official TecDoc API.
 * Maps part names to categories and finds OE numbers for the specific vehicle.
 */
exports.tecdocLightSource = {
    name: "tecdoc_light",
    async resolveCandidates(req) {
        try {
            // 1. Find Vehicle ID
            let vehicleId;
            if (req.vehicle.hsn && req.vehicle.tsn) {
                const vResponse = await tecdocClient_1.tecdocApi.listVehicleTypes({
                    hsn: req.vehicle.hsn,
                    tsn: req.vehicle.tsn,
                    country: "DE"
                });
                vehicleId = vResponse.data?.[0]?.carId || vResponse.data?.[0]?.vehicleId;
            }
            if (!vehicleId && req.vehicle.make && req.vehicle.model) {
                // Fallback: search by make/model
                const brands = await tecdocClient_1.tecdocApi.getManufacturers({ country: "DE" });
                const brand = (0, tecdocClient_1.findBestManufacturer)(req.vehicle.make, brands.data || []);
                if (brand) {
                    const models = await tecdocClient_1.tecdocApi.getModels({ manuId: brand.manuId, country: "DE" });
                    const model = (0, tecdocClient_1.findBestModel)(req.vehicle.model, req.vehicle.year, models.data || []);
                    if (model) {
                        const engines = await tecdocClient_1.tecdocApi.getVehicleEngineTypes({
                            manuId: brand.manuId,
                            modelId: model.modelId,
                            country: "DE"
                        });
                        // Try to match by kW if available in request
                        const engine = (0, tecdocClient_1.findBestEngine)(undefined, req.vehicle.year, engines.data || []);
                        vehicleId = engine?.vehicleId ?? engines.data?.[0]?.vehicleId;
                    }
                }
            }
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
            const candidates = [];
            for (const art of (articles.data || [])) {
                const a = art; // fallback for loosely typed article
                if (a.oeNumbers && a.oeNumbers.length > 0) {
                    for (const oe of a.oeNumbers) {
                        if (oe.oeNumber) {
                            candidates.push({
                                oem: oe.oeNumber.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                                brand: a.brandName,
                                source: this.name,
                                confidence: (0, baseSource_1.clampConfidence)(0.9), // TecDoc is very trustworthy
                                meta: { articleNo: a.articleNo, genericArticleName: a.genericArticleDescription }
                            });
                        }
                    }
                }
            }
            (0, baseSource_1.logSourceResult)(this.name, candidates.length);
            return candidates;
        }
        catch (err) {
            return [];
        }
    }
};
