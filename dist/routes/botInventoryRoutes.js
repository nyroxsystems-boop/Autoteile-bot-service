"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inventoryOrchestratorService_1 = require("../inventory/inventoryOrchestratorService");
const router = (0, express_1.Router)();
router.get("/by-oem/:oemNumber", async (req, res) => {
    const { oemNumber } = req.params;
    try {
        const result = await (0, inventoryOrchestratorService_1.getCombinedAvailabilityByOem)(oemNumber);
        res.json(result);
    }
    catch (error) {
        console.error("Error in GET /api/bot/inventory/by-oem", error);
        res.status(500).json({
            error: "Failed to fetch inventory availability",
            details: error?.message ?? String(error)
        });
    }
});
exports.default = router;
