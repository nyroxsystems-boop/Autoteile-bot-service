import { Worker, Job } from "bullmq";
import { connection } from "./connection";
import { BOT_QUEUE_NAME, BotJobData } from "./botQueue";
import { handleIncomingBotMessage } from "../services/botLogicService";
import { insertMessage } from "../services/supabaseService";
import twilio from "twilio";
import { logger } from "../utils/logger";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886";

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
        logger.info("Sent WhatsApp reply via Twilio", {
            to,
            hasMedia: !!options.mediaUrl,
            contentSid: options.contentSid
        });
    } catch (error: any) {
        logger.error("Failed to send WhatsApp reply", { error: error?.message, to });
    }
}

const worker = new Worker<BotJobData>(
    BOT_QUEUE_NAME,
    async (job: Job<BotJobData>) => {
        const { from, text, orderId, mediaUrls } = job.data;
        logger.info("Processing bot job", { jobId: job.id, from });

        try {
            // 1. Process Logic
            const result = await handleIncomingBotMessage({
                from,
                text,
                orderId: orderId || null,
                mediaUrls
            });

            // 2. Persist Reply
            try {
                // InvenTree insertMessage(waId, content, direction)
                await insertMessage(from, result.reply, "OUT" as any);
            } catch (dbErr: any) {
                logger.warn("Failed to persist outgoing bot message", { error: dbErr?.message });
            }

            // 3. Send Reply via Twilio
            await sendTwilioReply(from, result.reply, {
                mediaUrl: (result as any).mediaUrl,
                contentSid: result.contentSid,
                contentVariables: result.contentVariables
            });

        } catch (err: any) {
            logger.error("Bot worker failed", { error: err?.message, jobId: job.id });
            // Depending on error, we might want to fail the job so it retries?
            // For now, let's catch it so the worker doesn't crash, but maybe rethrow if it's transient.
            throw err;
        }
    },
    {
        connection,
        concurrency: 5 // concurrency setting
    }
);

worker.on("completed", (job: Job) => {
    logger.info("Job completed", { jobId: job.id });
});

worker.on("failed", (job: Job | undefined, err: Error) => {
    logger.error("Job failed", { jobId: job?.id, error: err.message });
});

export { worker };
