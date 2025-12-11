import { getAllProviders } from "./providerRegistry";
import { NormalizedInventoryResult } from "./providers/baseInventoryProvider";

export async function getCombinedAvailabilityByOem(oemNumber: string): Promise<{
  oemNumber: string;
  results: NormalizedInventoryResult[];
}> {
  const providers = getAllProviders();

  const providerResults = await Promise.all(
    providers.map(async (provider) => {
      try {
        const items = await provider.checkAvailabilityByOem(oemNumber);
        return items || [];
      } catch (err: any) {
        console.error("[InventoryOrchestrator] Provider failed", provider.constructor.name, err?.message);
        return [];
      }
    })
  );

  const flat = providerResults.reduce<NormalizedInventoryResult[]>((acc, arr) => acc.concat(arr), []);

  return {
    oemNumber,
    results: flat
  };
}
