import { Router, type Request, type Response } from "express";
// import { authMiddleware } from "../middleware/authMiddleware"; // TEMP DISABLED FOR TESTING
import * as wawi from "@adapters/inventreeAdapter";
import { logger } from "@utils/logger";

export function createSuppliersRouter(): Router {
    const router = Router();

    // Apply auth to all supplier routes
    // router.use(authMiddleware); // TEMP DISABLED FOR TESTING

    // Middleware: Extract Tenant ID
    const requireTenant = (req: any, res: any, next: any) => {
        const tenantId = req.headers['x-tenant-id'];
        if (!tenantId) {
            return res.status(400).json({ error: "Missing X-Tenant-ID header" });
        }
        req.tenantId = tenantId.toString();
        next();
    };

    router.use(requireTenant);

    // GET /api/suppliers - List suppliers
    router.get("/", async (req: any, res: Response) => {
        try {
            const suppliers = await wawi.listSuppliers(req.tenantId, req.query);
            return res.status(200).json(suppliers);
        } catch (err: any) {
            logger.error("Error fetching suppliers", { error: err.message, tenant: req.tenantId });
            return res.status(500).json({
                error: "Failed to fetch suppliers",
                details: err.message
            });
        }
    });

    // GET /api/suppliers/:id - Get supplier by ID
    router.get("/:id", async (req: any, res: Response) => {
        try {
            const supplier = await wawi.getSupplierById(req.tenantId, req.params.id);
            if (!supplier) {
                return res.status(404).json({ error: "Supplier not found" });
            }
            return res.status(200).json(supplier);
        } catch (err: any) {
            logger.error("Error fetching supplier", { error: err.message, id: req.params.id, tenant: req.tenantId });
            return res.status(500).json({
                error: "Failed to fetch supplier",
                details: err.message
            });
        }
    });

    // POST /api/suppliers - Create supplier
    router.post("/", async (req: any, res: Response) => {
        try {
            const supplier = await wawi.createSupplier(req.tenantId, req.body);
            return res.status(201).json(supplier);
        } catch (err: any) {
            logger.error("Error creating supplier", { error: err.message, tenant: req.tenantId });
            return res.status(500).json({
                error: "Failed to create supplier",
                details: err.message
            });
        }
    });

    // PATCH /api/suppliers/:id - Update supplier
    router.patch("/:id", async (req: any, res: Response) => {
        try {
            const supplier = await wawi.updateSupplier(req.tenantId, req.params.id, req.body);
            return res.status(200).json(supplier);
        } catch (err: any) {
            logger.error("Error updating supplier", { error: err.message, id: req.params.id, tenant: req.tenantId });
            return res.status(500).json({
                error: "Failed to update supplier",
                details: err.message
            });
        }
    });

    // DELETE /api/suppliers/:id - Delete supplier
    router.delete("/:id", async (req: any, res: Response) => {
        try {
            await wawi.deleteSupplier(req.tenantId, req.params.id);
            return res.status(204).send();
        } catch (err: any) {
            logger.error("Error deleting supplier", { error: err.message, id: req.params.id, tenant: req.tenantId });
            return res.status(500).json({
                error: "Failed to delete supplier",
                details: err.message
            });
        }
    });

    return router;
}

export default createSuppliersRouter;
