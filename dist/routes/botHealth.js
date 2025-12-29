"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBotHealthRouter = createBotHealthRouter;
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
function createBotHealthRouter() {
    const router = (0, express_1.Router)();
    // Apply auth to all bot health routes
    router.use(authMiddleware_1.authMiddleware);
    router.get("/health", async (_req, res) => {
        try {
            // Check if bot service is running and healthy
            const health = {
                status: "ok",
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                service: "bot-service",
                version: "1.0.0"
            };
            return res.status(200).json(health);
        }
        catch (err) {
            return res.status(500).json({
                status: "error",
                error: "Bot health check failed",
                details: err.message
            });
        }
    });
    return router;
}
exports.default = createBotHealthRouter;
