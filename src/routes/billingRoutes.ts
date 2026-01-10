import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { logger } from "@utils/logger";

export function createBillingRouter(): Router {
    const router = Router();
    router.use(authMiddleware);

    router.get("/invoices", async (_req: Request, res: Response) => {
        try {
            return res.status(200).json([]);
        } catch (err: any) {
            logger.error("Error fetching invoices", { error: err.message });
            return res.status(500).json({ error: "Failed to fetch invoices" });
        }
    });

    router.get("/invoices/:id", async (req: Request, res: Response) => {
        return res.status(404).json({ error: "Invoice not found" });
    });

    router.get("/invoices/:id/pdf", async (req: Request, res: Response) => {
        return res.status(404).json({ error: "PDF not available" });
    });

    // Design Settings Endpoints
    router.get("/settings/billing/tenant/", async (req: Request, res: Response) => {
        try {
            const tenantId = (req as any).tenantId;
            if (!tenantId) {
                return res.status(400).json({ error: 'Tenant ID required' });
            }

            const { getDesignSettings } = await import('../services/invoicing/designSettingsService');
            const settings = await getDesignSettings(tenantId);

            if (!settings) {
                // Return default settings if not configured
                const defaultSettings = {
                    invoice_color: '#000000',
                    accent_color: '#f3f4f6',
                    invoice_font: 'helvetica',
                    logo_position: 'left',
                    number_position: 'right',
                    address_layout: 'two-column',
                    table_style: 'grid'
                };
                return res.status(200).json(defaultSettings);
            }

            return res.status(200).json(settings);
        } catch (err: any) {
            logger.error("Error fetching billing settings", { error: err.message });
            return res.status(500).json({ error: "Failed to fetch billing settings" });
        }
    });

    router.put("/settings/billing/tenant/", async (req: Request, res: Response) => {
        try {
            const tenantId = (req as any).tenantId;
            if (!tenantId) {
                return res.status(400).json({ error: 'Tenant ID required' });
            }

            const { upsertDesignSettings } = await import('../services/invoicing/designSettingsService');
            const settings = await upsertDesignSettings(tenantId, req.body);

            logger.info("Billing settings updated", { tenantId, settings: req.body });
            return res.status(200).json(settings);
        } catch (err: any) {
            logger.error("Error updating billing settings", { error: err.message });
            return res.status(500).json({ error: "Failed to update billing settings" });
        }
    });

    return router;
}

export default createBillingRouter;
