import { Router, type Request, type Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import * as wawi from "../services/inventreeAdapter";
import { logger } from "../utils/logger";

export function createSuppliersRouter(): Router {
    const router = Router();

    // Apply auth to all supplier routes
    router.use(authMiddleware);

    router.get("/", async (_req: Request, res: Response) => {
        try {
            // Get suppliers from WAWI system
            const suppliers = await wawi.listSuppliers();
            return res.status(200).json(suppliers);
        } catch (err: any) {
            logger.error("Error fetching suppliers", { error: err.message });
            return res.status(500).json({
                error: "Failed to fetch suppliers",
                details: err.message
            });
        }
    });

    router.get("/:id", async (req: Request, res: Response) => {
        try {
            const supplier = await wawi.getSupplierById(req.params.id);
            if (!supplier) {
                return res.status(404).json({ error: "Supplier not found" });
            }
            return res.status(200).json(supplier);
        } catch (err: any) {
            logger.error("Error fetching supplier", { error: err.message, id: req.params.id });
            return res.status(500).json({
                error: "Failed to fetch supplier",
                details: err.message
            });
        }
    });

    return router;
}

export default createSuppliersRouter;
