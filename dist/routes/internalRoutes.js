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
exports.createInternalRouter = createInternalRouter;
const express_1 = require("express");
const productResolutionService_1 = require("../services/intelligence/productResolutionService");
const authMiddleware_1 = require("../middleware/authMiddleware");
function createInternalRouter() {
    const router = (0, express_1.Router)();
    // Protect internal routes (Service Token needed)
    router.use(authMiddleware_1.authMiddleware);
    router.post("/orders/:id/refresh-offers", async (req, res) => {
        const orderId = req.params.id;
        console.log("[InternalAPI] POST /internal/orders/:id/refresh-offers", { orderId });
        try {
            const { offers } = await (0, productResolutionService_1.refreshOffersForOrder)(orderId);
            console.log("[InternalAPI] Offers refreshed for order", orderId, { count: offers.length });
            return res.status(200).json({ success: true, offers });
        }
        catch (err) {
            console.error("[InternalAPI] Failed to refresh offers for order", orderId, err);
            return res.status(500).json({ success: false, error: err?.message || "Unknown error" });
        }
    });
    // Debug Route
    router.get("/ping", (req, res) => {
        res.json({ status: "alive", time: new Date().toISOString() });
    });
    // Seeding Route (Renamed to force update)
    router.post("/seed-db", async (req, res) => {
        console.log("[InternalAPI] POST /internal/seed-db requested");
        try {
            const { runSeeding } = await Promise.resolve().then(() => __importStar(require("../services/core/seedingService")));
            const result = await runSeeding(50);
            return res.status(200).json({ success: true, result });
        }
        catch (err) {
            console.error("[InternalAPI] Seeding failed", err);
            return res.status(500).json({ success: false, error: err?.message });
        }
    });
    return router;
}
exports.default = createInternalRouter;
