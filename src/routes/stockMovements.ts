import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as adapter from '../services/adapters/inventreeAdapter';
import { logger } from '../utils/logger';

const router = Router();

// Apply auth to all stock movement routes
router.use(authMiddleware);

// Middleware: Extract Tenant ID (from header or authenticated user)
const requireTenant = (req: any, res: any, next: any) => {
    // Try header first
    const tenantId = req.headers['x-tenant-id'];
    if (tenantId) {
        req.tenantId = tenantId.toString();
        return next();
    }

    // Fallback to user's merchant_id from auth session
    if (req.user?.merchant_id) {
        req.tenantId = req.user.merchant_id.toString();
        return next();
    }

    return res.status(400).json({ error: "Missing X-Tenant-ID header or user not authenticated with tenant" });
};

router.use(requireTenant);

// GET /api/stock/movements - List stock movements
router.get('/movements', async (req: any, res) => {
    try {
        const { part_id, type, limit } = req.query;
        const movements = await adapter.getStockMovements(req.tenantId, { part_id, type, limit: limit ? parseInt(limit) : 100 });
        res.json(movements);
    } catch (error: any) {
        logger.error(`Error listing stock movements for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to list stock movements", details: error.message });
    }
});

// POST /api/stock/movements - Create stock movement
router.post('/movements', async (req: any, res) => {
    try {
        const movement = await adapter.createStockMovement(req.tenantId, req.body);
        res.status(201).json(movement);
    } catch (error: any) {
        logger.error(`Error creating stock movement for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to create stock movement", details: error.message });
    }
});

// POST /api/stock/goods-receipt - Receive goods from purchase order
router.post('/goods-receipt', async (req: any, res) => {
    try {
        const result = await adapter.receiveGoods(req.tenantId, req.body);
        res.status(201).json(result);
    } catch (error: any) {
        logger.error(`Error receiving goods for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to receive goods", details: error.message });
    }
});

// GET /api/stock/locations - List warehouse locations
router.get('/locations', async (req: any, res) => {
    try {
        const locations = await adapter.getStockLocations(req.tenantId);
        res.json(locations);
    } catch (error: any) {
        logger.error(`Error listing stock locations for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to list stock locations", details: error.message });
    }
});

export default router;
