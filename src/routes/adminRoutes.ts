import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import * as db from "../services/core/database";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

// Protect all admin routes
router.use(authMiddleware);

// --- Users / Vertrieb Team ---

router.get("/users", async (req: Request, res: Response) => {
    try {
        const users = await db.all("SELECT * FROM users ORDER BY created_at DESC");
        return res.json(users);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

import { createHash } from "crypto";

function hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
}

router.post("/users", async (req: Request, res: Response) => {
    const { name, email, role, password } = req.body;
    if (!name || !email) {
        return res.status(400).json({ error: "Name and Email are required." });
    }
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    let passwordHash = null;
    if (password) {
        passwordHash = hashPassword(password);
    } else {
        // Optional default password for manual users? Or leave null (no login)
        // For safe fallback, maybe 'password123' hashed? Or just null.
        // User asked "unlock people". So they need password.
    }

    const username = email.split('@')[0]; // Default username from email

    try {
        const sql = `INSERT INTO users (id, name, email, role, created_at, password_hash, is_active, username) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`;
        await db.run(sql, [id, name, email, role || "sales_rep", createdAt, passwordHash, username]);

        // IF Dealer -> Sync to InvenTree as 'Supplier' or 'Customer'?
        // The user asked for "Händler" (Dealer).
        if (role === 'dealer' || role === 'merchant' || role === 'admin') {
            // Optional: Sync to InvenTree
        }

        return res.json({ id, name, email, role: role || "sales_rep", created_at: createdAt });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// --- Devices (Mock) ---
const activeDevicesMock = new Map<string, any[]>();

router.get("/tenants/:id/devices", async (req: Request, res: Response) => {
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

router.delete("/tenants/:id/devices/:deviceId", async (req: Request, res: Response) => {
    const { id, deviceId } = req.params;
    const devices = activeDevicesMock.get(id) || [];
    const filtered = devices.filter(d => d.device_id !== deviceId);
    activeDevicesMock.set(id, filtered);
    return res.json({ success: true });
});

// --- KPIs ---

// --- Tenants / Händler (InvenTree Companies) ---

import { getCompanies, createCompany, InvenTreeCompany } from "@adapters/realInvenTreeAdapter";

// In-memory store for Tenant Limits (Mock Persistence)
const tenantLimits = new Map<string, { max_users: number, max_devices: number }>();

router.get("/tenants", async (req: Request, res: Response) => {
    try {
        // Tenants are "Companies" in InvenTree (Customers)
        const companies = await getCompanies({ is_customer: true });

        // Map to Dashboard Tenant Format
        const tenants = companies.map((c: any) => {
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
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

router.patch("/tenants/:id/limits", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { max_users, max_devices } = req.body;

        tenantLimits.set(id, {
            max_users: Number(max_users) || 10,
            max_devices: Number(max_devices) || 5
        });

        return res.json({ success: true, id, max_users, max_devices });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

router.post("/tenants", async (req: Request, res: Response) => {
    try {
        const { name, email, website, phone, password, whatsapp_number, logo_url } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: "Name and Email are required." });
        }

        const payload: InvenTreeCompany = {
            name,
            email,
            website: logo_url || website, // Hack: Storing logo_url in website for mock if needed, or we just trust the mock adapter handles extra fields
            phone: whatsapp_number || phone, // Priority to whatsapp number
            is_customer: true,
            is_supplier: false,
            active: true,
            description: "Auto-Created via Admin Dashboard"
        };

        // 1. Create Company in InvenTree
        const createdCompany = await createCompany(payload);
        const merchantId = String(createdCompany.pk);

        // 2. Create Admin User for this Company
        const userId = randomUUID();
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
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

router.get("/kpis", async (req: Request, res: Response) => {
    try {
        // Tenants count from InvenTree
        const tenants = await getCompanies({ is_customer: true });

        // Fetch all orders to calculate stats manually (since DB adapter is a mock)
        const allOrders = await db.all<any>("SELECT * FROM orders");

        // 1. Total Orders
        const totalOrders = allOrders.length;

        // 2. Orders Today
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const ordersToday = allOrders.filter(o => new Date(o.created_at) > yesterday).length;

        // 3. Revenue (Sum of 'total' for done orders)
        // Ensure we handle potential missing 'total' fields or strings
        const doneOrders = allOrders.filter(o => o.status === 'done' || o.status === 'completed');
        const revenue = doneOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

        // 4. Conversion Rate (Completed vs Total)
        const conversionRate = totalOrders > 0 ? Math.round((doneOrders.length / totalOrders) * 100) : 0;

        // 5. OEM Resolution
        // Assuming 'oem_number' field availability
        const resolvedOemCount = allOrders.filter(o => !!o.oem_number).length;

        // 6. Active Users (Team)
        const allUsers = await db.all<any>("SELECT * FROM users");
        const activeUsers = allUsers.length;

        // 7. Messages (Mock or Real if table exists)
        // If messages table exists in db.ts, use it. Otherwise 0.
        // We'll try to fetch, if empty array it's 0.
        const allMessages = await db.all<any>("SELECT * FROM messages");

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
                messagesSent: allMessages.length
            },
            oem: {
                resolvedCount: resolvedOemCount,
                successRate: totalOrders > 0 ? Math.round((resolvedOemCount / totalOrders) * 100) : 0
            }
        });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// --- Onboarding Wizard (Phase 11) ---

import * as onboarding from "../services/core/onboardingService";

router.post("/onboarding/initialize", async (req: Request, res: Response) => {
    try {
        const { name, email } = req.body;
        if (!name || !email) return res.status(400).json({ error: "Name and Email required" });
        const result = await onboarding.initializeOnboarding(name, email);
        return res.json(result);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

router.post("/onboarding/twilio", async (req: Request, res: Response) => {
    try {
        const { sessionId, phoneNumber, sid, token } = req.body;
        const result = await onboarding.configureTwilio(sessionId, phoneNumber, sid, token);
        return res.json(result);
    } catch (err: any) {
        return res.status(400).json({ error: err.message });
    }
});

router.post("/onboarding/import", async (req: Request, res: Response) => {
    try {
        const { sessionId, csvData } = req.body;
        const result = await onboarding.importInventory(sessionId, csvData);
        return res.json(result);
    } catch (err: any) {
        return res.status(400).json({ error: err.message });
    }
});

router.post("/onboarding/shop", async (req: Request, res: Response) => {
    try {
        const { sessionId, shopType, apiKey, shopUrl } = req.body;
        const result = await onboarding.connectShop(sessionId, shopType, apiKey, shopUrl);
        return res.json(result);
    } catch (err: any) {
        return res.status(400).json({ error: err.message });
    }
});

export function createAdminRouter() {
    return router;
}
