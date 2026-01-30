/**
 * 🗄️ Database Adapter - Unified Data Access Layer
 * 
 * This module provides a unified interface for data persistence.
 * Currently uses InvenTree adapter with PostgreSQL backend.
 * 
 * ARCHITECTURE:
 * - Core CRUD operations via realInvenTreeAdapter
 * - Conversation status types via wawiAdapter
 * - No Supabase dependency (legacy name kept for compatibility)
 */

// Re-export all database functions from the InvenTree adapter
export * from "./realInvenTreeAdapter";

// Re-export conversation status type
export { ConversationStatus } from "./wawiAdapter";

// ============================================================================
// COMPATIBILITY LAYER
// ============================================================================

/**
 * Persist OEM metadata for an order.
 * @param orderId - The order ID
 * @param meta - OEM metadata object
 * @deprecated Use updateOrderData() instead for full control
 */
export async function persistOemMetadata(orderId: string, meta: Record<string, unknown>): Promise<void> {
  // Forward to updateOrderData if available, otherwise no-op
  try {
    const { updateOrderData } = await import("./realInvenTreeAdapter");
    await updateOrderData(orderId, { oem_metadata: meta });
  } catch {
    // Silent fallback for testing environments
  }
}

/**
 * Update scrape task data for an order.
 * @param orderId - The order ID  
 * @param payload - Scrape task payload
 * @deprecated Use updateOrderData() instead for full control
 */
export async function updateOrderScrapeTask(orderId: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const { updateOrderData } = await import("./realInvenTreeAdapter");
    await updateOrderData(orderId, { scrape_task: payload });
  } catch {
    // Silent fallback for testing environments
  }
}

/**
 * @deprecated Supabase has been removed. Use specific adapter functions instead.
 * @throws Always throws - this function should not be called
 */
export function getSupabaseClient(): never {
  throw new Error(
    "Supabase client has been removed. " +
    "Use the specific adapter functions (findOrCreateOrder, updateOrder, etc.) instead."
  );
}
