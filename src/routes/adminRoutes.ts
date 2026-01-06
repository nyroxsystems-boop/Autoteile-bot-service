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
    const { name, email, role, password, tenant_id, username: providedUsername } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Email is required." });
    }
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    let passwordHash = null;
    if (password) {
        passwordHash = hashPassword(password);
    } else {
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

        // Check if company already exists (duplicate detection)
        try {
            const existingCompanies = await getCompanies({ is_customer: true });
            const duplicate = existingCompanies.find((c: any) =>
                c.name === name || c.email === email
            );

            if (duplicate) {
                console.warn(`Duplicate company detected: ${duplicate.name} (${duplicate.email})`);
                return res.status(409).json({
                    error: "A company with this name or email already exists.",
                    existing: { id: duplicate.pk, name: duplicate.name, email: duplicate.email }
                });
            }
        } catch (checkErr: any) {
            console.error("Failed to check for duplicate companies:", checkErr.message);
            // Continue with creation attempt even if duplicate check fails
        }

        const payload: InvenTreeCompany = {
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
            createdCompany = await createCompany(payload);
        } catch (createErr: any) {
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
    } catch (err: any) {
        console.error("Tenant creation failed:", err.message);
        return res.status(500).json({ error: err.message });
    }
});

router.get("/kpis", async (req: Request, res: Response) => {
    try {
        // Tenants count from InvenTree
        const tenants = await getCompanies({ is_customer: true });

        // Optimized queries using COUNT instead of loading all data
        const totalOrdersResult = await db.get<any>("SELECT COUNT(*) as count FROM orders");
        const totalOrders = totalOrdersResult?.count || 0;

        // Orders Today
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const ordersTodayResult = await db.get<any>("SELECT COUNT(*) as count FROM orders WHERE created_at > ?", [yesterday]);
        const ordersToday = ordersTodayResult?.count || 0;

        // Revenue (Sum of 'total' for done orders)
        const revenueResult = await db.get<any>("SELECT SUM(CAST(total AS REAL)) as revenue FROM orders WHERE status IN ('done', 'completed')");
        const revenue = revenueResult?.revenue || 0;

        // Conversion Rate
        const doneOrdersResult = await db.get<any>("SELECT COUNT(*) as count FROM orders WHERE status IN ('done', 'completed')");
        const doneOrdersCount = doneOrdersResult?.count || 0;
        const conversionRate = totalOrders > 0 ? Math.round((doneOrdersCount / totalOrders) * 100) : 0;

        // OEM Resolution
        const resolvedOemResult = await db.get<any>("SELECT COUNT(*) as count FROM orders WHERE oem_number IS NOT NULL AND oem_number != ''");
        const resolvedOemCount = resolvedOemResult?.count || 0;

        // Active Users (Team)
        const activeUsersResult = await db.get<any>("SELECT COUNT(*) as count FROM users");
        const activeUsers = activeUsersResult?.count || 0;

        // Messages
        const messagesResult = await db.get<any>("SELECT COUNT(*) as count FROM messages");
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
