
import { Router } from 'express';
import * as adapter from '../services/inventreeAdapter';
import { logger } from '../utils/logger';

const router = Router();

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

// GET /products - List Products (Isolated)
router.get('/', async (req: any, res) => {
    try {
        const products = await adapter.getParts(req.tenantId, req.query);
        res.json(products);
    } catch (error: any) {
        logger.error(`Error listing products for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to list products" });
    }
});

// POST /products - Create Product (Isolated)
router.post('/', async (req: any, res) => {
    try {
        const product = await adapter.createPart(req.tenantId, req.body);
        res.status(201).json(product);
    } catch (error: any) {
        logger.error(`Error creating product for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to create product" });
    }
});

// GET /products/:id - Get Detail (Secure)
router.get('/:id', async (req: any, res) => {
    try {
        const product = await adapter.getPartById(req.tenantId, req.params.id);
        res.json(product);
    } catch (error: any) {
        if (error.message.includes("Access Denied")) {
            return res.status(403).json({ error: "Access Denied" });
        }
        res.status(404).json({ error: "Product not found" });
    }
});

// PATCH /products/:id - Update Product (Secure)
router.patch('/:id', async (req: any, res) => {
    try {
        const product = await adapter.updatePart(req.tenantId, req.params.id, req.body);
        res.json(product);
    } catch (error: any) {
        if (error.message.includes("Access Denied")) {
            return res.status(403).json({ error: "Access Denied" });
        }
        res.status(500).json({ error: "Failed to update product" });
    }
});

// POST /products/:id/stock - Adjust Stock (WWS)
router.post('/:id/stock', async (req: any, res) => {
    const { action, quantity } = req.body;
    if (!['add', 'remove', 'count'].includes(action) || typeof quantity !== 'number') {
        return res.status(400).json({ error: "Invalid action or quantity" });
    }

    try {
        const result = await adapter.processStockAction(req.tenantId, req.params.id, action, quantity);
        res.json(result);
    } catch (error: any) {
        logger.error(`Stock update failed for ${req.params.id}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

export default router;
