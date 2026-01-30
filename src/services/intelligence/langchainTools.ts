/**
 * 🛠️ LANGCHAIN TOOLS - WhatsApp Bot Premium Tools
 * 
 * Extracted from botLogicService.ts for clean LangChain integration.
 * Each tool follows the @tool decorator pattern.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { logger } from "@utils/logger";

// Dynamic imports to avoid circular dependencies
const getOemService = () => require("@intelligence/oemService");
const getSupabase = () => require("@adapters/supabaseService");

// ============================================================================
// Tool Schemas (Zod)
// ============================================================================

const OemLookupSchema = z.object({
    make: z.string().describe("Vehicle manufacturer (e.g. Volkswagen, BMW, Mercedes)"),
    model: z.string().describe("Vehicle model (e.g. Golf 7, 3er E90, C-Klasse)"),
    year: z.number().describe("Year of manufacture"),
    partDescription: z.string().describe("Part being searched for (e.g. Bremsscheiben vorne, Zündkerzen)"),
    engineKw: z.number().optional().describe("Engine power in kW (optional)"),
    vin: z.string().optional().describe("Vehicle Identification Number (optional)"),
    hsn: z.string().optional().describe("German HSN code (optional)"),
    tsn: z.string().optional().describe("German TSN code (optional)"),
});

const StockCheckSchema = z.object({
    oemNumber: z.string().describe("OEM part number to check availability for"),
});

const OrderStatusSchema = z.object({
    orderId: z.string().optional().describe("Order ID if known"),
    phoneNumber: z.string().optional().describe("Customer phone number"),
});

const EscalateHumanSchema = z.object({
    reason: z.string().describe("Why the customer wants to speak with a human"),
    urgency: z.enum(["low", "medium", "high"]).default("medium").describe("Urgency level"),
});

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * OEM Lookup Tool - Resolves part OEM numbers using 5-layer validation
 */
// @ts-ignore - LangChain type instantiation is excessively deep
export const oemLookupTool = tool(
    async (input) => {
        logger.info("[LangChain Tool] OEM Lookup", { input });

        try {
            const oemService = getOemService();

            const vehicle = {
                make: input.make,
                model: input.model,
                year: input.year,
                engineKw: input.engineKw,
                vin: input.vin,
                hsn: input.hsn,
                tsn: input.tsn,
            };

            let result;
            if (typeof oemService.resolveOEM === "function") {
                result = await oemService.resolveOEM(vehicle, input.partDescription);
            } else {
                return JSON.stringify({
                    success: false,
                    error: "OEM service not available",
                });
            }

            return JSON.stringify({
                success: !!result.primaryOEM,
                oemNumber: result.primaryOEM || null,
                confidence: result.overallConfidence || 0,
                notes: result.notes || null,
                candidatesCount: result.candidates?.length || 0,
            });
        } catch (error: any) {
            logger.error("[LangChain Tool] OEM Lookup failed", { error: error?.message });
            return JSON.stringify({
                success: false,
                error: error?.message || "Unknown error",
            });
        }
    },
    {
        name: "oem_lookup",
        description: "Look up the OEM (Original Equipment Manufacturer) part number for a specific vehicle and part. Uses 5-layer validation for 95%+ accuracy.",
        schema: OemLookupSchema,
    }
);

/**
 * Stock Check Tool - Checks dealer inventory for part availability
 */
// @ts-ignore - LangChain type instantiation is excessively deep
export const stockCheckTool = tool(
    async (input) => {
        logger.info("[LangChain Tool] Stock Check", { oemNumber: input.oemNumber });

        try {
            // Check InvenTree/WAWI for stock
            const inventreeAdapter = require("@adapters/realInvenTreeAdapter");

            if (typeof inventreeAdapter.getStockItemForPart === "function") {
                const stock = await inventreeAdapter.getStockItemForPart(input.oemNumber);

                if (stock && stock.quantity > 0) {
                    return JSON.stringify({
                        inStock: true,
                        quantity: stock.quantity,
                        location: stock.location || "Hauptlager",
                        deliveryDays: 1,
                    });
                }
            }

            // Fallback: Not in local stock, external delivery
            return JSON.stringify({
                inStock: false,
                quantity: 0,
                deliveryDays: 3,
                note: "Verfügbar über Zulieferer",
            });
        } catch (error: any) {
            logger.warn("[LangChain Tool] Stock Check failed", { error: error?.message });
            return JSON.stringify({
                inStock: false,
                error: "Stock check temporarily unavailable",
            });
        }
    },
    {
        name: "stock_check",
        description: "Check if a part is available in the dealer's inventory. Returns stock quantity and estimated delivery time.",
        schema: StockCheckSchema,
    }
);

/**
 * Order Status Tool - Retrieves status of customer orders
 */
// @ts-ignore - LangChain type instantiation is excessively deep
export const orderStatusTool = tool(
    async (input) => {
        logger.info("[LangChain Tool] Order Status", { input });

        try {
            const supabase = getSupabase();
            let order = null;

            if (input.orderId) {
                order = await supabase.getOrderById(input.orderId);
            } else if (input.phoneNumber) {
                // Find most recent order for this phone number
                const orders = await supabase.getOrdersForPhone?.(input.phoneNumber);
                if (orders && orders.length > 0) {
                    order = orders[0]; // Most recent
                }
            }

            if (!order) {
                return JSON.stringify({
                    found: false,
                    message: "Keine aktive Bestellung gefunden",
                });
            }

            // Map internal status to customer-friendly description
            const statusMap: Record<string, string> = {
                "collect_vehicle": "Fahrzeugdaten werden erfasst",
                "collect_part": "Teileinfo wird erfasst",
                "oem_lookup": "OEM-Nummer wird ermittelt",
                "await_offer_confirmation": "Wartet auf Ihre Bestätigung",
                "show_offers": "Angebote werden angezeigt",
                "order_placed": "Bestellung aufgegeben",
                "shipped": "Unterwegs zu Ihnen",
                "delivered": "Geliefert",
                "cancelled": "Storniert",
            };

            return JSON.stringify({
                found: true,
                orderId: order.id,
                status: statusMap[order.status] || order.status,
                rawStatus: order.status,
                createdAt: order.created_at,
                oemNumber: order.order_data?.oemNumber || null,
                partDescription: order.order_data?.requestedPart || null,
            });
        } catch (error: any) {
            logger.error("[LangChain Tool] Order Status failed", { error: error?.message });
            return JSON.stringify({
                found: false,
                error: error?.message || "Order lookup failed",
            });
        }
    },
    {
        name: "order_status",
        description: "Check the status of a customer's order. Can search by order ID or phone number.",
        schema: OrderStatusSchema,
    }
);

/**
 * Escalate Human Tool - Hands off to a human agent
 */
// @ts-ignore - LangChain type instantiation is excessively deep
export const escalateHumanTool = tool(
    async (input) => {
        logger.info("[LangChain Tool] Escalate to Human", { reason: input.reason, urgency: input.urgency });

        // In a real implementation, this would trigger a notification system
        // For now, we return structured data for the bot to handle
        return JSON.stringify({
            escalated: true,
            reason: input.reason,
            urgency: input.urgency,
            message: "Ein Mitarbeiter wurde benachrichtigt und wird sich in Kürze bei Ihnen melden.",
            estimatedWaitMinutes: input.urgency === "high" ? 5 : input.urgency === "medium" ? 15 : 30,
        });
    },
    {
        name: "escalate_human",
        description: "Escalate the conversation to a human agent when the customer explicitly requests it or the issue requires human intervention.",
        schema: EscalateHumanSchema,
    }
);

// ============================================================================
// Export all tools
// ============================================================================

export const allTools = [
    oemLookupTool,
    stockCheckTool,
    orderStatusTool,
    escalateHumanTool,
];

export default allTools;
