import { Router, Request, Response } from "express";
import * as wawi from "@adapters/realInvenTreeAdapter";
import { logger } from "@utils/logger";

const router = Router();

/**
 * POST /api/integrations/shop/webhook
 * Receives sales events from external shops (Shopify, WooCommerce, etc.)
 * Payload: { oem: string, sku?: string, quantity: number }
 */
router.post("/shop/webhook", async (req: Request, res: Response) => {
    const { oem, sku, quantity } = req.body;
    const qty = typeof quantity === 'number' ? quantity : 1;
    const tenantId = (req.headers['x-tenant-id'] as string) || "public";

    logger.info(`[ShopWebhook] Received sale event`, { oem, sku, qty, tenantId });

    if (!oem && !sku) {
        return res.status(400).json({ error: "Missing 'oem' or 'sku' in payload" });
    }

    try {
        // 1. Find Part
        // We prioritize OEM search as per Phase 10 spec.
        // Ideally we might search by SKU if provided and OEM fails.
        let part = null;

        // Attempt OEM search
        if (oem) {
            part = await wawi.findPartByOem(tenantId, oem);
        }

        // Fallback? (logic could be enhanced)

        if (!part) {
            logger.warn(`[ShopWebhook] Part not found for OEM: ${oem}`);
            return res.status(404).json({ error: "Part not found in WWS" });
        }

        // 2. Deduct Stock
        const updatedStock = await wawi.deductStock(tenantId, part.pk, qty);

        logger.info(`[ShopWebhook] Stock deducted for Part ${part.pk}. New Qty: Unknown (Transaction based)`);

        return res.status(200).json({
            success: true,
            message: "Stock adjusted",
            partId: part.pk,
            deducted: qty
        });

    } catch (error: any) {
        logger.error(`[ShopWebhook] Error processing webhook: ${error.message}`);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
