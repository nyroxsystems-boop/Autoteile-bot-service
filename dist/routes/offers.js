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
exports.createOffersRouter = createOffersRouter;
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const wawi = __importStar(require("../services/inventreeAdapter"));
const dashboardMappers_1 = require("../mappers/dashboardMappers");
const logger_1 = require("../utils/logger");
function createOffersRouter() {
    const router = (0, express_1.Router)();
    // Apply auth to all offer routes
    router.use(authMiddleware_1.authMiddleware);
    router.get("/", async (_req, res) => {
        try {
            // Get all offers from WAWI system
            const offers = await wawi.listOffers();
            const mapped = offers.map(dashboardMappers_1.mapOfferRowToDashboardShopOffer);
            return res.status(200).json(mapped);
        }
        catch (err) {
            logger_1.logger.error("Error fetching offers", { error: err.message });
            return res.status(500).json({
                error: "Failed to fetch offers",
                details: err.message
            });
        }
    });
    router.get("/:id", async (req, res) => {
        try {
            const offer = await wawi.getOfferById(req.params.id);
            if (!offer) {
                return res.status(404).json({ error: "Offer not found" });
            }
            const mapped = (0, dashboardMappers_1.mapOfferRowToDashboardShopOffer)(offer);
            return res.status(200).json(mapped);
        }
        catch (err) {
            logger_1.logger.error("Error fetching offer", { error: err.message, id: req.params.id });
            return res.status(500).json({
                error: "Failed to fetch offer",
                details: err.message
            });
        }
    });
    return router;
}
exports.default = createOffersRouter;
