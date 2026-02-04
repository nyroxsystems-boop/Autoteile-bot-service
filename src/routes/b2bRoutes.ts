// B2B Supplier Routes
// API endpoints for managing B2B supplier configurations

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
    getSupplierConfigs,
    getSupplierConfig,
    upsertSupplierConfig,
    deleteSupplierConfig,
    getAvailableSuppliers
} from '../services/b2bSuppliers/supplierConfigService';
import { applyMargin, getPriceTierInfo } from '../services/b2bSuppliers/marginEngine';
import type { B2BSupplierName } from '../services/b2bSuppliers/types';

const router = Router();

// Apply auth to all routes
router.use(authMiddleware);

// Middleware to extract tenant ID
const requireTenant = (req: Request, res: Response, next: Function) => {
    const tenantId = req.headers['x-tenant-id'] as string || (req as any).user?.merchant_id?.toString();
    if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
    }
    req.tenantId = tenantId;
    next();
};

router.use(requireTenant);

/**
 * GET /api/b2b/suppliers
 * List all available suppliers with their configs
 */
router.get('/suppliers', async (req: Request, res: Response) => {
    try {
        const available = getAvailableSuppliers();
        const configs = await getSupplierConfigs(req.tenantId!);

        // Merge available suppliers with their configs
        const suppliers = available.map(supplier => {
            const config = configs.find(c => c.supplier_name === supplier.name);
            return {
                ...supplier,
                config: config ? {
                    enabled: config.enabled,
                    price_tier: config.price_tier,
                    margin_type: config.margin_type,
                    margin_value: config.margin_value,
                    minimum_margin: config.minimum_margin,
                    rounding_strategy: config.rounding_strategy,
                    round_to: config.round_to,
                    priority: config.priority,
                    hasCredentials: !!(config.api_key || config.username)
                } : null
            };
        });

        res.json(suppliers);
    } catch (error: any) {
        console.error('[B2B] Error fetching suppliers:', error);
        res.status(500).json({ error: 'Failed to fetch suppliers', message: error.message });
    }
});

/**
 * GET /api/b2b/suppliers/:name
 * Get specific supplier config
 */
router.get('/suppliers/:name', async (req: Request, res: Response) => {
    try {
        const supplierName = req.params.name as B2BSupplierName;
        const config = await getSupplierConfig(req.tenantId!, supplierName);

        if (!config) {
            return res.status(404).json({ error: 'Supplier config not found' });
        }

        // Don't expose sensitive credentials
        const safeConfig = {
            ...config,
            api_key: config.api_key ? '***configured***' : null,
            api_secret: config.api_secret ? '***configured***' : null
        };

        res.json(safeConfig);
    } catch (error: any) {
        console.error('[B2B] Error fetching supplier config:', error);
        res.status(500).json({ error: 'Failed to fetch supplier config', message: error.message });
    }
});

/**
 * PUT /api/b2b/suppliers/:name
 * Update supplier config
 */
router.put('/suppliers/:name', async (req: Request, res: Response) => {
    try {
        const supplierName = req.params.name as B2BSupplierName;
        const validSuppliers: B2BSupplierName[] = ['inter_cars', 'moto_profil', 'auto_partner', 'gordon'];

        if (!validSuppliers.includes(supplierName)) {
            return res.status(400).json({ error: 'Invalid supplier name' });
        }

        const config = await upsertSupplierConfig(req.tenantId!, supplierName, req.body);

        // Don't expose sensitive credentials
        const safeConfig = {
            ...config,
            api_key: config.api_key ? '***configured***' : null,
            api_secret: config.api_secret ? '***configured***' : null
        };

        res.json(safeConfig);
    } catch (error: any) {
        console.error('[B2B] Error updating supplier config:', error);
        res.status(500).json({ error: 'Failed to update supplier config', message: error.message });
    }
});

/**
 * DELETE /api/b2b/suppliers/:name
 * Delete supplier config (resets to default)
 */
router.delete('/suppliers/:name', async (req: Request, res: Response) => {
    try {
        const supplierName = req.params.name as B2BSupplierName;
        await deleteSupplierConfig(req.tenantId!, supplierName);
        res.json({ success: true, message: 'Supplier config reset to default' });
    } catch (error: any) {
        console.error('[B2B] Error deleting supplier config:', error);
        res.status(500).json({ error: 'Failed to delete supplier config', message: error.message });
    }
});

/**
 * POST /api/b2b/calculate-margin
 * Calculate selling price from purchase price
 */
router.post('/calculate-margin', async (req: Request, res: Response) => {
    try {
        const { purchasePrice, supplierName } = req.body;

        if (!purchasePrice || !supplierName) {
            return res.status(400).json({ error: 'purchasePrice and supplierName required' });
        }

        const config = await getSupplierConfig(req.tenantId!, supplierName);
        if (!config) {
            return res.status(404).json({ error: 'Supplier config not found' });
        }

        const result = applyMargin(purchasePrice, config);
        res.json({
            purchasePrice,
            ...result,
            formatted: {
                purchase: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(purchasePrice),
                selling: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(result.sellingPrice),
                margin: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(result.marginAmount)
            }
        });
    } catch (error: any) {
        console.error('[B2B] Error calculating margin:', error);
        res.status(500).json({ error: 'Failed to calculate margin', message: error.message });
    }
});

/**
 * GET /api/b2b/price-tiers
 * Get available price tier info
 */
router.get('/price-tiers', (req: Request, res: Response) => {
    const tiers = ['basic', 'silver', 'gold', 'platinum'].map(tier => ({
        id: tier,
        ...getPriceTierInfo(tier)
    }));
    res.json(tiers);
});

export default router;
