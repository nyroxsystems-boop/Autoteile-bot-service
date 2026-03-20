import crypto from "crypto";
import express from "express";
import twilio from "twilio";
import { env } from "../config/env";
import { botQueue } from "../queue/botQueue";
import { logger } from "@utils/logger";

const router = express.Router();

// Twilio posts application/x-www-form-urlencoded bodies
router.use(express.urlencoded({ extended: false }));

function validateTwilioSignature(req: express.Request): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const enforce = env.enforceTwilioSignature;

  const host = req.get("host") || "";
  const proto = req.get("x-forwarded-proto") || req.protocol || "https";
  const url = `${proto}://${host}${req.originalUrl}`;

  if (!enforce || !authToken) {
    return true;
  }

  const signature = (req.headers["x-twilio-signature"] as string) || "";
  if (!signature) {
    logger.error("[Twilio Webhook] Missing X-Twilio-Signature header");
    return false;
  }

  try {
    const validator = (twilio as any).validateRequest;
    if (typeof validator === "function") {
      const valid = validator(authToken, signature, url, req.body || {});
      if (valid) return true;
    }
  } catch (e) {
    // ignore
  }

  // Fallback manual check
  const params = req.body || {};
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expected = crypto.createHmac("sha1", authToken).update(data).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (err) {
    logger.warn('[Webhook] Signature comparison error', { error: err });
    return false;
  }
}

router.post("/", async (req, res) => {
  if (!validateTwilioSignature(req)) {
    return res.status(401).send("<Response></Response>");
  }

  const from = (req.body?.From as string) || "";
  const messageSid = (req.body?.MessageSid as string) || "";
  if (!from) {
    logger.warn("[Twilio Webhook] Empty From field, rejecting");
    return res.status(400).send("<Response></Response>");
  }
  const text = (req.body?.Body as string) || "";
  const numMediaStr = (req.body?.NumMedia as string) || "0";
  const numMedia = parseInt(numMediaStr, 10) || 0;

  const mediaUrls: string[] = [];
  if (numMedia > 0) {
    for (let i = 0; i < numMedia; i++) {
      const url = req.body?.[`MediaUrl${i}`] as string | undefined;
      if (url) mediaUrls.push(url);
    }
  }

  logger.info("[Twilio Webhook] Enqueuing job", { from, textShort: text.slice(0, 50), media: numMedia });

  // B1 FIX: Try queue first, fall back to synchronous processing if Redis is down
  const jobData = {
    from,
    text: text || (mediaUrls.length > 0 ? "IMAGE_MESSAGE" : ""),
    orderId: null,
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    messageSid: messageSid || undefined
  };

  try {
    if (!botQueue) {
      throw new Error('Queue not initialized');
    }
    await botQueue.add("whatsapp-msg", jobData);
    res.type("text/xml").send("<Response></Response>");
  } catch (err: any) {
    logger.warn("[Twilio Webhook] Queue unavailable, falling back to sync processing", { error: err?.message });

    // Synchronous fallback — process the message directly
    try {
      const { handleIncomingBotMessage } = require("../services/core/botLogicService");
      const result = await handleIncomingBotMessage({
        from: jobData.from,
        text: jobData.text,
        orderId: jobData.orderId ?? undefined,
        mediaUrls: jobData.mediaUrls,
      });

      // Reply inline via TwiML
      const escapedReply = (result.reply || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const twiml = `<Response><Message>${escapedReply}</Message></Response>`;
      res.type("text/xml").send(twiml);
    } catch (syncErr: any) {
      logger.error("[Twilio Webhook] Sync fallback also failed", { error: syncErr?.message });
      res.type("text/xml").send("<Response><Message>Ein technisches Problem ist aufgetreten. Bitte versuchen Sie es erneut.</Message></Response>");
    }
  }
});

export default router;
