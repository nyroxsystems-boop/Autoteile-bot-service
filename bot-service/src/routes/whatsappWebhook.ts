import crypto from "crypto";
import express from "express";
import fetch from "node-fetch";
import twilio from "twilio";
import { env } from "../config/env";

const router = express.Router();

// Twilio posts application/x-www-form-urlencoded bodies
router.use(express.urlencoded({ extended: false }));

function validateTwilioSignature(req: express.Request): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const enforce = env.enforceTwilioSignature;

  const host = req.get("host") || "";
  const proto = req.get("x-forwarded-proto") || req.protocol || "https";
  const url = `${proto}://${host}${req.originalUrl}`;

  console.log("[Twilio Webhook] Signature check", {
    hasToken: !!authToken,
    enforce,
    url
  });

  if (!enforce || !authToken) {
    // Skip validation in dev/debug if not enforced or token missing
    return true;
  }

  const signature = (req.headers["x-twilio-signature"] as string) || "";
  if (!signature) {
    console.error("[Twilio Webhook] Missing X-Twilio-Signature header");
    return false;
  }

  // Prefer built-in validator from the Twilio SDK if available
  try {
    const validator = (twilio as any).validateRequest;
    if (typeof validator === "function") {
      // Twilio SDK expects: (authToken, signature, url, params)
      const valid = validator(authToken, signature, url, req.body || {});
      if (valid) return true;
      console.warn("[Twilio Webhook] twilio.validateRequest failed, falling back to manual check");
    }
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.warn("[Twilio Webhook] twilio.validateRequest threw, falling back to manual check", errMsg);
  }

  const params = req.body || {};
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expected = crypto.createHmac("sha1", authToken).update(data).digest("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function xmlEscape(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/\n/g, "&#10;");
}

router.post("/", (req, res) => {
  if (!validateTwilioSignature(req)) {
    const twimlReject = `<Response><Message>${xmlEscape(
      "Es ist ein technischer Fehler aufgetreten. Bitte versuche es später erneut."
    )}</Message></Response>`;
    return res.type("text/xml").status(401).send(twimlReject);
  }

  const from = (req.body?.From as string) || "";
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

  // Log incoming Twilio webhook payload
  console.log("[Twilio Webhook] Incoming", { from, text, numMedia, mediaUrls });
  console.log("[Twilio Webhook] Forwarding to bot/message (async)", {
    from,
    safeText: text || (mediaUrls.length > 0 ? "IMAGE_MESSAGE" : ""),
    hasMedia: mediaUrls.length > 0
  });

  // Respond immediately to Twilio to avoid 15s timeout (11200)
  res.type("text/xml").status(200).send("<Response></Response>");

  // Process asynchronously after acknowledging Twilio
  (async () => {
    const replyFallback = "Es ist ein technischer Fehler aufgetreten. Bitte versuche es später erneut.";
    const safeText = text || (mediaUrls.length > 0 ? "IMAGE_MESSAGE" : "");
    const botPayload = {
      from,
      text: safeText,
      orderId: null,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined
    };

    try {
      const botResponse = await fetch("https://autoteile-bot-service.onrender.com/bot/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.botApiSecret ? { "x-bot-secret": env.botApiSecret } : {})
        },
        body: JSON.stringify(botPayload)
      });

      if (!botResponse.ok) {
        throw new Error(`Bot API returned status ${botResponse.status}`);
      }

      const data = (await botResponse.json()) as {
        reply?: string;
        replies?: Array<{ text: string; mediaUrl?: string | null }>;
      };
      const replies = data.replies && data.replies.length > 0 ? data.replies : data.reply ? [{ text: data.reply }] : [];
      const messagesToSend = replies.length > 0 ? replies : [{ text: replyFallback }];

      // Send WhatsApp reply/replies via Twilio REST API
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886"; // Twilio sandbox default

      if (!accountSid || !authToken) {
        console.error("[Twilio Webhook] Missing Twilio credentials, cannot send reply");
        return;
      }

      const client = twilio(accountSid, authToken);
      for (const msg of messagesToSend) {
        await client.messages.create({
          from: fromNumber,
          to: from,
          body: msg.text,
          mediaUrl: msg.mediaUrl ? [msg.mediaUrl] : undefined
        });
      }
      const preview = messagesToSend.map((m) => m.text).join(" | ").slice(0, 120);
      console.log("[Twilio Webhook] WhatsApp reply sent", { to: from, bodyPreview: preview });
    } catch (err: any) {
      console.error("[Twilio Webhook] Error calling bot/message or sending reply", { error: err?.message });
    }
  })().catch((err) => console.error("[Twilio Webhook] async handler failed", err?.message ?? err));
});

export default router;
