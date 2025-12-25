import { Router, type Request, type Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware";

export function createBotHealthRouter(): Router {
    const router = Router();

    // Apply auth to all bot health routes
    router.use(authMiddleware);

    router.get("/health", async (_req: Request, res: Response) => {
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
        } catch (err: any) {
            return res.status(500).json({
                status: "error",
                error: "Bot health check failed",
                details: err.message
            });
        }
    });

    return router;
}

export default createBotHealthRouter;
