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
exports.createAdminRouter = createAdminRouter;
const express_1 = require("express");
const crypto_1 = require("crypto");
const db = __importStar(require("../services/database"));
const router = (0, express_1.Router)();
// --- Users / Vertrieb Team ---
router.get("/users", async (req, res) => {
    try {
        const users = await db.all("SELECT * FROM users ORDER BY created_at DESC");
        return res.json(users);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
const crypto_2 = require("crypto");
function hashPassword(password) {
    return (0, crypto_2.createHash)('sha256').update(password).digest('hex');
}
router.post("/users", async (req, res) => {
    const { name, email, role, password } = req.body;
    if (!name || !email) {
        return res.status(400).json({ error: "Name and Email are required." });
    }
    const id = (0, crypto_1.randomUUID)();
    const createdAt = new Date().toISOString();
    let passwordHash = null;
    if (password) {
        passwordHash = hashPassword(password);
    }
    else {
        // Optional default password for manual users? Or leave null (no login)
        // For safe fallback, maybe 'password123' hashed? Or just null.
        // User asked "unlock people". So they need password.
    }
    try {
        const sql = `INSERT INTO users (id, name, email, role, created_at, password_hash) VALUES (?, ?, ?, ?, ?, ?)`;
        await db.run(sql, [id, name, email, role || "sales_rep", createdAt, passwordHash]);
        // IF Dealer -> Sync to InvenTree as 'Supplier' or 'Customer'?
        // The user asked for "Händler" (Dealer).
        if (role === 'dealer' || role === 'merchant' || role === 'admin') {
            // Optional: Sync to InvenTree
        }
        return res.json({ id, name, email, role: role || "sales_rep", created_at: createdAt });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// --- KPIs ---
// --- Tenants / Händler (InvenTree Companies) ---
const realInvenTreeAdapter_1 = require("../services/realInvenTreeAdapter");
router.get("/tenants", async (req, res) => {
    try {
        // Tenants are "Companies" in InvenTree (Customers)
        const companies = await (0, realInvenTreeAdapter_1.getCompanies)({ is_customer: true });
        // Map to Dashboard Tenant Format
        const tenants = companies.map((c) => ({
            id: c.pk,
            name: c.name,
            slug: c.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            user_count: 0, // InvenTree doesn't track this yet
            max_users: 10,
            device_count: 0,
            max_devices: 5,
            is_active: c.active
        }));
        return res.json(tenants);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.post("/tenants", async (req, res) => {
    try {
        const { name, email, website, phone } = req.body;
        const payload = {
            name,
            email,
            website,
            phone,
            is_customer: true,
            is_supplier: false,
            active: true,
            description: "Auto-Created via Admin Dashboard"
        };
        const created = await (0, realInvenTreeAdapter_1.createCompany)(payload);
        return res.json(created);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.get("/kpis", async (req, res) => {
    try {
        // Tenants count from InvenTree
        const tenants = await (0, realInvenTreeAdapter_1.getCompanies)({ is_customer: true });
        // Basic stats from orders table
        const totalOrdersRow = await db.get("SELECT COUNT(*) as count FROM orders");
        // ... rest of KPIs
        const todayOrdersRow = await db.get("SELECT COUNT(*) as count FROM orders WHERE created_at > ?", [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]);
        const resolvedOemRow = await db.get("SELECT COUNT(*) as count FROM orders WHERE oem_number IS NOT NULL");
        // Revenue mock (since we don't have implemented payments yet, assume avg cart 150€ for 'done' orders)
        const completedOrdersRow = await db.get("SELECT COUNT(*) as count FROM orders WHERE status = 'done'");
        const revenue = (completedOrdersRow?.count || 0) * 150;
        return res.json({
            sales: {
                totalOrders: totalOrdersRow?.count || 0,
                ordersToday: todayOrdersRow?.count || 0,
                revenue: revenue,
                conversionRate: completedOrdersRow?.count && totalOrdersRow?.count ? Math.round((completedOrdersRow.count / totalOrdersRow.count) * 100) : 0
            },
            team: {
                // Mock activity
                activeUsers: 3,
                callsMade: 42,
                messagesSent: 128
            },
            oem: {
                resolvedCount: resolvedOemRow?.count || 0,
                successRate: 85
            }
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// --- Onboarding Wizard (Phase 11) ---
const onboarding = __importStar(require("../services/onboardingService"));
router.post("/onboarding/initialize", async (req, res) => {
    try {
        const { name, email } = req.body;
        if (!name || !email)
            return res.status(400).json({ error: "Name and Email required" });
        const result = await onboarding.initializeOnboarding(name, email);
        return res.json(result);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.post("/onboarding/twilio", async (req, res) => {
    try {
        const { sessionId, phoneNumber, sid, token } = req.body;
        const result = await onboarding.configureTwilio(sessionId, phoneNumber, sid, token);
        return res.json(result);
    }
    catch (err) {
        return res.status(400).json({ error: err.message });
    }
});
router.post("/onboarding/import", async (req, res) => {
    try {
        const { sessionId, csvData } = req.body;
        const result = await onboarding.importInventory(sessionId, csvData);
        return res.json(result);
    }
    catch (err) {
        return res.status(400).json({ error: err.message });
    }
});
router.post("/onboarding/shop", async (req, res) => {
    try {
        const { sessionId, shopType, apiKey, shopUrl } = req.body;
        const result = await onboarding.connectShop(sessionId, shopType, apiKey, shopUrl);
        return res.json(result);
    }
    catch (err) {
        return res.status(400).json({ error: err.message });
    }
});
function createAdminRouter() {
    return router;
}
