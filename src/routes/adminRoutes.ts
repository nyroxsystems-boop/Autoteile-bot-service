import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import * as db from "../services/database";

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

router.post("/users", async (req: Request, res: Response) => {
    const { name, email, role } = req.body;
    if (!name || !email) {
        return res.status(400).json({ error: "Name and Email are required." });
    }
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    try {
        const sql = `INSERT INTO users (id, name, email, role, created_at) VALUES (?, ?, ?, ?, ?)`;
        await db.run(sql, [id, name, email, role || "sales_rep", createdAt]);
        return res.json({ id, name, email, role: role || "sales_rep", created_at: createdAt });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// --- KPIs ---

router.get("/kpis", async (req: Request, res: Response) => {
    try {
        // Basic stats from orders table
        const totalOrdersRow = await db.get<any>("SELECT COUNT(*) as count FROM orders");
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

export function createAdminRouter() {
    return router;
}
