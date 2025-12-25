import { OEMResolverRequest, OEMCandidate } from "../types";
import { OEMSource, clampConfidence, logSourceResult } from "./baseSource";
import { tecdocApi, findBestManufacturer, findBestModel, findBestEngine, findCategoryByName } from "../../tecdocClient";

/**
 * High-confidence source using the official TecDoc API.
 * Maps part names to categories and finds OE numbers for the specific vehicle.
 */
export const tecdocLightSource: OEMSource = {
  name: "tecdoc_light",

  async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
    try {
      // 1. Find Vehicle ID
      let vehicleId: number | undefined;

      if (req.vehicle.hsn && req.vehicle.tsn) {
        const vResponse = await tecdocApi.listVehicleTypes({
          hsn: req.vehicle.hsn,
          tsn: req.vehicle.tsn,
          country: "DE"
        });
        vehicleId = vResponse.data?.[0]?.carId || vResponse.data?.[0]?.vehicleId;
      }

      if (!vehicleId && req.vehicle.make && req.vehicle.model) {
        // Fallback: search by make/model
        const brands = await tecdocApi.getManufacturers({ country: "DE" });
        const brand = findBestManufacturer(req.vehicle.make, brands.data || []);
        if (brand) {
          const models = await tecdocApi.getModels({ manuId: brand.manuId, country: "DE" });
          const model = findBestModel(req.vehicle.model, req.vehicle.year, models.data || []);
          if (model) {
            const engines = await tecdocApi.getVehicleEngineTypes({
              manuId: brand.manuId,
              modelId: model.modelId,
              country: "DE"
            });
            // Try to match by kW if available in request
            const engine = findBestEngine(undefined, req.vehicle.year, engines.data || []);
            vehicleId = engine?.vehicleId ?? engines.data?.[0]?.vehicleId;
          }
        }
      }

      if (!vehicleId) return [];

      // 2. Find Category
      const categories = await tecdocApi.getCategoryV3({ carId: vehicleId, country: "DE" });
      const cat = findCategoryByName(req.partQuery.rawText, categories.data || []);
      if (!cat) return [];

      // 3. Get Articles
      const articles = await tecdocApi.getArticlesList({
        carId: vehicleId,
        linkageTargetType: "P",
        genericArticleId: cat.genericArticleId,
        country: "DE",
        includeAe: true
      });

      const candidates: OEMCandidate[] = [];
      for (const art of (articles.data || [])) {
        const a = art as any; // fallback for loosely typed article
        if (a.oeNumbers && a.oeNumbers.length > 0) {
          for (const oe of a.oeNumbers) {
            if (oe.oeNumber) {
              candidates.push({
                oem: oe.oeNumber.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                brand: a.brandName,
                source: this.name,
                confidence: clampConfidence(0.9), // TecDoc is very trustworthy
                meta: { articleNo: a.articleNo, genericArticleName: a.genericArticleDescription }
              });
            }
          }
        }
      }

      logSourceResult(this.name, candidates.length);
      return candidates;
    } catch (err) {
      return [];
    }
  }
};
