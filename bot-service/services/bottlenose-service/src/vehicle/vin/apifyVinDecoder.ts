import { createApifyClient } from "../../integrations/apify/apifyClient";
import { VehicleDescriptor } from "../../shops/sources/apifyShopSearchSourceBase";

export interface VinDecoder {
  decode(vin: string): Promise<VehicleDescriptor | null>;
}

interface VinActorResult {
  vin?: string;
  brand?: string;
  make?: string;
  model?: string;
  engineCode?: string;
  year?: number;
  [key: string]: any;
}

export class ApifyVinDecoder implements VinDecoder {
  private actorId: string;

  constructor(actorId = "vin-decoder") {
    this.actorId = actorId;
  }

  async decode(vin: string): Promise<VehicleDescriptor | null> {
    if (!vin) return null;
    try {
      const client = createApifyClient();
      const result = await client.callActor<{ vin: string }, VinActorResult>(this.actorId, { vin });
      if (!result) return null;
      return {
        vin: result.vin || vin,
        brand: result.brand || result.make,
        make: result.make || result.brand,
        model: result.model,
        engineCode: result.engineCode,
        year: result.year
      };
    } catch (_e) {
      return null;
    }
  }
}
