"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistOemMetadata = persistOemMetadata;
exports.updateOrderScrapeTask = updateOrderScrapeTask;
exports.getSupabaseClient = getSupabaseClient;
// Lightweight compatibility wrapper: we no longer use Supabase.
// Re-export the WAWI adapter functions so existing imports continue to work.
// Re-export the WAWI adapter functions so existing imports continue to work.
// NOW USING: Real InvenTree Adapter (Hybrid SQLite + API Sync)
__exportStar(require("./realInvenTreeAdapter"), exports);
// Provide a couple of no-op compatibility shims for functions that older code
// expects from the Supabase wrapper but which are not part of the WAWI adapter.
async function persistOemMetadata(orderId, meta) {
    // intentionally a no-op for local/testing environment
    return;
}
async function updateOrderScrapeTask(orderId, payload) {
    // intentionally a no-op for local/testing environment
    return;
}
// Keep a compatibility stub for callers that expect a client getter.
function getSupabaseClient() {
    throw new Error("Supabase client has been removed. Use the WAWI adapter or provide a test mock.");
}
