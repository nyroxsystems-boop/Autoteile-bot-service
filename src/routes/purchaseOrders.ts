import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as adapter from '../services/adapters/inventreeAdapter';
import { logger } from '../utils/logger';

const router = Router();

// Apply auth to all purchase order routes
router.use(authMiddleware);

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

// GET /api/purchase-orders - List purchase orders
router.get('/', async (req: any, res) => {
    try {
        const { supplier, status, limit } = req.query;
        const orders = await adapter.getPurchaseOrders(req.tenantId, { supplier, status, limit: limit ? parseInt(limit) : 100 });
        res.json(orders);
    } catch (error: any) {
        logger.error(`Error listing purchase orders for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to list purchase orders", details: error.message });
    }
});

// GET /api/purchase-orders/:id - Get purchase order details
router.get('/:id', async (req: any, res) => {
    try {
        const order = await adapter.getPurchaseOrderById(req.tenantId, req.params.id);
        if (!order) {
            return res.status(404).json({ error: "Purchase order not found" });
        }
        res.json(order);
    } catch (error: any) {
        logger.error(`Error getting purchase order ${req.params.id} for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to get purchase order", details: error.message });
    }
});

// POST /api/purchase-orders - Create purchase order
router.post('/', async (req: any, res) => {
    try {
        const order = await adapter.createPurchaseOrder(req.tenantId, req.body);
        res.status(201).json(order);
    } catch (error: any) {
        logger.error(`Error creating purchase order for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to create purchase order", details: error.message });
    }
});

// PATCH /api/purchase-orders/:id - Update purchase order
router.patch('/:id', async (req: any, res) => {
    try {
        const order = await adapter.updatePurchaseOrder(req.tenantId, req.params.id, req.body);
        res.json(order);
    } catch (error: any) {
        logger.error(`Error updating purchase order ${req.params.id} for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to update purchase order", details: error.message });
    }
});

// DELETE /api/purchase-orders/:id - Cancel/Delete purchase order
router.delete('/:id', async (req: any, res) => {
    try {
        await adapter.cancelPurchaseOrder(req.tenantId, req.params.id);
        res.status(204).send();
    } catch (error: any) {
        logger.error(`Error cancelling purchase order ${req.params.id} for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to cancel purchase order", details: error.message });
    }
});

// POST /api/purchase-orders/:id/receive - Receive goods from PO
router.post('/:id/receive', async (req: any, res) => {
    try {
        const result = await adapter.receivePurchaseOrder(req.tenantId, req.params.id, req.body);
        res.status(201).json(result);
    } catch (error: any) {
        logger.error(`Error receiving purchase order ${req.params.id} for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to receive purchase order", details: error.message });
    }
});

// GET /api/purchase-orders/suggestions/reorder - Get reorder suggestions
router.get('/suggestions/reorder', async (req: any, res) => {
    try {
        const suggestions = await adapter.getReorderSuggestions(req.tenantId);
        res.json(suggestions);
    } catch (error: any) {
        logger.error(`Error getting reorder suggestions for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to get reorder suggestions", details: error.message });
    }
});

export default router;
