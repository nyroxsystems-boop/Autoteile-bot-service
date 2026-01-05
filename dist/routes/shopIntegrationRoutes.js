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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wawi = __importStar(require("@adapters/realInvenTreeAdapter"));
const logger_1 = require("@utils/logger");
const router = (0, express_1.Router)();
/**
 * POST /api/integrations/shop/webhook
 * Receives sales events from external shops (Shopify, WooCommerce, etc.)
 * Payload: { oem: string, sku?: string, quantity: number }
 */
router.post("/shop/webhook", async (req, res) => {
    const { oem, sku, quantity } = req.body;
    const qty = typeof quantity === 'number' ? quantity : 1;
    const tenantId = req.headers['x-tenant-id'] || "public";
    logger_1.logger.info(`[ShopWebhook] Received sale event`, { oem, sku, qty, tenantId });
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
            logger_1.logger.warn(`[ShopWebhook] Part not found for OEM: ${oem}`);
            return res.status(404).json({ error: "Part not found in WWS" });
        }
        // 2. Deduct Stock
        const updatedStock = await wawi.deductStock(tenantId, part.pk, qty);
        logger_1.logger.info(`[ShopWebhook] Stock deducted for Part ${part.pk}. New Qty: Unknown (Transaction based)`);
        return res.status(200).json({
            success: true,
            message: "Stock adjusted",
            partId: part.pk,
            deducted: qty
        });
    }
    catch (error) {
        logger_1.logger.error(`[ShopWebhook] Error processing webhook: ${error.message}`);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});
exports.default = router;
