import { OEMResolverRequest, OEMCandidate } from "../types";
import { OEMSource, clampConfidence, logSourceResult } from "./baseSource";
import {
  tecdocApi,
  findBestManufacturer,
  findBestModel,
  findBestEngine,
  findCategoryByName,
  findManufacturerIdByName
} from "../../tecdocClient";

// Minimal manufacturer fallback map for RapidAPI gaps (extend as needed)
const MANUFACTURER_ID_MAP: Record<string, number> = {
  bmw: 63,
  vw: 2068,
  volkswagen: 2068,
  audi: 2031,
  mercedes: 2026,
  mercedesbenz: 2026,
  mercedes_benz: 2026,
  opel: 2153
};

export const tecdocLightSource: OEMSource = {
  name: "tecdoc_light",

  async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
    const out: OEMCandidate[] = [];
    const { vehicle, partQuery } = req;

    if (!vehicle.make || !vehicle.model || !vehicle.year) {
      return out;
    }

    try {
      const typeId = 1;
      const langId = 4; // English fallback
      const countryFilterId = 62; // Germany fallback

      // Manufacturer
      const manuListResp = await tecdocApi.getManufacturers({ typeId, langId, countryFilterId });
      const manuList: any[] = manuListResp?.data || manuListResp?.manufacturers || [];
      const manu = findBestManufacturer(vehicle.make, manuList);
      let manufacturerId = manu?.manuId ?? manu?.manufacturerId ?? null;
      if (!manufacturerId) {
        const mapKey = vehicle.make.toLowerCase().replace(/\s+/g, "");
        manufacturerId = MANUFACTURER_ID_MAP[mapKey] || (await findManufacturerIdByName(vehicle.make, { typeId, langId, countryFilterId }));
      }
      if (!manufacturerId) return out;

      // Models
      const modelsResp = await tecdocApi.getModels({ typeId, langId, countryFilterId, manufacturerId });
      const models: any[] = modelsResp?.data || modelsResp?.modelSeries || modelsResp?.models || [];
      const model = findBestModel(vehicle.model, vehicle.year ?? null, models);
      if (!model) return out;
      const modelSeriesId = model.modelSeriesId ?? model.modelId;
      if (!modelSeriesId) return out;

      // Engines
      const enginesResp = await tecdocApi.getVehicleEngineTypes({
        typeId,
        langId,
        countryFilterId,
        manufacturerId,
        modelSeriesId
      });
      const engines: any[] = enginesResp?.data || enginesResp?.vehicles || enginesResp?.engineTypes || [];
      const engineInput = (vehicle as any)?.engine ?? null;
      const engine = findBestEngine(engineInput, vehicle.year ?? null, vehicle.kw ?? null, engines);
      const vehicleId = engine?.vehicleId;
      if (!vehicleId) return out;

      // Categories
      const catResp = await tecdocApi.getCategoryV3({
        typeId,
        langId,
        countryFilterId,
        manufacturerId,
        vehicleId
      });
      const categories: any[] = catResp?.data || catResp?.genericArticles || catResp?.assemblyGroups || [];
      const category = findCategoryByName(partQuery.normalizedCategory || partQuery.rawText, categories);
      if (!category) return out;

      const productGroupId =
        category.categoryId ??
        category.genericArticleId ??
        category.levelId_3 ??
        category.levelId_2 ??
        category.levelId_1;

      if (!productGroupId) return out;

      // Articles (Light: best-effort)
      const artResp = await tecdocApi.getArticlesList({
        typeId,
        langId,
        countryFilterId,
        manufacturerId,
        vehicleId,
        productGroupId
      });
      const articles: any[] = artResp?.data || artResp?.articles || [];
      if (!articles.length) return out;

      for (const a of articles.slice(0, 5)) {
        const oem = a.articleNo || a?.oeNumbers?.[0]?.oeNumber;
        if (!oem) continue;
        out.push({
          oem,
          brand: a.brandName ?? a.mfrName ?? undefined,
          source: this.name,
          confidence: clampConfidence(0.6),
          meta: { articleId: a.articleId ?? null, productGroupId }
        });
      }

      logSourceResult(this.name, out.length);
      return out;
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn(`[${this.name}] failed:`, err?.message ?? err);
      return out;
    }
  }
};
