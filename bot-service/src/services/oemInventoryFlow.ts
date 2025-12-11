import {
  CombinedInventoryResponse,
  InventoryResult,
  fetchInventoryByOem
} from "../clients/inventoryClient";

export interface RankedInventoryEntry {
  rank: number;
  systemId: string;
  systemName: string;
  providerType: string;
  oemNumber: string;
  internalSku?: string | null;
  title?: string | null;
  brand?: string | null;
  model?: string | null;
  price?: number | null;
  currency?: string | null;
  availableQuantity?: number | null;
  deliveryTime?: string | null;
}

function getSortWeight(result: InventoryResult): number {
  // Niedriger Wert = höhere Priorität
  let base = 0;
  switch (result.providerType) {
    case "demo_wws":
      base = 0;
      break;
    case "http_api":
      base = 10;
      break;
    case "scraper":
      base = 20;
      break;
    default:
      base = 30;
  }

  const price = result.price ?? 999999;
  const lackOfStockPenalty = (result.availableQuantity ?? 0) > 0 ? 0 : 5; // Eintrag ohne Bestand minimal schlechter

  return base * 1000000 + lackOfStockPenalty * 10000 + price;
}

export async function getRankedInventoryForOem(
  oemNumber: string
): Promise<{ oemNumber: string; entries: RankedInventoryEntry[] }> {
  const combined: CombinedInventoryResponse = await fetchInventoryByOem(oemNumber);
  const sorted = [...(combined.results || [])].sort((a, b) => getSortWeight(a) - getSortWeight(b));

  const entries: RankedInventoryEntry[] = sorted.map((item, idx) => ({
    rank: idx + 1,
    systemId: item.systemId,
    systemName: item.systemName,
    providerType: item.providerType,
    oemNumber: item.oemNumber,
    internalSku: item.internalSku ?? null,
    title: item.title ?? null,
    brand: item.brand ?? null,
    model: item.model ?? null,
    price: item.price ?? null,
    currency: item.currency ?? null,
    availableQuantity: item.availableQuantity ?? null,
    deliveryTime: item.deliveryTime ?? null
  }));

  return { oemNumber, entries };
}
