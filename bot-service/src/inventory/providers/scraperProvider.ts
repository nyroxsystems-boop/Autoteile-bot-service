import axios from "axios";
import BaseInventoryProvider, {
  InventoryProviderConnection,
  NormalizedInventoryResult
} from "./baseInventoryProvider";
import { ProviderTypes } from "../providerTypes";

const SCRAPER_SERVICE_BASE_URL = process.env.SCRAPER_SERVICE_BASE_URL || "http://localhost:4100";

export default class ScraperProvider extends BaseInventoryProvider {
  constructor(connection: InventoryProviderConnection) {
    super(connection);
    this.type = ProviderTypes.SCRAPER;
  }

  async checkAvailabilityByOem(oemNumber: string): Promise<NormalizedInventoryResult[]> {
    const body = {
      oemNumber,
      connectionId: this.id,
      config: this.config
    };

    try {
      const res = await axios.post(
        `${SCRAPER_SERVICE_BASE_URL}/api/scrape/wws-inventory-by-oem`,
        body,
        { timeout: 30000 }
      );

      if (!res.data?.ok) {
        console.error("[ScraperProvider] scraper-service returned error", res.data?.error);
        return [];
      }

      const items = res.data.items || [];

      return items.map((item: any): NormalizedInventoryResult => ({
        systemId: this.id,
        systemName: this.name,
        providerType: this.type,
        oemNumber: item?.oemNumber || oemNumber,
        internalPartId: null,
        internalSku: null,
        title: item?.title ?? null,
        brand: item?.brand ?? null,
        model: item?.model ?? null,
        price: item?.price ?? null,
        currency: item?.currency ?? null,
        availableQuantity: item?.availableQuantity ?? null,
        deliveryTime: item?.deliveryTime ?? null,
        sourceRaw: item
      }));
    } catch (err: any) {
      console.error("[ScraperProvider] error", this.name, err?.message || err);
      return [];
    }
  }
}
