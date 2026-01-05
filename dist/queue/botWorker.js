"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.worker = void 0;
const bullmq_1 = require("bullmq");
const connection_1 = require("./connection");
const botQueue_1 = require("./botQueue");
const botLogicService_1 = require("../services/core/botLogicService");
const supabaseService_1 = require("../services/adapters/supabaseService");
const twilio_1 = __importDefault(require("twilio"));
const logger_1 = require("@utils/logger");
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";
async function sendTwilioReply(to, body, options = {}) {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        logger_1.logger.error("Twilio credentials missing, cannot send reply");
        return;
    }
    const client = (0, twilio_1.default)(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    try {
        const payload = {
            from: TWILIO_WHATSAPP_NUMBER,
            to,
        };
        if (options.contentSid) {
            payload.contentSid = options.contentSid;
            if (options.contentVariables) {
                payload.contentVariables = options.contentVariables;
            }
        }
        else {
            payload.body = body;
            if (options.mediaUrl) {
                payload.mediaUrl = [options.mediaUrl];
            }
        }
        await client.messages.create(payload);
        logger_1.logger.info("Sent WhatsApp reply via Twilio", {
            to,
            hasMedia: !!options.mediaUrl,
            contentSid: options.contentSid
        });
    }
    catch (error) {
        logger_1.logger.error("Failed to send WhatsApp reply", { error: error?.message, to });
    }
}
const worker = new bullmq_1.Worker(botQueue_1.BOT_QUEUE_NAME, async (job) => {
    const { from, text, orderId, mediaUrls } = job.data;
    logger_1.logger.info("Processing bot job", { jobId: job.id, from });
    try {
        // 1. Process Logic
        const result = await (0, botLogicService_1.handleIncomingBotMessage)({
            from,
            text,
            orderId: orderId || null,
            mediaUrls
        });
        // 2. Persist Reply
        try {
            // InvenTree insertMessage(waId, content, direction)
            await (0, supabaseService_1.insertMessage)(from, result.reply, "OUT");
        }
        catch (dbErr) {
            logger_1.logger.warn("Failed to persist outgoing bot message", { error: dbErr?.message });
        }
        // 3. Send Reply via Twilio
        await sendTwilioReply(from, result.reply, {
            mediaUrl: result.mediaUrl,
            contentSid: result.contentSid,
            contentVariables: result.contentVariables
        });
    }
    catch (err) {
        logger_1.logger.error("Bot worker failed", { error: err?.message, jobId: job.id });
        // Depending on error, we might want to fail the job so it retries?
        // For now, let's catch it so the worker doesn't crash, but maybe rethrow if it's transient.
        throw err;
    }
}, {
    connection: connection_1.connection,
    concurrency: 5 // concurrency setting
});
exports.worker = worker;
worker.on("completed", (job) => {
    logger_1.logger.info("Job completed", { jobId: job.id });
});
worker.on("failed", (job, err) => {
    logger_1.logger.error("Job failed", { jobId: job?.id, error: err.message });
});
