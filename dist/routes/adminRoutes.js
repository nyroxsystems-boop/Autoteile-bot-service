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
const db = __importStar(require("../services/core/database"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Protect all admin routes
router.use(authMiddleware_1.authMiddleware);
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
    const { name, email, role, password, tenant_id, username: providedUsername } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Email is required." });
    }
    const id = (0, crypto_1.randomUUID)();
    const createdAt = new Date().toISOString();
    let passwordHash = null;
    if (password) {
        passwordHash = hashPassword(password);
    }
    else {
        // Generate default password if not provided
        const defaultPassword = 'Welcome123!';
        passwordHash = hashPassword(defaultPassword);
    }
    const username = providedUsername || email.split('@')[0]; // Use provided or derive from email
    const userName = name || username; // Use name if provided, otherwise username
    try {
        const sql = `INSERT INTO users (id, name, email, role, created_at, password_hash, is_active, username, merchant_id) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`;
        await db.run(sql, [id, userName, email, role || "sales_rep", createdAt, passwordHash, username, tenant_id || null]);
        return res.json({ id, name: userName, email, role: role || "sales_rep", created_at: createdAt, username });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// --- Devices (Mock) ---
const activeDevicesMock = new Map();
router.get("/tenants/:id/devices", async (req, res) => {
    const { id } = req.params;
    // Return mock devices if none exist yet
    if (!activeDevicesMock.has(id)) {
        activeDevicesMock.set(id, [
            { id: "dev_1", device_id: "iphone-13-pro", user: "Max Mustermann", last_seen: new Date().toISOString(), ip: "192.168.1.1" },
            { id: "dev_2", device_id: "samsung-s21", user: "Erika Musterfrau", last_seen: new Date().toISOString(), ip: "192.168.1.2" }
        ]);
    }
    return res.json(activeDevicesMock.get(id));
});
router.delete("/tenants/:id/devices/:deviceId", async (req, res) => {
    const { id, deviceId } = req.params;
    const devices = activeDevicesMock.get(id) || [];
    const filtered = devices.filter(d => d.device_id !== deviceId);
    activeDevicesMock.set(id, filtered);
    return res.json({ success: true });
});
// --- KPIs ---
// --- Tenants / Händler (InvenTree Companies) ---
const realInvenTreeAdapter_1 = require("../services/adapters/realInvenTreeAdapter");
// In-memory store for Tenant Limits (Mock Persistence)
const tenantLimits = new Map();
router.get("/tenants", async (req, res) => {
    try {
        // Tenants are "Companies" in InvenTree (Customers)
        const companies = await (0, realInvenTreeAdapter_1.getCompanies)({ is_customer: true });
        // Map to Dashboard Tenant Format
        const tenants = companies.map((c) => {
            const limits = tenantLimits.get(String(c.pk)) || { max_users: 10, max_devices: 5 };
            return {
                id: c.pk,
                name: c.name,
                slug: c.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                user_count: 0, // InvenTree doesn't track this yet
                max_users: limits.max_users,
                device_count: 0,
                max_devices: limits.max_devices,
                is_active: c.active,
                // Mock or Real Mapping for Status
                onboarding_status: c.description?.includes("Wizard") ? 'completed' : 'pending',
                payment_status: c.is_customer ? 'paid' : 'trial', // Naive mock
                whatsapp_number: c.phone || '', // Map phone to whatsapp_number if not distinct in mock
                logo_url: c.website || '' // Reuse website field or mock a specific logo field if DB allowed
            };
        });
        return res.json(tenants);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.patch("/tenants/:id/limits", async (req, res) => {
    try {
        const { id } = req.params;
        const { max_users, max_devices } = req.body;
        tenantLimits.set(id, {
            max_users: Number(max_users) || 10,
            max_devices: Number(max_devices) || 5
        });
        return res.json({ success: true, id, max_users, max_devices });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
router.post("/tenants", async (req, res) => {
    try {
        const { name, email, website, phone, password, whatsapp_number, logo_url } = req.body;
        if (!name || !email) {
            return res.status(400).json({ error: "Name and Email are required." });
        }
        // Check if company already exists (duplicate detection)
        try {
            const existingCompanies = await (0, realInvenTreeAdapter_1.getCompanies)({ is_customer: true });
            const duplicate = existingCompanies.find((c) => c.name === name || c.email === email);
            if (duplicate) {
                console.warn(`Duplicate company detected: ${duplicate.name} (${duplicate.email})`);
                return res.status(409).json({
                    error: "A company with this name or email already exists.",
                    existing: { id: duplicate.pk, name: duplicate.name, email: duplicate.email }
                });
            }
        }
        catch (checkErr) {
            console.error("Failed to check for duplicate companies:", checkErr.message);
            // Continue with creation attempt even if duplicate check fails
        }
        const payload = {
            name,
            email: email || null, // Send null instead of empty string to avoid unique constraint issues
            website: logo_url || website || "", // Hack: Storing logo_url in website for mock if needed
            phone: whatsapp_number || phone || "", // Priority to whatsapp number
            is_customer: true,
            is_supplier: false,
            active: true,
            description: "Auto-Created via Admin Dashboard",
            currency: "EUR" // Required field by InvenTree API
        };
        // 1. Create Company in InvenTree
        let createdCompany;
        try {
            createdCompany = await (0, realInvenTreeAdapter_1.createCompany)(payload);
        }
        catch (createErr) {
            // Log the full error for debugging
            console.error("Failed to create company in WAWI:", {
                message: createErr.message,
                response: createErr.response?.data,
                status: createErr.response?.status,
                payload: payload
            });
            // Return the actual error from WAWI if available
            if (createErr.response?.data) {
                return res.status(createErr.response.status || 500).json({
                    error: "Failed to create company in WAWI",
                    details: createErr.response.data
                });
            }
            throw createErr; // Re-throw to be caught by outer catch
        }
        const merchantId = String(createdCompany.pk);
        // 2. Create Admin User for this Company
        const userId = (0, crypto_1.randomUUID)();
        const createdAt = new Date().toISOString();
        const initialPassword = password || "Start123!";
        const passwordHash = hashPassword(initialPassword);
        // We assume 'merchant' role for the dealer admin
        const username = email.split('@')[0];
        const sql = `INSERT INTO users (id, name, email, role, created_at, password_hash, merchant_id, is_active, username) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`;
        await db.run(sql, [
            userId,
            name,
            email,
            "merchant",
            createdAt,
            passwordHash,
            merchantId,
            username
        ]);
        console.log(`Successfully created tenant: ${name} (ID: ${merchantId})`);
        // Return combined result
        return res.json({
            ...createdCompany,
            user_created: {
                id: userId,
                email: email,
                role: "merchant",
                initial_password: initialPassword
            }
        });
    }
    catch (err) {
        console.error("Tenant creation failed:", err.message);
        return res.status(500).json({ error: err.message });
    }
});
router.get("/kpis", async (req, res) => {
    try {
        // Tenants count from InvenTree
        const tenants = await (0, realInvenTreeAdapter_1.getCompanies)({ is_customer: true });
        // Optimized queries using COUNT instead of loading all data
        const totalOrdersResult = await db.get("SELECT COUNT(*) as count FROM orders");
        const totalOrders = totalOrdersResult?.count || 0;
        // Orders Today
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const ordersTodayResult = await db.get("SELECT COUNT(*) as count FROM orders WHERE created_at > ?", [yesterday]);
        const ordersToday = ordersTodayResult?.count || 0;
        // Revenue (Sum of 'total' for done orders)
        const revenueResult = await db.get("SELECT SUM(CAST(total AS REAL)) as revenue FROM orders WHERE status IN ('done', 'completed')");
        const revenue = revenueResult?.revenue || 0;
        // Conversion Rate
        const doneOrdersResult = await db.get("SELECT COUNT(*) as count FROM orders WHERE status IN ('done', 'completed')");
        const doneOrdersCount = doneOrdersResult?.count || 0;
        const conversionRate = totalOrders > 0 ? Math.round((doneOrdersCount / totalOrders) * 100) : 0;
        // OEM Resolution
        const resolvedOemResult = await db.get("SELECT COUNT(*) as count FROM orders WHERE oem_number IS NOT NULL AND oem_number != ''");
        const resolvedOemCount = resolvedOemResult?.count || 0;
        // Active Users (Team)
        const activeUsersResult = await db.get("SELECT COUNT(*) as count FROM users");
        const activeUsers = activeUsersResult?.count || 0;
        // Messages
        const messagesResult = await db.get("SELECT COUNT(*) as count FROM messages");
        const messagesSent = messagesResult?.count || 0;
        // Mock history data for charts (last 6 months)
        const history = [
            { name: 'Aug', orders: Math.max(0, totalOrders - 50), revenue: Math.max(0, revenue - 5000) },
            { name: 'Sep', orders: Math.max(0, totalOrders - 40), revenue: Math.max(0, revenue - 4000) },
            { name: 'Okt', orders: Math.max(0, totalOrders - 30), revenue: Math.max(0, revenue - 3000) },
            { name: 'Nov', orders: Math.max(0, totalOrders - 20), revenue: Math.max(0, revenue - 2000) },
            { name: 'Dez', orders: Math.max(0, totalOrders - 10), revenue: Math.max(0, revenue - 1000) },
            { name: 'Jan', orders: totalOrders, revenue: revenue }
        ];
        return res.json({
            sales: {
                totalOrders,
                ordersToday,
                revenue,
                conversionRate
            },
            team: {
                activeUsers,
                callsMade: 0, // Not tracked yet
                messagesSent
            },
            oem: {
                resolvedCount: resolvedOemCount,
                successRate: totalOrders > 0 ? Math.round((resolvedOemCount / totalOrders) * 100) : 0
            },
            history
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// --- Onboarding Wizard (Phase 11) ---
const onboarding = __importStar(require("../services/core/onboardingService"));
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
