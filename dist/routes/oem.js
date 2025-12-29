"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const oemService_1 = require("../services/oemService");
const supabaseService_1 = require("../services/supabaseService");
const router = (0, express_1.Router)();
/**
 * POST /api/oem/resolve
 * Erwartet:
 * {
 *   "orderId": "...",
 *   "vehicle": {...},
 *   "part": "Bremssattel"
 * }
 */
router.post("/resolve", async (req, res) => {
    const { orderId, vehicle, part } = req.body ?? {};
    if (!orderId || !part) {
        return res.status(400).json({ error: "orderId and part required" });
    }
    const order = await (0, supabaseService_1.getOrderById)(orderId);
    if (!order) {
        return res.status(404).json({ error: "Order not found" });
    }
    const result = await (0, oemService_1.resolveOEM)(vehicle ?? {}, part);
    if (!result.success) {
        await (0, supabaseService_1.updateOrderOEM)(orderId, {
            oemStatus: "failed",
            oemError: result.message,
            oemData: { requiredFields: result.requiredFields }
        });
        return res.json({
            success: false,
            message: result.message,
            requiredFields: result.requiredFields
        });
    }
    // OEM erfolgreich
    await (0, supabaseService_1.updateOrderOEM)(orderId, {
        oemStatus: "resolved",
        oemData: { oem: result.oemNumber }
    });
    res.json({
        success: true,
        oem: result.oemNumber
    });
});
exports.default = router;
