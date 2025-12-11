import { Router, Request, Response } from "express";
import { handleIncomingBotMessage } from "../services/botLogicService";
import { insertMessage } from "../services/supabaseService";
import { env } from "../config/env";

const router = Router();

/**
 * POST /bot/message
 * 
 * Der komplette End-to-End Bot Flow:
 * - Nachricht verstehen
 * - Rückfragen stellen falls Infos fehlen
 * - OEM ermitteln
 * - Angebote scrapen
 * - Bestes Angebot bestimmen
 * - Antwort generieren
 */
router.post("/", async (req: Request, res: Response) => {
  if (env.botApiSecret) {
    const provided = req.header("x-bot-secret");
    if (provided !== env.botApiSecret) {
      return res.status(401).json({ error: "unauthorized" });
    }
  }

  const { from, text, orderId, mediaUrls } = req.body ?? {};

  if (!from || !text) {
    return res.status(400).json({ error: "from and text are required" });
  }

  try {
    console.log("[Bot] Incoming /bot/message", {
      from,
      text,
      orderId,
      hasMedia: Array.isArray(mediaUrls) && mediaUrls.length > 0
    });
    const result: { reply: string; orderId: string; replies?: Array<{ text: string; mediaUrl?: string | null }> } =
      await handleIncomingBotMessage({
        from,
        text,
        orderId: orderId ?? null,
        mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : undefined
      });

    const messages = result.replies && result.replies.length > 0 ? result.replies : [{ text: result.reply }];

    // Antworten als outgoing messages speichern
    for (const msg of messages) {
      try {
        await insertMessage({
          orderId: result.orderId || null,
          direction: "outgoing",
          channel: "whatsapp",
          fromIdentifier: null,
          toIdentifier: from,
          content: msg.text,
          rawPayload: msg.mediaUrl ? { mediaUrl: msg.mediaUrl } : null
        });
      } catch (dbErr: any) {
        console.error("Failed to store outgoing bot message", { error: dbErr?.message, orderId: result.orderId });
      }
    }

    console.log("[Bot] Outgoing reply", { orderId: result.orderId, replies: messages.map((m) => m.text) });
    res.json({ orderId: result.orderId, reply: messages[0]?.text, replies: messages });
  } catch (err: any) {
    console.error("BotFlow Error:", err);
    res.status(500).json({
      error: "BotFlow failed",
      details: err?.message ?? String(err)
    });
  }
});

export default router;
