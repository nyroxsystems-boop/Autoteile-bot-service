// Lightweight compatibility wrapper: we no longer use Supabase.
// Re-export the WAWI adapter functions so existing imports continue to work.
// Re-export the WAWI adapter functions so existing imports continue to work.
// NOW USING: Real InvenTree Adapter (Hybrid SQLite + API Sync)
export * from "./realInvenTreeAdapter";
export { ConversationStatus } from "./wawiAdapter";

// Provide a couple of no-op compatibility shims for functions that older code
// expects from the Supabase wrapper but which are not part of the WAWI adapter.
export async function persistOemMetadata(orderId: string, meta: any): Promise<void> {
  // intentionally a no-op for local/testing environment
  return;
}

export async function updateOrderScrapeTask(orderId: string, payload: any): Promise<void> {
  // intentionally a no-op for local/testing environment
  return;
}

// Keep a compatibility stub for callers that expect a client getter.
export function getSupabaseClient(): never {
  throw new Error("Supabase client has been removed. Use the WAWI adapter or provide a test mock.");
}
