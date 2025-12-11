import axios from "axios";
import { BOT_SERVICE_BASE_URL } from "../config/inventoryConfig";

export interface InventoryResult {
  systemId: string;
  systemName: string;
  providerType: string;
  oemNumber: string;
  internalPartId?: string | null;
  internalSku?: string | null;
  title?: string | null;
  brand?: string | null;
  model?: string | null;
  price?: number | null;
  currency?: string | null;
  availableQuantity?: number | null;
  deliveryTime?: string | null;
  sourceRaw?: any;
}

export interface CombinedInventoryResponse {
  oemNumber: string;
  results: InventoryResult[];
}

export async function fetchInventoryByOem(oemNumber: string): Promise<CombinedInventoryResponse> {
  const url = `${BOT_SERVICE_BASE_URL}/api/bot/inventory/by-oem/${encodeURIComponent(oemNumber)}`;
  try {
    const res = await axios.get<CombinedInventoryResponse>(url);
    return res.data;
  } catch (error: any) {
    console.error("[inventoryClient] fetchInventoryByOem error", error?.message || error);
    throw new Error("Inventar konnte nicht geladen werden.");
  }
}
