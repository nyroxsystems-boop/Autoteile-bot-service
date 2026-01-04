import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import * as db from "../services/core/database";

const router = Router();

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

    try {
        const sql = `INSERT INTO users (id, name, email, role, created_at, password_hash) VALUES (?, ?, ?, ?, ?, ?)`;
        await db.run(sql, [id, name, email, role || "sales_rep", createdAt, passwordHash]);

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

// --- KPIs ---

// --- Tenants / Händler (InvenTree Companies) ---

import { getCompanies, createCompany, InvenTreeCompany } from "@adapters/realInvenTreeAdapter";

router.get("/tenants", async (req: Request, res: Response) => {
    try {
        // Tenants are "Companies" in InvenTree (Customers)
        const companies = await getCompanies({ is_customer: true });

        // Map to Dashboard Tenant Format
        const tenants = companies.map((c: any) => ({
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
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

router.post("/tenants", async (req: Request, res: Response) => {
    try {
        const { name, email, website, phone } = req.body;

        const payload: InvenTreeCompany = {
            name,
            email,
            website,
            phone,
            is_customer: true,
            is_supplier: false,
            active: true,
            description: "Auto-Created via Admin Dashboard"
        };

        const created = await createCompany(payload);
        return res.json(created);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

router.get("/kpis", async (req: Request, res: Response) => {
    try {
        // Tenants count from InvenTree
        const tenants = await getCompanies({ is_customer: true });

        // Basic stats from orders table
        const totalOrdersRow = await db.get<any>("SELECT COUNT(*) as count FROM orders");
        // ... rest of KPIs
        const todayOrdersRow = await db.get<any>(
            "SELECT COUNT(*) as count FROM orders WHERE created_at > ?",
            [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]
        );
        const resolvedOemRow = await db.get<any>("SELECT COUNT(*) as count FROM orders WHERE oem_number IS NOT NULL");

        // Revenue mock (since we don't have implemented payments yet, assume avg cart 150€ for 'done' orders)
        const completedOrdersRow = await db.get<any>("SELECT COUNT(*) as count FROM orders WHERE status = 'done'");
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
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// --- Onboarding Wizard (Phase 11) ---

import * as onboarding from "../services/onboardingService";

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
