import { Queue } from "bullmq";
import { connection } from "./connection";

export const BOT_QUEUE_NAME = "bot-message-queue";

export const botQueue = new Queue(BOT_QUEUE_NAME, {
    connection,
    // #2 FIX: Exponential backoff + DLQ — prevents retry storms & credit waste
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000, // 2s → 4s → 8s
        },
        removeOnComplete: { count: 100 },  // Keep last 100 completed
        removeOnFail: { count: 500 },      // Keep last 500 failed (DLQ visibility)
    },
});

export interface BotJobData {
    from: string;
    text: string;
    orderId?: string | null;
    mediaUrls?: string[];
}
