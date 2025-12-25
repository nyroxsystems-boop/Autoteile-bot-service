import { handleIncomingBotMessage } from './services/botLogicService';
import { createDashboardRouter } from './routes/dashboardRoutes';
import { logger } from './utils/logger';
import * as wawi from './services/inventreeAdapter';

async function runValidation() {
    console.log("=== Fast System Sync Validation ===");

    const waId = "whatsapp:+4912345678";

    // 1. Simulate Bot Interaction (Vague)
    console.log("[1/2] Sending vague message...");
    const res1 = await handleIncomingBotMessage({
        from: waId,
        text: "Hallo, ich brauche Hilfe.",
    });
    console.log("Bot Reply:", res1.reply);

    // 2. Add some data
    console.log("[2/2] Providing partial vehicle...");
    const res2 = await handleIncomingBotMessage({
        from: waId,
        text: "Ich fahre einen Audi A4.",
        orderId: res1.orderId
    });
    console.log("Bot Reply:", res2.reply);

    // 3. Validate Dashboard Sync
    const orders = await wawi.listOrders();
    console.log(`Orders in DB: ${orders.length}`);

    const targetOrder = orders.find(o => o.customerContact === waId);
    if (targetOrder) {
        console.log("SUCCESS: Order persisted.");
        console.log("Current Status:", targetOrder.status);
    } else {
        console.log("FAILURE: Order not persisted.");
    }

    console.log("=== Validation Finished ===");
}

runValidation().catch(err => {
    console.error("Validation failed:", err);
    process.exit(1);
});
