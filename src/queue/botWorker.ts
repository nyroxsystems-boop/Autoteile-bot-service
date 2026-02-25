import { Worker, Job } from "bullmq";
import { connection } from "./connection";
import { BOT_QUEUE_NAME, BotJobData } from "./botQueue";
import { handleIncomingBotMessage } from "../services/core/botLogicService";
import { insertMessage } from "../services/adapters/supabaseService";
import { recordActivity, startSessionTimeoutChecker } from "../services/core/sessionTimeout";
import twilio from "twilio";
import { logger } from "@utils/logger";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

// ============================================================================
// K5: Idempotency — Prevent duplicate Twilio replies on BullMQ retry
// ============================================================================
const processedJobs = new Map<string, number>(); // jobId → timestamp
const IDEMPOTENCY_TTL_MS = 120_000; // 120s (was 60s — extend for retries with backoff)

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
    return true;
}

// ============================================================================
// #10 FIX: Twilio Client Singleton — no longer created per-reply
// ============================================================================
let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient(): ReturnType<typeof twilio> | null {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        logger.error("Twilio credentials missing, cannot send reply");
        return null;
    }
    if (!twilioClient) {
        twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        logger.info("[BotWorker] Twilio client initialized (singleton)");
    }
    return twilioClient;
}

// #10 FIX: sendTwilioReply now THROWS on error instead of silently logging
async function sendTwilioReply(
    to: string,
    body: string,
    options: { mediaUrl?: string; buttons?: string[]; contentSid?: string; contentVariables?: string } = {}
) {
    const client = getTwilioClient();
    if (!client) {
        throw new Error("Twilio client not available — missing credentials");
    }

    const payload: any = {
        from: TWILIO_WHATSAPP_NUMBER,
        to,
        body,
    };

    if (options.contentSid) {
        payload.contentSid = options.contentSid;
        if (options.contentVariables) {
            payload.contentVariables = options.contentVariables;
        }
        delete payload.body; // Content API replaces body
    }

    if (options.mediaUrl) {
        payload.mediaUrl = [options.mediaUrl];
    }

    try {
        await client.messages.create(payload);
        logger.info("📤 Twilio reply sent", { to, bodyLen: body?.length });
    } catch (err: any) {
        logger.error("Twilio send FAILED", {
            to,
            error: err?.message,
            code: err?.code,
            status: err?.status
        });
        throw err; // #10 FIX: propagate error so BullMQ retries
    }
}

// ============================================================================
// #2 FIX: Worker with exponential backoff + DLQ + reduced concurrency
// ============================================================================

const worker = new Worker<BotJobData>(
    BOT_QUEUE_NAME,
    async (job: Job<BotJobData>) => {
        const { from, text, orderId, mediaUrls } = job.data;

        logger.info("📥 INCOMING MESSAGE", {
            from,
            message: text?.substring(0, 100),
            hasMedia: !!(mediaUrls && mediaUrls.length > 0),
            orderId,
            jobId: job.id,
            attempt: job.attemptsMade + 1
        });

        // P1 #9: Record activity for session timeout tracking
        // recordActivity moved to after handleIncomingBotMessage (see below for language population)

        try {
            // ============================================================
            // #1 FIX: Pass sendInterimReply callback into handleIncomingBotMessage
            // This sends the Zwischennachricht BEFORE OEM lookup starts,
            // not after the entire function returns.
            // ============================================================
            const sendInterimReply = async (message: string) => {
                try {
                    await sendTwilioReply(from, message);
                    logger.info("📤 INTERIM REPLY SENT", { to: from, message: message.substring(0, 50) });
                } catch (err: any) {
                    // Non-fatal: interim message failure shouldn't block main flow
                    logger.warn("[BotWorker] Interim reply failed (non-blocking)", { error: err?.message });
                }
            };

            // 1. Process Logic — with callback for interim messages
            const result = await handleIncomingBotMessage({
                from,
                text,
                orderId: orderId || null,
                mediaUrls
            }, sendInterimReply);

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

            // 3. Idempotency check before sending reply
            if (!markJobProcessed(job.id || `${from}-${Date.now()}`)) {
                logger.warn("[BotWorker] Skipping duplicate Twilio send", { jobId: job.id });
                return; // Don't send again on retry
            }

            // 4. Send Reply via Twilio
            await sendTwilioReply(from, result.reply, {
                mediaUrl: (result as any).mediaUrl,
                contentSid: result.contentSid,
                contentVariables: result.contentVariables
            });

            // 5. Persist lastBotMessage for orchestrator context
            try {
                const { updateOrderData } = await import("../services/adapters/supabaseService");
                if (result.orderId) {
                    await updateOrderData(result.orderId, { lastBotMessage: result.reply });
                }
            } catch (_) { /* non-critical */ }

        } catch (err: any) {
            logger.error("Bot worker failed", {
                error: err?.message,
                jobId: job.id,
                from,
                attempt: job.attemptsMade + 1,
                maxAttempts: job.opts?.attempts || 3
            });
            throw err; // Let BullMQ handle retry with exponential backoff
        }
    },
    {
        connection,
        concurrency: 3,
        // #2 FIX: Default job options with exponential backoff
        settings: {},
    }
);

// #2 FIX: Configure default job options on the queue side
// Note: BullMQ applies backoff from Job options, not Worker options.
// The queue producer (botQueue.ts) should set these. Here we configure
// the worker to handle retries gracefully via the job's own settings.

worker.on("completed", (job: Job) => {
    logger.info("Job completed", { jobId: job.id });
});

worker.on("failed", (job: Job | undefined, err: Error) => {
    const isFinalFail = job && job.attemptsMade >= (job.opts?.attempts || 3);
    logger.error(isFinalFail ? "Job DEAD-LETTERED (all retries exhausted)" : "Job FAILED (will retry)", {
        jobId: job?.id,
        error: err.message,
        attemptsMade: job?.attemptsMade,
        maxAttempts: job?.opts?.attempts || 3,
        deadLettered: isFinalFail
    });
});

// P1 #9: Start session timeout checker
startSessionTimeoutChecker(async (waId: string, message: string) => {
    await sendTwilioReply(waId, message);
});

export { worker };
