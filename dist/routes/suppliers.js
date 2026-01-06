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
exports.createSuppliersRouter = createSuppliersRouter;
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const wawi = __importStar(require("../services/adapters/inventreeAdapter"));
const logger_1 = require("../utils/logger");
function createSuppliersRouter() {
    const router = (0, express_1.Router)();
    // Apply auth to all supplier routes
    router.use(authMiddleware_1.authMiddleware);
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
    // GET /api/suppliers - List suppliers
    router.get("/", async (req, res) => {
        try {
            const suppliers = await wawi.listSuppliers(req.tenantId, req.query);
            return res.status(200).json(suppliers);
        }
        catch (err) {
            logger_1.logger.error("Error fetching suppliers", { error: err.message, tenant: req.tenantId });
            return res.status(500).json({
                error: "Failed to fetch suppliers",
                details: err.message
            });
        }
    });
    // GET /api/suppliers/:id - Get supplier by ID
    router.get("/:id", async (req, res) => {
        try {
            const supplier = await wawi.getSupplierById(req.tenantId, req.params.id);
            if (!supplier) {
                return res.status(404).json({ error: "Supplier not found" });
            }
            return res.status(200).json(supplier);
        }
        catch (err) {
            logger_1.logger.error("Error fetching supplier", { error: err.message, id: req.params.id, tenant: req.tenantId });
            return res.status(500).json({
                error: "Failed to fetch supplier",
                details: err.message
            });
        }
    });
    // POST /api/suppliers - Create supplier
    router.post("/", async (req, res) => {
        try {
            const supplier = await wawi.createSupplier(req.tenantId, req.body);
            return res.status(201).json(supplier);
        }
        catch (err) {
            logger_1.logger.error("Error creating supplier", { error: err.message, tenant: req.tenantId });
            return res.status(500).json({
                error: "Failed to create supplier",
                details: err.message
            });
        }
    });
    // PATCH /api/suppliers/:id - Update supplier
    router.patch("/:id", async (req, res) => {
        try {
            const supplier = await wawi.updateSupplier(req.tenantId, req.params.id, req.body);
            return res.status(200).json(supplier);
        }
        catch (err) {
            logger_1.logger.error("Error updating supplier", { error: err.message, id: req.params.id, tenant: req.tenantId });
            return res.status(500).json({
                error: "Failed to update supplier",
                details: err.message
            });
        }
    });
    // DELETE /api/suppliers/:id - Delete supplier
    router.delete("/:id", async (req, res) => {
        try {
            await wawi.deleteSupplier(req.tenantId, req.params.id);
            return res.status(204).send();
        }
        catch (err) {
            logger_1.logger.error("Error deleting supplier", { error: err.message, id: req.params.id, tenant: req.tenantId });
            return res.status(500).json({
                error: "Failed to delete supplier",
                details: err.message
            });
        }
    });
    return router;
}
exports.default = createSuppliersRouter;
