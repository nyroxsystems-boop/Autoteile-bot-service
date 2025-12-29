"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adapter = __importStar(require("../services/inventreeAdapter"));
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Middleware: Extract Tenant ID
const requireTenant = (req, res, next) => {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
        return res.status(400).json({ error: "Missing X-Tenant-ID header" });
    }
    req.tenantId = tenantId.toString();
    next();
};
router.use(requireTenant);
// GET /products - List Products (Isolated)
router.get('/', async (req, res) => {
    try {
        const products = await adapter.getParts(req.tenantId, req.query);
        res.json(products);
    }
    catch (error) {
        logger_1.logger.error(`Error listing products for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to list products" });
    }
});
// POST /products - Create Product (Isolated)
router.post('/', async (req, res) => {
    try {
        const product = await adapter.createPart(req.tenantId, req.body);
        res.status(201).json(product);
    }
    catch (error) {
        logger_1.logger.error(`Error creating product for tenant ${req.tenantId}: ${error.message}`);
        res.status(500).json({ error: "Failed to create product" });
    }
});
// GET /products/:id - Get Detail (Secure)
router.get('/:id', async (req, res) => {
    try {
        const product = await adapter.getPartById(req.tenantId, req.params.id);
        res.json(product);
    }
    catch (error) {
        if (error.message.includes("Access Denied")) {
            return res.status(403).json({ error: "Access Denied" });
        }
        res.status(404).json({ error: "Product not found" });
    }
});
// PATCH /products/:id - Update Product (Secure)
router.patch('/:id', async (req, res) => {
    try {
        const product = await adapter.updatePart(req.tenantId, req.params.id, req.body);
        res.json(product);
    }
    catch (error) {
        if (error.message.includes("Access Denied")) {
            return res.status(403).json({ error: "Access Denied" });
        }
        res.status(500).json({ error: "Failed to update product" });
    }
});
// POST /products/:id/stock - Adjust Stock (WWS)
router.post('/:id/stock', async (req, res) => {
    const { action, quantity } = req.body;
    if (!['add', 'remove', 'count'].includes(action) || typeof quantity !== 'number') {
        return res.status(400).json({ error: "Invalid action or quantity" });
    }
    try {
        const result = await adapter.processStockAction(req.tenantId, req.params.id, action, quantity);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error(`Stock update failed for ${req.params.id}: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
