/**
 * Bot Testing Routes
 * Admin-Dashboard OEM Bot Simulator - 1:1 parity with real WhatsApp flow
 *
 * Uses the SAME logic as botWorker.ts:
 * - sendInterimReply callback (interim messages stored in session)
 * - withGeminiBudget wrapping (same cost control)
 * - Structured logging (no console.log)
 */

import { Router, Request, Response } from "express";
import { handleIncomingBotMessage } from "../services/core/botLogicService";
import { insertMessage } from "@adapters/supabaseService";
import { withGeminiBudget } from "../services/intelligence/geminiBudget";
import { logger } from "@utils/logger";
import * as db from "../services/core/database";

const router = Router();

// In-memory store for test sessions
const testSessions = new Map<string, {
    messages: Array<{ role: 'user' | 'bot' | 'system'; text: string; timestamp: Date }>;
    orderId?: string;
}>();

/**
 * POST /api/bot-testing/chat
 * Send a message to the bot and get a response — 1:1 with real WhatsApp flow
 */
router.post("/chat", async (req: Request, res: Response) => {
    const { from, text, imageBase64 } = req.body ?? {};

    if (!from || (!text && !imageBase64)) {
        return res.status(400).json({ error: "from and (text or imageBase64) are required" });
    }

    // Normalize phone number
    const normalizedFrom = from.startsWith('+') ? from : `+${from}`;
    const sessionKey = `test:${normalizedFrom}`;

    try {
        logger.info("[BotTesting] Incoming message", {
            from: normalizedFrom,
            text,
            hasImage: !!imageBase64,
            imageSize: imageBase64?.length || 0
        });

        // Initialize session if needed
        if (!testSessions.has(sessionKey)) {
            testSessions.set(sessionKey, { messages: [] });
        }
        const session = testSessions.get(sessionKey)!;

        // Store user message
        session.messages.push({ role: 'user', text: text || '📷 Bild', timestamp: new Date() });

        // Build mediaUrls if image is provided
        let mediaUrls: string[] | undefined;
        if (imageBase64) {
            mediaUrls = [`data:image/jpeg;base64,${imageBase64}`];
        }

        // ============================================================
        // 1:1 PARITY: sendInterimReply callback (same as botWorker.ts)
        // Interim messages ("🔍 Ich suche...") are stored in session
        // so the frontend can display them in real-time
        // ============================================================
        const interimMessages: string[] = [];
        const sendInterimReply = async (message: string) => {
            try {
                interimMessages.push(message);
                session.messages.push({ role: 'system', text: message, timestamp: new Date() });
                logger.info("[BotTesting] Interim reply", { to: normalizedFrom, message: message.substring(0, 50) });
            } catch (err: any) {
                logger.warn("[BotTesting] Interim reply failed (non-blocking)", { error: err?.message });
            }
        };

        // ============================================================
        // 1:1 PARITY: Gemini Budget (same as botWorker.ts)
        // Limits AI calls per request to prevent cost explosion
        // ============================================================
        const GEMINI_BUDGET = parseInt(process.env.GEMINI_BUDGET_PER_REQUEST || '8', 10);

        const result = await withGeminiBudget(GEMINI_BUDGET, () =>
            handleIncomingBotMessage({
                from: normalizedFrom,
                text: text || 'Fahrzeugschein-Bild',
                orderId: session.orderId ?? null,
                mediaUrls
            }, sendInterimReply),
            `bot-testing-${normalizedFrom}`
        );

        // Update session with order ID
        if (result.orderId) {
            session.orderId = result.orderId;
        }

        // Store bot response
        session.messages.push({ role: 'bot', text: result.reply, timestamp: new Date() });

        // Persist reply in DB (same as botWorker.ts)
        try {
            await insertMessage(normalizedFrom, result.reply, "OUT" as any);
        } catch (dbErr: any) {
            logger.warn("[BotTesting] Failed to persist outgoing message", { error: dbErr?.message });
        }

        // Persist lastBotMessage for orchestrator context (same as botWorker.ts)
        try {
            const { updateOrderData } = await import("../services/adapters/supabaseService");
            if (result.orderId) {
                await updateOrderData(result.orderId, { lastBotMessage: result.reply });
            }
        } catch (_) { /* non-critical */ }

        // Get order details for debugging
        let orderDetails = null;
        if (result.orderId) {
            try {
                orderDetails = await db.get<any>(
                    `SELECT * FROM orders WHERE id = ?`,
                    [result.orderId]
                );
            } catch (e: any) {
                logger.warn("[BotTesting] Failed to fetch order details", { error: e?.message });
            }
        }

        logger.info("[BotTesting] Bot response", {
            orderId: result.orderId,
            reply: result.reply.substring(0, 100),
            interimCount: interimMessages.length
        });

        return res.json({
            reply: result.reply,
            orderId: result.orderId,
            orderDetails,
            interimMessages,  // Frontend can display these
            messageCount: session.messages.length,
            session: {
                from: normalizedFrom,
                history: session.messages.slice(-20) // Last 20 messages
            }
        });

    } catch (err: any) {
        logger.error("[BotTesting] Error", { error: err?.message, from: normalizedFrom });
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

        logger.info("[BotTesting] Session reset", { from: normalizedFrom });

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
                `SELECT * FROM orders WHERE id = ?`,
                [session.orderId]
            );
        } catch (e: any) {
            logger.warn("[BotTesting] Failed to fetch order details", { error: e?.message });
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
 * Get OEM resolution statistics (SQLite-compatible)
 */
router.get("/oem-stats", async (_req: Request, res: Response) => {
    try {
        // SQLite-compatible: datetime('now', '-7 days') instead of PostgreSQL NOW() - INTERVAL
        const stats = await db.get<any>(`
            SELECT 
                COUNT(*) as total_orders,
                SUM(CASE WHEN oem_number IS NOT NULL AND oem_number != '' THEN 1 ELSE 0 END) as oem_resolved,
                SUM(CASE WHEN status = 'OEM_RESOLVED' THEN 1 ELSE 0 END) as status_resolved,
                SUM(CASE WHEN status = 'COLLECTING_INFO' THEN 1 ELSE 0 END) as collecting_info,
                SUM(CASE WHEN status = 'OFFER_PRESENTED' THEN 1 ELSE 0 END) as offer_presented
            FROM orders
            WHERE created_at > datetime('now', '-7 days')
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
        logger.error("[BotTesting] OEM stats query failed", { error: err?.message });
        return res.status(500).json({ error: err?.message ?? String(err) });
    }
});

export default router;
