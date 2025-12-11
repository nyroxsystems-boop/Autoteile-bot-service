import { createApifyClient } from "../../integrations/apify/apifyClient";
import { OEMResolutionCandidate, OemResolutionInput } from "./apifyPartNumberCrossRefSource";

export class BrandOemCatalogSource {
  name: string;
  private actorId: string;

  constructor(actorId: string, brandLabel: string) {
    this.actorId = actorId;
    this.name = `apify:brand-catalog:${brandLabel.toLowerCase()}`;
  }

  async resolve(input: OemResolutionInput): Promise<OEMResolutionCandidate[]> {
    const vehicle = input.vehicle || {};
    const payload = {
      vin: vehicle.vin,
      brand: (vehicle as any).brand || (vehicle as any).make,
      model: (vehicle as any).model,
      engineCode: (vehicle as any).engineCode,
      year: vehicle.year,
      partQuery: input.query
    };

    try {
      const client = createApifyClient();
      const items: any[] = (await client.callActor<any, any>(this.actorId, payload)) || [];
      if (!Array.isArray(items) || items.length === 0) return [];

      const vinPresent = Boolean(vehicle.vin);
      const baseConfidence = vinPresent ? 0.9 : 0.85;

      return items
        .map((it, idx) => {
          const oem = (it?.oem || it?.oemNumber || it?.reference) as string | undefined;
          if (!oem) return null;
          return {
            oemNumber: String(oem).toUpperCase().replace(/[^A-Z0-9]/g, ""),
            sourceName: this.name,
            confidence: baseConfidence,
            brand: (vehicle as any).brand || (vehicle as any).make,
            manufacturer: it?.manufacturer,
            raw: it,
            meta: { idx }
          } as OEMResolutionCandidate;
        })
        .filter((c): c is OEMResolutionCandidate => Boolean(c));
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn(`[${this.name}] brand catalog actor failed`, err?.message ?? err);
      return [];
    }
  }
}
