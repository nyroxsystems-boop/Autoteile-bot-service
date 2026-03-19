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
        } catch (err) { logger.debug('[BotTesting] Failed to persist lastBotMessage', { error: (err as any)?.message }); }

        // Get order details for debugging
        let orderDetails = null;
        if (result.orderId) {
            try {
                const raw = await db.get<any>(
                    `SELECT * FROM orders WHERE id = ?`,
                    [result.orderId]
                );
                if (raw) {
                    // Parse order_data JSON to extract OEM and part info
                    let orderData: any = {};
                    try {
                        orderData = typeof raw.order_data === 'string' ? JSON.parse(raw.order_data) : (raw.order_data || {});
                    } catch (err) { logger.debug('[BotTesting] order_data JSON parse failed', { error: (err as any)?.message }); }

                    let vehicleData: any = {};
                    try {
                        vehicleData = typeof raw.vehicle_data === 'string' ? JSON.parse(raw.vehicle_data) : (raw.vehicle_data || {});
                    } catch (err) { logger.debug('[BotTesting] vehicle_data JSON parse failed', { error: (err as any)?.message }); }

                    orderDetails = {
                        ...raw,
                        // Ensure oem_number is populated from column OR order_data
                        oem_number: raw.oem_number || orderData.oemNumber || orderData.oem_number || null,
                        // Extract part name from order_data
                        requested_part_name: orderData.requestedPart || orderData.partText || raw.requested_part_name || null,
                        // Extract vehicle info
                        brand: vehicleData.make || vehicleData.brand || orderData.vehicleBrand || null,
                        model: vehicleData.model || orderData.vehicleModel || null,
                        year: vehicleData.year || orderData.vehicleYear || null,
                        vin: vehicleData.vin || null,
                    };
                }
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
 * Reset a test conversation — clears in-memory session AND database state
 */
router.post("/reset", async (req: Request, res: Response) => {
    const { from } = req.body ?? {};

    if (!from) {
        return res.status(400).json({ error: "from is required" });
    }

    const normalizedFrom = from.startsWith('+') ? from : `+${from}`;
    const sessionKey = `test:${normalizedFrom}`;

    try {
        // 1. Clear in-memory test session
        testSessions.delete(sessionKey);

        // 2. Mark all active DB orders for this contact as 'done' so bot starts fresh
        let ordersReset = 0;
        try {
            const result = await db.all<any>(
                `UPDATE orders SET status = 'done' WHERE customer_contact = ? AND status != 'done' RETURNING id`,
                [normalizedFrom]
            );
            ordersReset = result?.length || 0;
        } catch (dbErr: any) {
            // Fallback: try without RETURNING (in case of older PG)
            try {
                await db.run(
                    `UPDATE orders SET status = 'done' WHERE customer_contact = ? AND status != 'done'`,
                    [normalizedFrom]
                );
                ordersReset = -1; // unknown count
            } catch (err) { logger.debug('[BotTesting] DB reset fallback failed', { error: (err as any)?.message }); }
            logger.warn("[BotTesting] DB order reset partial", { error: dbErr?.message });
        }

        // 3. Clear conversation history for this contact
        try {
            await db.run(
                `DELETE FROM conversations WHERE contact_phone = ?`,
                [normalizedFrom]
            );
        } catch (err) { logger.debug('[BotTesting] conversations table cleanup failed', { error: (err as any)?.message }); }

        // 4. Clear messages for this contact
        try {
            await db.run(
                `DELETE FROM messages WHERE phone_number = ?`,
                [normalizedFrom]
            );
        } catch (err) { logger.debug('[BotTesting] messages cleanup failed', { error: (err as any)?.message }); }

        logger.info("[BotTesting] Full session reset", { from: normalizedFrom, ordersReset });

        return res.json({
            success: true,
            message: `Full reset for ${normalizedFrom}`,
            ordersReset
        });

    } catch (err: any) {
        return res.status(500).json({
            error: "Reset failed",
            details: err?.message ?? String(err)
        });
    }
});

/**
 * POST /api/bot-testing/oem-reverse-lookup
 * AI-powered reverse lookup: given an OEM number, identify what part it is
 */
router.post("/oem-reverse-lookup", async (req: Request, res: Response) => {
    const { oem } = req.body ?? {};

    if (!oem || typeof oem !== 'string' || oem.length < 4) {
        return res.status(400).json({ error: "oem is required (min 4 chars)" });
    }

    try {
        const { generateChatCompletion } = await import("../services/intelligence/geminiService");

        const result = await generateChatCompletion({
            messages: [
                {
                    role: "system",
                    content: `Du bist ein Experte für KFZ-Ersatzteile und OEM-Nummern. Der Nutzer gibt dir eine OEM-Teilenummer und du identifizierst welches Fahrzeugteil das ist und für welche Fahrzeuge es passt. Antworte NUR als JSON: {"partName": "Name des Teils", "partCategory": "Kategorie", "vehicles": "Kompatible Fahrzeuge", "manufacturer": "OE-Hersteller", "confidence": 0.0-1.0, "notes": "Zusätzliche Info"}. Wenn du die Nummer nicht kennst, setze confidence auf 0 und partName auf "Unbekannt".`
                },
                {
                    role: "user",
                    content: `OEM-Nummer: ${oem}\n\nWelches Fahrzeugteil ist das?`
                }
            ],
            responseFormat: "json_object",
            temperature: 0.2,
        });

        const parsed = JSON.parse(result || "{}");
        logger.info("[BotTesting] OEM reverse lookup", { oem, partName: parsed.partName, confidence: parsed.confidence });

        return res.json({ success: true, oem, ...parsed });
    } catch (err: any) {
        logger.error("[BotTesting] OEM reverse lookup failed", { error: err?.message, oem });
        return res.status(500).json({ error: "Reverse lookup failed", details: err?.message ?? String(err) });
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
        // PostgreSQL syntax: NOW() - INTERVAL '7 days'
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
        logger.error("[BotTesting] OEM stats query failed", { error: err?.message });
        return res.status(500).json({ error: err?.message ?? String(err) });
    }
});

export default router;
