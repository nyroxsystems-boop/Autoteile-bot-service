"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabaseService_1 = require("@adapters/supabaseService");
const orderLogicService_1 = require("@core/orderLogicService");
const router = (0, express_1.Router)();
router.post("/:id/auto-select", async (req, res) => {
    const { id } = req.params;
    try {
        console.log("[OrderAutoSelect] triggered", { orderId: id });
        const order = await (0, supabaseService_1.getOrderById)(id);
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }
        const best = await (0, orderLogicService_1.autoSelectOffer)(order.id);
        console.log("[OrderAutoSelect] success", {
            orderId: id,
            recommendedOffer: {
                shopName: best?.shopName ?? best?.shop_name ?? null,
                price: best.price
            }
        });
        res.json({
            success: true,
            recommendedOffer: best
        });
    }
    catch (error) {
        console.error("Error in auto-select:", { orderId: id, error: error?.message ?? String(error) });
        res.status(500).json({
            error: "Auto-select failed",
            details: error.message
        });
    }
});
exports.default = router;
