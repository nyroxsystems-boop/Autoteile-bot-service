import axios from "axios";
import BaseInventoryProvider, {
  InventoryProviderConnection,
  NormalizedInventoryResult
} from "./baseInventoryProvider";
import { ProviderTypes } from "../providerTypes";

export default class DemoWwsProvider extends BaseInventoryProvider {
  constructor(connection: InventoryProviderConnection) {
    super(connection);
    this.type = ProviderTypes.DEMO_WWS;
    this.baseUrl = connection.baseUrl || "http://localhost:4000";
  }

  async checkAvailabilityByOem(oemNumber: string): Promise<NormalizedInventoryResult[]> {
    const target = `${this.baseUrl}/api/inventory/by-oem/${encodeURIComponent(oemNumber)}`;
    try {
      const response = await axios.get(target);
      const data = response.data || {};
      const items = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

      return items.map((item: any): NormalizedInventoryResult => {
        const raw = item?.raw ?? item;
        return {
          systemId: this.id,
          systemName: this.name,
          providerType: this.type,
          oemNumber: item?.oemNumber || data?.oemNumber || oemNumber,
          internalPartId: item?.partId ?? raw?.id ?? null,
          internalSku: item?.internalSku ?? raw?.internalSku ?? null,
          title: item?.title ?? raw?.title ?? null,
          brand: item?.brand ?? raw?.brand ?? null,
          model: item?.model ?? raw?.model ?? null,
          price: typeof item?.price === "number" ? item.price : raw?.price ?? null,
          currency: item?.currency ?? raw?.currency ?? null,
          availableQuantity:
            typeof item?.availableQuantity === "number"
              ? item.availableQuantity
              : typeof raw?.availableQuantity === "number"
              ? raw.availableQuantity
              : null,
          deliveryTime: item?.deliveryTime ?? raw?.deliveryTime ?? null,
          sourceRaw: item
        };
      });
    } catch (error: any) {
      console.error("[DemoWwsProvider] error", error?.message ?? error);
      return [];
    }
  }
}
