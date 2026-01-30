/**
 * Bot Testing Routes
 * Admin-Dashboard OEM Bot Simulator - Bypasses Twilio
 */

import { Router, Request, Response } from "express";
import { handleIncomingBotMessage } from "../services/core/botLogicService";
import { insertMessage } from "@adapters/supabaseService";
import * as db from "../services/core/database";

const router = Router();

// In-memory store for test sessions
const testSessions = new Map<string, {
    messages: Array<{ role: 'user' | 'bot'; text: string; timestamp: Date }>;
    orderId?: string;
}>();

/**
 * POST /api/bot-testing/chat
 * Send a message to the bot and get a response
 */
router.post("/chat", async (req: Request, res: Response) => {
    const { from, text, simulateImage } = req.body ?? {};

    if (!from || !text) {
        return res.status(400).json({ error: "from and text are required" });
    }

    // Normalize phone number
    const normalizedFrom = from.startsWith('+') ? from : `+${from}`;
    const sessionKey = `test:${normalizedFrom}`;

    try {
        console.log("[BotTesting] Incoming message:", { from: normalizedFrom, text });

        // Initialize session if needed
        if (!testSessions.has(sessionKey)) {
            testSessions.set(sessionKey, { messages: [] });
        }
        const session = testSessions.get(sessionKey)!;

        // Store user message
        session.messages.push({ role: 'user', text, timestamp: new Date() });

        // Call the actual bot logic
        const result = await handleIncomingBotMessage({
            from: normalizedFrom,
            text,
            orderId: session.orderId ?? null,
            mediaUrls: simulateImage ? ['https://placeholder.test/image.jpg'] : undefined
        });

        // Update session with order ID
        if (result.orderId) {
            session.orderId = result.orderId;
        }

        // Store bot response
        session.messages.push({ role: 'bot', text: result.reply, timestamp: new Date() });

        // Get order details for debugging
        let orderDetails = null;
        if (result.orderId) {
            try {
                orderDetails = await db.get<any>(
                    `SELECT o.*, v.brand, v.model, v.year, v.license_plate, v.vin
                     FROM orders o
                     LEFT JOIN vehicles v ON o.vehicle_id = v.id
                     WHERE o.id = ?`,
                    [result.orderId]
                );
            } catch (e) {
                console.error("Failed to fetch order details:", e);
            }
        }

        console.log("[BotTesting] Bot response:", { orderId: result.orderId, reply: result.reply.substring(0, 100) + '...' });

        return res.json({
            reply: result.reply,
            orderId: result.orderId,
            orderDetails,
            messageCount: session.messages.length,
            session: {
                from: normalizedFrom,
                history: session.messages.slice(-10) // Last 10 messages
            }
        });

    } catch (err: any) {
        console.error("[BotTesting] Error:", err);
        return res.status(500).json({
            error: "Bot testing failed",
            details: err?.message ?? String(err)
        });
    }
});

/**
 * POST /api/bot-testing/reset
 * Reset a test conversation
 */
router.post("/reset", async (req: Request, res: Response) => {
    const { from } = req.body ?? {};

    if (!from) {
        return res.status(400).json({ error: "from is required" });
    }

    const normalizedFrom = from.startsWith('+') ? from : `+${from}`;
    const sessionKey = `test:${normalizedFrom}`;

    try {
        // Clear session
        testSessions.delete(sessionKey);

        // Optionally clear orders for this test number
        // await db.run("DELETE FROM orders WHERE customer_contact = ?", [normalizedFrom]);

        console.log("[BotTesting] Session reset for:", normalizedFrom);

        return res.json({
            success: true,
            message: `Session reset for ${normalizedFrom}`
        });

    } catch (err: any) {
        return res.status(500).json({
            error: "Reset failed",
            details: err?.message ?? String(err)
        });
    }
});

/**
 * GET /api/bot-testing/conversations
 * List all test conversations
 */
router.get("/conversations", async (_req: Request, res: Response) => {
    try {
        const conversations = Array.from(testSessions.entries()).map(([key, session]) => ({
            from: key.replace('test:', ''),
            messageCount: session.messages.length,
            orderId: session.orderId,
            lastMessage: session.messages[session.messages.length - 1]?.text?.substring(0, 50),
            lastActivity: session.messages[session.messages.length - 1]?.timestamp
        }));

        return res.json({
            count: conversations.length,
            conversations
        });

    } catch (err: any) {
        return res.status(500).json({ error: err?.message ?? String(err) });
    }
});

/**
 * GET /api/bot-testing/session/:from
 * Get full session history
 */
router.get("/session/:from", async (req: Request, res: Response) => {
    const { from } = req.params;
    const normalizedFrom = from.startsWith('+') ? from : `+${from}`;
    const sessionKey = `test:${normalizedFrom}`;

    const session = testSessions.get(sessionKey);
    if (!session) {
        return res.status(404).json({ error: "Session not found" });
    }

    // Get full order details if exists
    let orderDetails = null;
    if (session.orderId) {
        try {
            orderDetails = await db.get<any>(
                `SELECT o.*, v.brand, v.model, v.year, v.license_plate, v.vin
                 FROM orders o
                 LEFT JOIN vehicles v ON o.vehicle_id = v.id
                 WHERE o.id = ?`,
                [session.orderId]
            );
        } catch (e) {
            console.error("Failed to fetch order details:", e);
        }
    }

    return res.json({
        from: normalizedFrom,
        messages: session.messages,
        orderId: session.orderId,
        orderDetails
    });
});

/**
 * GET /api/bot-testing/oem-stats
 * Get OEM resolution statistics
 */
router.get("/oem-stats", async (_req: Request, res: Response) => {
    try {
        const stats = await db.get<any>(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(CASE WHEN oem_number IS NOT NULL AND oem_number != '' THEN 1 ELSE 0 END) as oem_resolved,
                SUM(CASE WHEN status = 'OEM_RESOLVED' THEN 1 ELSE 0 END) as status_resolved,
                SUM(CASE WHEN status = 'COLLECTING_INFO' THEN 1 ELSE 0 END) as collecting_info,
                SUM(CASE WHEN status = 'OFFER_PRESENTED' THEN 1 ELSE 0 END) as offer_presented
            FROM orders
            WHERE created_at > NOW() - INTERVAL '7 days'
        `);

        const resolutionRate = stats?.total_orders > 0
            ? Math.round((stats.oem_resolved / stats.total_orders) * 100)
            : 0;

        return res.json({
            ...stats,
            resolution_rate: resolutionRate,
            period: "last_7_days"
        });

    } catch (err: any) {
        return res.status(500).json({ error: err?.message ?? String(err) });
    }
});

export default router;
