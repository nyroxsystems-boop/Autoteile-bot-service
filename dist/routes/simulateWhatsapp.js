"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabaseService_1 = require("../services/supabaseService");
const router = (0, express_1.Router)();
/**
 * POST /simulate/whatsapp
 *
 * Simuliert eine eingehende WhatsApp-Nachricht und legt:
 * 1) eine Order an
 * 2) eine Message in der messages-Tabelle an
 *
 * Erwarteter Request-Body (JSON):
 * {
 *   "from": "whatsapp:+49123456789",   // Pflicht
 *   "text": "Bremssattel vorne links", // Pflicht
 *   "customerName": "Max Mustermann"   // optional
 * }
 */
router.post("/", async (req, res) => {
    const { from, text, customerName } = req.body ?? {};
    if (!from || typeof from !== "string") {
        return res.status(400).json({
            error: '"from" is required and must be a string, e.g. "whatsapp:+49123456789"'
        });
    }
    if (!text || typeof text !== "string") {
        return res.status(400).json({
            error: '"text" is required and must be a string, e.g. "Bremssattel vorne links"'
        });
    }
    try {
        // 1) Order anlegen
        const order = await (0, supabaseService_1.insertOrder)({
            customerName: customerName ?? null,
            customerContact: from,
            requestedPartName: text,
            vehicleId: null
        });
        // 2) Message speichern (eingehende WhatsApp-Nachricht)
        const message = await (0, supabaseService_1.insertMessage)(from, text, "IN");
        return res.status(201).json({
            message: "Simulated WhatsApp message processed. Order and message created.",
            order,
            chatMessage: message
        });
    }
    catch (error) {
        console.error("Error in POST /simulate/whatsapp:", error);
        return res.status(500).json({
            error: "Failed to process simulated WhatsApp message",
            details: error?.message ?? String(error)
        });
    }
});
exports.default = router;
