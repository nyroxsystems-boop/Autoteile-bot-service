import { Queue } from "bullmq";
import { connection } from "./connection";

export const BOT_QUEUE_NAME = "bot-message-queue";

export const botQueue = new Queue(BOT_QUEUE_NAME, {
    connection
});

export interface BotJobData {
    from: string;
    text: string;
    orderId?: string | null;
    mediaUrls?: string[];
}
