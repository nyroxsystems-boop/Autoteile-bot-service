"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabaseService_1 = require("@adapters/supabaseService");
const orderLogicService_1 = require("@core/orderLogicService");
const router = (0, express_1.Router)();
router.post("/:id/auto-order", async (req, res) => {
    const { id } = req.params;
    try {
        console.log("[OrderAutoOrder] triggered", { orderId: id });
        const order = await (0, supabaseService_1.getOrderById)(id);
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }
        // Angebote laden
        const offers = await (0, supabaseService_1.listShopOffersByOrderId)(order.id);
        console.log("[OrderAutoOrder] offers loaded", { orderId: id, offersCount: offers.length });
        if (offers.length === 0) {
            return res.status(400).json({ error: "No offers available" });
        }
        const best = (0, orderLogicService_1.selectBestOffer)(offers);
        if (!best) {
            return res.status(400).json({ error: "Could not determine best offer" });
        }
        console.log("[OrderAutoOrder] selecting offer", {
            orderId: id,
            offer: {
                shopName: best?.shopName ?? best?.shop_name ?? null,
                price: best.price
            }
        });
        const result = await (0, orderLogicService_1.autoOrder)(order.id, best);
        console.log("[OrderAutoOrder] success", {
            orderId: id,
            confirmation: result.confirmation,
            status: "ordered"
        });
        res.json({
            success: true,
            confirmation: result.confirmation,
            orderedFrom: result.orderedFrom,
            price: result.price
        });
    }
    catch (error) {
        console.error("Error in auto-order:", { orderId: id, error: error?.message ?? String(error) });
        res.status(500).json({
            error: "Auto-order failed",
            details: error.message
        });
    }
});
exports.default = router;
