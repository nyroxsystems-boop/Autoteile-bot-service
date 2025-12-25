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
    const result = await handleIncomingBotMessage({
      from,
      text,
      orderId: orderId ?? null,
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : undefined
    });

    // Antwort als outgoing message speichern
    try {
      await insertMessage(from, result.reply, "OUT" as any);
    } catch (dbErr: any) {
      console.error("Failed to store outgoing bot message", { error: dbErr?.message, orderId: result.orderId });
      // Do not fail the whole request if logging to DB fails
    }

    console.log("[Bot] Outgoing reply", { orderId: result.orderId, reply: result.reply });
    res.json(result);
  } catch (err: any) {
    console.error("BotFlow Error:", err);
    res.status(500).json({
      error: "BotFlow failed",
      details: err?.message ?? String(err)
    });
  }
});

export default router;
