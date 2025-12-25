import type { OEMSource } from "./baseSource";
import { OEMResolverRequest, OEMCandidate } from "../types";
import { clampConfidence, logSourceResult } from "./baseSource";
import { tecdocApi, findCategoryByName } from "../../tecdocClient";

/**
 * Premium source using VIN decoding via TecDoc.
 * Most accurate way to find the exact vehicle and its specific OE numbers.
 */
export const tecdocVinRestSource: OEMSource = {
  name: "tecdoc_vin",

  async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
    if (!req.vehicle.vin) return [];

    try {
      // 1. Decode VIN
      const vinResponse = await tecdocApi.getVehicleByVin({
        vin: req.vehicle.vin,
        country: "DE"
      });

      const vehicleId = vinResponse.data?.[0]?.vehicleId;
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

      const candidates: OEMCandidate[] = (articles.data || []).flatMap((art: any) =>
        (art.oeNumbers || []).map((oe: any) => ({
          oem: String(oe.oeNumber).toUpperCase().replace(/[^A-Z0-9]/g, ""),
          brand: art.brandName,
          source: this.name,
          confidence: clampConfidence(0.95), // VIN Match is very precise
          meta: { vin: req.vehicle.vin, articleNo: art.articleNo }
        }))
      );

      logSourceResult(this.name, candidates.length);
      return candidates;
    } catch (err) {
      return [];
    }
  }
};
