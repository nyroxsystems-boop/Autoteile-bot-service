"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabaseService_1 = require("../services/supabaseService");
const scrapingService_1 = require("../services/scrapingService");
const router = (0, express_1.Router)();
/**
 * POST /api/orders/:id/scrape-offers
 *
 * Erwartet optional im Body:
 * {
 *   "oem": "OEM-NUMMER"
 * }
 *
 * Wenn keine OEM im Body angegeben ist, versucht die Route:
 * - oem aus order.oemNumber oder order.oem_data.oem zu lesen.
 */
router.post("/:id/scrape-offers", async (req, res) => {
    const { id } = req.params;
    const { oem } = req.body ?? {};
    try {
        console.log("[OrderScraping] scrape-offers triggered", { orderId: id, bodyOem: oem });
        const order = await (0, supabaseService_1.getOrderById)(id);
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }
        let oemNumber = null;
        if (typeof oem === "string" && oem.trim().length > 0) {
            oemNumber = oem.trim();
        }
        else {
            // Versuche aus der Order zu lesen; oem_data ist aktuell ein beliebiges JSON-Feld
            const anyOrder = order;
            if (order.oemNumber) {
                oemNumber = order.oemNumber;
            }
            else if (anyOrder.oem_data && anyOrder.oem_data.oem) {
                oemNumber = anyOrder.oem_data.oem;
            }
        }
        if (!oemNumber) {
            console.log("[OrderScraping] no OEM available", { orderId: id });
            return res.status(400).json({
                error: "No OEM number provided and none found on order."
            });
        }
        console.log("[OrderScraping] using OEM", { orderId: id, oemNumber });
        const offers = await (0, scrapingService_1.scrapeOffersForOrder)(order.id, oemNumber);
        console.log("[OrderScraping] scraping completed", {
            orderId: id,
            oemNumber,
            offersCount: offers?.length ?? 0
        });
        res.json({
            orderId: order.id,
            oemNumber,
            offers
        });
    }
    catch (error) {
        console.error(`Error in POST /api/orders/${req.params.id}/scrape-offers:`, {
            orderId: id,
            error: error?.message ?? String(error)
        });
        res.status(500).json({
            error: "Failed to scrape offers",
            details: error?.message ?? String(error)
        });
    }
});
exports.default = router;
