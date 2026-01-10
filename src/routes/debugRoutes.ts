// Debug Routes for Testing
import { Router, Request, Response } from 'express';
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

        console.log(`[Debug] Fetching design for tenant: ${tenantId}`);

        // Test direct database query
        const dbSettings = await getDesignSettings(tenantId);
        console.log(`[Debug] DB Settings:`, dbSettings);

        // Test adapter
        const adapterSettings = await fetchBillingDesign(tenantId);
        console.log(`[Debug] Adapter Settings:`, adapterSettings);

        res.json({
            tenantId,
            dbSettings,
            adapterSettings,
            match: JSON.stringify(dbSettings) === JSON.stringify(adapterSettings)
        });
    } catch (error: any) {
        console.error('[Debug] Error:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
});

export default router;
