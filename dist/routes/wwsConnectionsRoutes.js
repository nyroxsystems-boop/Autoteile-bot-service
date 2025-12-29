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
const wwsConnectionModel = __importStar(require("../models/wwsConnectionModel"));
const providerRegistry_1 = require("../inventory/providerRegistry");
// Diese Endpoints sollten idealerweise per Auth geschützt werden (Dashboard-Only),
// und sensible authConfig-Daten müssten produktiv verschlüsselt in einer DB liegen.
const router = (0, express_1.Router)();
router.get("/", (_req, res) => {
    const connections = wwsConnectionModel.getAllConnections();
    res.json(connections);
});
router.post("/", (req, res) => {
    const { name, type, baseUrl, isActive, authConfig, config } = req.body ?? {};
    if (!name || !type) {
        return res.status(400).json({ error: "name and type are required" });
    }
    const connection = wwsConnectionModel.createConnection({ name, type, baseUrl, isActive, authConfig, config });
    (0, providerRegistry_1.invalidateProvidersCache)();
    res.status(201).json(connection);
});
router.put("/:id", (req, res) => {
    const { id } = req.params;
    const updated = wwsConnectionModel.updateConnection(id, req.body ?? {});
    if (!updated) {
        return res.status(404).json({ error: "Connection not found" });
    }
    (0, providerRegistry_1.invalidateProvidersCache)();
    res.json(updated);
});
router.delete("/:id", (req, res) => {
    const { id } = req.params;
    const ok = wwsConnectionModel.deleteConnection(id);
    if (!ok) {
        return res.status(404).json({ error: "Connection not found" });
    }
    (0, providerRegistry_1.invalidateProvidersCache)();
    res.json({ success: true });
});
router.post("/:id/test", async (req, res) => {
    const { id } = req.params;
    const { oemNumber } = req.body ?? {};
    const connection = wwsConnectionModel.getConnectionById(id);
    if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
    }
    const provider = (0, providerRegistry_1.createProviderForConnection)(connection);
    if (!provider) {
        return res.status(400).json({ error: "Unsupported provider type" });
    }
    const testOem = oemNumber || connection.config?.testOemNumber || "11428507683";
    try {
        const result = await provider.checkAvailabilityByOem(testOem);
        res.json({
            ok: true,
            sampleResultsCount: Array.isArray(result) ? result.length : 0
        });
    }
    catch (err) {
        console.error("[wwsConnectionsRoutes] test failed", err?.message ?? err);
        res.status(400).json({
            ok: false,
            error: err?.message ?? String(err)
        });
    }
});
exports.default = router;
