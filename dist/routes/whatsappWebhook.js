"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const express_1 = __importDefault(require("express"));
const twilio_1 = __importDefault(require("twilio"));
const env_1 = require("../config/env");
const botQueue_1 = require("../queue/botQueue");
const logger_1 = require("@utils/logger");
const router = express_1.default.Router();
// Twilio posts application/x-www-form-urlencoded bodies
router.use(express_1.default.urlencoded({ extended: false }));
function validateTwilioSignature(req) {
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const enforce = env_1.env.enforceTwilioSignature;
    const host = req.get("host") || "";
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    const url = `${proto}://${host}${req.originalUrl}`;
    if (!enforce || !authToken) {
        return true;
    }
    const signature = req.headers["x-twilio-signature"] || "";
    if (!signature) {
        logger_1.logger.error("[Twilio Webhook] Missing X-Twilio-Signature header");
        return false;
    }
    try {
        const validator = twilio_1.default.validateRequest;
        if (typeof validator === "function") {
            const valid = validator(authToken, signature, url, req.body || {});
            if (valid)
                return true;
        }
    }
    catch (e) {
        // ignore
    }
    // Fallback manual check
    const params = req.body || {};
    const sortedKeys = Object.keys(params).sort();
    let data = url;
    for (const key of sortedKeys) {
        data += key + params[key];
    }
    const expected = crypto_1.default.createHmac("sha1", authToken).update(data).digest("base64");
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    }
    catch {
        return false;
    }
}
router.post("/", async (req, res) => {
    if (!validateTwilioSignature(req)) {
        return res.status(401).send("<Response></Response>");
    }
    const from = req.body?.From || "";
    const text = req.body?.Body || "";
    const numMediaStr = req.body?.NumMedia || "0";
    const numMedia = parseInt(numMediaStr, 10) || 0;
    const mediaUrls = [];
    if (numMedia > 0) {
        for (let i = 0; i < numMedia; i++) {
            const url = req.body?.[`MediaUrl${i}`];
            if (url)
                mediaUrls.push(url);
        }
    }
    logger_1.logger.info("[Twilio Webhook] Enqueuing job", { from, textShort: text.slice(0, 50), media: numMedia });
    // Add to Queue
    try {
        await botQueue_1.botQueue.add("whatsapp-msg", {
            from,
            text: text || (mediaUrls.length > 0 ? "IMAGE_MESSAGE" : ""),
            orderId: null, // logic to find orderId is inside handleIncomingBotMessage usually, or we pass null
            mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined
        });
        // Determine if we should send an immediate "typing" or "processing" status?
        // For now, just return 200 OK. Twilio expects TwiML or empty.
        // An empty response tells Twilio "We got it, no immediate reply".
        // We will reply asynchronously via the Worker.
        res.type("text/xml").send("<Response></Response>");
    }
    catch (err) {
        logger_1.logger.error("[Twilio Webhook] Failed to enqueue", { error: err?.message });
        res.status(500).send("Internal Error");
    }
});
exports.default = router;
