import { Worker, Job } from "bullmq";
import { connection } from "./connection";
import { BOT_QUEUE_NAME, BotJobData } from "./botQueue";
import { handleIncomingBotMessage } from "../services/core/botLogicService";
import { insertMessage } from "../services/adapters/supabaseService";
import twilio from "twilio";
import { logger } from "@utils/logger";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

// ============================================================================
// K5: Idempotency — Prevent duplicate Twilio replies on BullMQ retry
// ============================================================================
const processedJobs = new Map<string, number>(); // jobId → timestamp
const IDEMPOTENCY_TTL_MS = 60_000; // 60s

function markJobProcessed(jobId: string): boolean {
    // Clean expired entries
    const now = Date.now();
    for (const [id, ts] of processedJobs) {
        if (now - ts > IDEMPOTENCY_TTL_MS) processedJobs.delete(id);
    }

    if (processedJobs.has(jobId)) {
        logger.warn("[BotWorker] Duplicate job detected, skipping Twilio reply", { jobId });
        return false; // already processed
    }
    processedJobs.set(jobId, now);
    return true; // first time
}

// ============================================================================
// Twilio Reply
// ============================================================================

async function sendTwilioReply(
    to: string,
    body: string,
    options: { mediaUrl?: string; buttons?: string[]; contentSid?: string; contentVariables?: string } = {}
) {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        logger.error("Twilio credentials missing, cannot send reply");
        return;
    }
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    try {
        const payload: any = {
            from: TWILIO_WHATSAPP_NUMBER,
            to,
        };

        if (options.contentSid) {
            payload.contentSid = options.contentSid;
            if (options.contentVariables) {
                payload.contentVariables = options.contentVariables;
            }
        } else {
            payload.body = body;
            if (options.mediaUrl) {
                payload.mediaUrl = [options.mediaUrl];
            }
        }

        await client.messages.create(payload);

        // S4 FIX: console.log → logger.info
        logger.info("📤 BOT REPLY SENT", {
            to,
            message: payload.body?.substring(0, 100) || "[template message]",
            hasMedia: !!options.mediaUrl,
            contentSid: options.contentSid
        });
    } catch (error: any) {
        // S4 FIX: console.error → logger.error
        logger.error("❌ FAILED TO SEND WHATSAPP REPLY", { error: error?.message, to });
    }
}

// ============================================================================
// K3: Worker with exponential backoff + reduced concurrency
// ============================================================================

const worker = new Worker<BotJobData>(
    BOT_QUEUE_NAME,
    async (job: Job<BotJobData>) => {
        const { from, text, orderId, mediaUrls } = job.data;

        // S4 FIX: console.log → logger.info
        logger.info("📥 INCOMING MESSAGE", {
            from,
            message: text?.substring(0, 100),
            hasMedia: !!(mediaUrls && mediaUrls.length > 0),
            orderId,
            jobId: job.id
        });

        try {
            // 1. Process Logic
            const result = await handleIncomingBotMessage({
                from,
                text,
                orderId: orderId || null,
                mediaUrls
            });

            // S4 FIX: console.log → logger.info
            logger.info("🤖 BOT GENERATED REPLY", {
                replyLength: result.reply?.length,
                replyPreview: result.reply?.substring(0, 150),
                hasContentSid: !!result.contentSid,
                orderId: result.orderId
            });

            // 2. Persist Reply
            try {
                await insertMessage(from, result.reply, "OUT" as any);
            } catch (dbErr: any) {
                logger.warn("Failed to persist outgoing bot message", { error: dbErr?.message });
            }

            // 3. K5: Idempotency check before sending reply
            if (!markJobProcessed(job.id || `${from}-${Date.now()}`)) {
                logger.warn("[BotWorker] Skipping duplicate Twilio send", { jobId: job.id });
                return; // Don't send again on retry
            }

            // 3.5 P0 #1: Send Zwischennachricht (preReply) if present
            if ((result as any).preReply) {
                await sendTwilioReply(from, (result as any).preReply);
                logger.info("📤 PRE-REPLY SENT (searching...)", { to: from });
            }

            // 4. Send Reply via Twilio
            await sendTwilioReply(from, result.reply, {
                mediaUrl: (result as any).mediaUrl,
                contentSid: result.contentSid,
                contentVariables: result.contentVariables
            });

        } catch (err: any) {
            logger.error("Bot worker failed", { error: err?.message, jobId: job.id, from });
            throw err; // Let BullMQ handle retry with backoff
        }
    },
    {
        connection,
        concurrency: 3 // K3 FIX: reduced from 5 → 3
    }
);

worker.on("completed", (job: Job) => {
    logger.info("Job completed", { jobId: job.id });
});

worker.on("failed", (job: Job | undefined, err: Error) => {
    logger.error("Job FAILED (will retry if attempts remain)", {
        jobId: job?.id,
        error: err.message,
        attemptsMade: job?.attemptsMade,
        maxAttempts: job?.opts?.attempts || 'default'
    });
});

export { worker };
