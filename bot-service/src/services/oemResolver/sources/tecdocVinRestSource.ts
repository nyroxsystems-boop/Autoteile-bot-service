import { TecDocClient } from "../../tecdocRapidClient";
import { OEMSource, clampConfidence, logSourceResult } from "./baseSource";
import { OEMCandidate, OEMResolverRequest } from "../types";
import { VehicleDatabasesClient } from "../../vehicleDatabasesClient";

function normalizeOem(oem: string | null | undefined): string {
  return (oem || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function collectOemsFromArticles(resp: any): string[] {
  const out = new Set<string>();
  const items: any[] = resp?.data || resp?.articles || resp?.results || resp || [];
  for (const it of items) {
    const candidates = [
      it?.articleNo,
      it?.articleNumber,
      ...(it?.oeNumbers || []).map((o: any) => o?.oeNumber || o?.oemNumber)
    ].filter(Boolean);
    candidates.forEach((c: any) => {
      const norm = normalizeOem(String(c));
      if (norm) out.add(norm);
    });
  }
  return Array.from(out);
}

export const tecdocVinRestSource: OEMSource = {
  name: "tecdoc_vin_rest",

  async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
    const out: OEMCandidate[] = [];
    if (!req.vehicle.vin) return out;

    try {
      const client = new TecDocClient({
        apiKey: process.env.TECDOC_API_KEY || process.env.RAPIDAPI_KEY,
        apiHost: process.env.TECDOC_RAPIDAPI_HOST || process.env.RAPIDAPI_HOST || "tecdoc-catalog.p.rapidapi.com"
      });

      const langId = "4";
      const typeId = "1"; // PKW

      const decodeVariants: ("v3" | "v2" | "v1")[] = ["v3", "v2", "v1"];
      let vehicleId: string | number | null = null;
      for (const v of decodeVariants) {
        try {
          const vinRes = await client.decodeVin(req.vehicle.vin, v);
          const decoded = vinRes?.data?.[0] || vinRes?.data || vinRes;
          const candidate =
            decoded?.vehicleId ||
            decoded?.typeId ||
            decoded?.type_id ||
            decoded?.carId ||
            decoded?.car_id ||
            decoded?.ktypnr ||
            decoded?.ktypnr_id ||
            null;
          if (candidate) {
            vehicleId = candidate;
            break;
          }
        } catch {
          // continue
        }
      }

      if (!vehicleId) {
        // Fallback: try external vehicle history decoder to at least enrich meta (no OEM extraction here)
        try {
          const vdb = new VehicleDatabasesClient();
          const history = await vdb.getVehicleHistory(req.vehicle.vin);
          out.push({
            oem: "",
            source: this.name,
            confidence: 0,
            meta: { vehicleHistory: history }
          });
        } catch {
          // ignore
        }
        logSourceResult(this.name, 0);
        return out;
      }

      // Try OEM parts by description (roughly from requested part text)
      const searchParam = (req.partQuery.rawText || "BRAKE").slice(0, 50);
      try {
        const oemParts = await client.selectOemPartsByVehicleAndDescription(typeId, String(vehicleId), langId, searchParam);
        const oems = collectOemsFromArticles(oemParts);
        for (const oem of oems) {
          out.push({
            oem,
            source: this.name,
            confidence: clampConfidence(0.85),
            meta: { vehicleId, method: "selectOemPartsByVehicleAndDescription" }
          });
        }
      } catch {
        /* ignore */
      }

      // Fallback: categories variant 3 -> articles
      try {
        const cats = await client.listCategoriesForVehicle(typeId, String(vehicleId), langId, 3);
        const categories: any[] = cats?.data || cats?.genericArticles || cats || [];
        const firstCatId =
          categories?.[0]?.categoryId ||
          categories?.[0]?.genericArticleId ||
          categories?.[0]?.assemblyGroupNodeId ||
          null;
        if (firstCatId) {
          const arts = await client.listArticlesForVehicleCategory(typeId, String(vehicleId), String(firstCatId), langId);
          const oems = collectOemsFromArticles(arts);
          for (const oem of oems) {
            out.push({
              oem,
              source: this.name,
              confidence: clampConfidence(0.75),
              meta: { vehicleId, categoryId: firstCatId, method: "listArticlesForVehicleCategory" }
            });
          }
        }
      } catch {
        /* ignore */
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
