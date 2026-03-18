// Debug Routes for Testing
import { Router, Request, Response } from 'express';
import { logger } from "@utils/logger";
import { getDesignSettings } from '../services/invoicing/designSettingsService';
import { fetchBillingDesign } from '../services/invoicing/billingDesignAdapter';

const router = Router();

/**
 * GET /api/debug/design/:tenantId
 * Test endpoint to check if design settings are being loaded
 */
router.get('/design/:tenantId', async (req: Request, res: Response) => {
    try {
        const tenantId = req.params.tenantId;

        logger.info(`[Debug] Fetching design for tenant: ${tenantId}`);

        // Test direct database query
        const dbSettings = await getDesignSettings(tenantId);
        logger.info(`[Debug] DB Settings:`, dbSettings);

        // Test adapter
        const adapterSettings = await fetchBillingDesign(tenantId);
        logger.info(`[Debug] Adapter Settings:`, adapterSettings);

        res.json({
            tenantId,
            dbSettings,
            adapterSettings,
            match: JSON.stringify(dbSettings) === JSON.stringify(adapterSettings)
        });
    } catch (error: any) {
        logger.error('[Debug] Error:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

export default router;
