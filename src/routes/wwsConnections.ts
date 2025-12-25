import { Router, type Request, type Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { logger } from "../utils/logger";

export function createWwsConnectionsRouter(): Router {
    const router = Router();

    // Apply auth to all WWS connection routes
    router.use(authMiddleware);

    router.get("/", async (_req: Request, res: Response) => {
        try {
            // Return list of WWS connections
            // For now, return mock data - this should be replaced with actual WAWI integration
            const connections = [
                {
                    id: "1",
                    name: "InvenTree",
                    type: "inventree",
                    status: "connected",
                    url: process.env.INVENTREE_API_URL || "http://localhost:8000",
                    lastSync: new Date().toISOString()
                }
            ];
            return res.status(200).json(connections);
        } catch (err: any) {
            logger.error("Error fetching WWS connections", { error: err.message });
            return res.status(500).json({
                error: "Failed to fetch WWS connections",
                details: err.message
            });
        }
    });

    router.post("/", async (req: Request, res: Response) => {
        try {
            const { name, type, url, apiKey } = req.body;

            if (!name || !type || !url) {
                return res.status(400).json({
                    error: "Missing required fields: name, type, url"
                });
            }

            // Create new WWS connection
            // For now, return mock data - this should be replaced with actual WAWI integration
            const connection = {
                id: Date.now().toString(),
                name,
                type,
                url,
                status: "pending",
                createdAt: new Date().toISOString()
            };

            return res.status(201).json(connection);
        } catch (err: any) {
            logger.error("Error creating WWS connection", { error: err.message });
            return res.status(500).json({
                error: "Failed to create WWS connection",
                details: err.message
            });
        }
    });

    router.put("/:id", async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { name, type, url, apiKey } = req.body;

            // Update WWS connection
            // For now, return mock data - this should be replaced with actual WAWI integration
            const connection = {
                id,
                name,
                type,
                url,
                status: "connected",
                updatedAt: new Date().toISOString()
            };

            return res.status(200).json(connection);
        } catch (err: any) {
            logger.error("Error updating WWS connection", { error: err.message, id: req.params.id });
            return res.status(500).json({
                error: "Failed to update WWS connection",
                details: err.message
            });
        }
    });

    router.delete("/:id", async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            // Delete WWS connection
            // For now, just return success - this should be replaced with actual WAWI integration
            return res.status(204).send();
        } catch (err: any) {
            logger.error("Error deleting WWS connection", { error: err.message, id: req.params.id });
            return res.status(500).json({
                error: "Failed to delete WWS connection",
                details: err.message
            });
        }
    });

    router.post("/:id/test", async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { oemNumber } = req.body;

            // Test WWS connection
            // For now, return mock success - this should be replaced with actual WAWI integration
            const result = {
                success: true,
                message: "Connection test successful",
                oemNumber,
                timestamp: new Date().toISOString()
            };

            return res.status(200).json(result);
        } catch (err: any) {
            logger.error("Error testing WWS connection", { error: err.message, id: req.params.id });
            return res.status(500).json({
                error: "Failed to test WWS connection",
                details: err.message
            });
        }
    });

    return router;
}

export default createWwsConnectionsRouter;
