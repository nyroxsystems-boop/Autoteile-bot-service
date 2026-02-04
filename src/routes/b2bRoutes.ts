// B2B Supplier Routes
// API endpoints for managing suppliers

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
    getSuppliersWithConfigs,
    getSupplierConfig,
    upsertSupplierConfig,
    deleteSupplierConfig
} from '../services/b2bSuppliers/supplierConfigService';
import { getSupplier, getAllSuppliers } from '../services/b2bSuppliers/types';
import { applyMargin } from '../services/b2bSuppliers/marginEngine';

const router = Router();
router.use(authMiddleware);

const requireTenant = (req: Request, res: Response, next: Function) => {
    const tenantId = req.headers['x-tenant-id'] as string || (req as any).user?.merchant_id?.toString();
    if (!tenantId) return res.status(400).json({ error: 'Tenant ID required' });
    req.tenantId = tenantId;
    next();
};
router.use(requireTenant);

// GET /api/b2b/suppliers - List all suppliers with configs
router.get('/suppliers', async (req: Request, res: Response) => {
    try {
        const suppliers = await getSuppliersWithConfigs(req.tenantId!);
        // Mask credentials
        const safe = suppliers.map(s => ({
            ...s,
            config: s.config ? {
                ...s.config,
                credentials: Object.fromEntries(
                    Object.entries(s.config.credentials).map(([k, v]) => [k, v ? '••••••••' : null])
                )
            } : null
        }));
        res.json(safe);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/b2b/suppliers/:key - Get specific supplier
router.get('/suppliers/:key', async (req: Request, res: Response) => {
    try {
        const definition = getSupplier(req.params.key);
        if (!definition) return res.status(404).json({ error: 'Supplier not found' });

        const config = await getSupplierConfig(req.tenantId!, req.params.key);
        res.json({
            ...definition,
            config: config ? {
                ...config,
                credentials: Object.fromEntries(
                    Object.entries(config.credentials).map(([k, v]) => [k, v ? '••••••••' : null])
                )
            } : null,
            isEnabled: config?.enabled || false
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/b2b/suppliers/:key - Update supplier config
router.put('/suppliers/:key', async (req: Request, res: Response) => {
    try {
        const { enabled, credentials, settings } = req.body;
        const config = await upsertSupplierConfig(req.tenantId!, req.params.key, { enabled, credentials, settings });
        res.json({ success: true, config: { ...config, credentials: {} } });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/b2b/suppliers/:key - Reset supplier
router.delete('/suppliers/:key', async (req: Request, res: Response) => {
    try {
        await deleteSupplierConfig(req.tenantId!, req.params.key);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/b2b/calculate-margin - Test margin calculation
router.post('/calculate-margin', async (req: Request, res: Response) => {
    try {
        const { purchasePrice, marginPercent = 15, minMargin = 5 } = req.body;
        const result = applyMargin(purchasePrice, {
            margin_type: 'percentage',
            margin_value: marginPercent,
            minimum_margin: minMargin,
            rounding_strategy: 'up',
            round_to: 0.99
        } as any);
        res.json({
            purchasePrice,
            sellingPrice: result.sellingPrice,
            marginAmount: result.marginAmount,
            marginPercent: result.marginPercent
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
