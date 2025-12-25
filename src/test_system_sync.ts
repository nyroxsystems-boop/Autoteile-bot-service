import { handleIncomingBotMessage } from './services/botLogicService';
import { createDashboardRouter } from './routes/dashboardRoutes';
import { logger } from './utils/logger';
import * as wawi from './services/inventreeAdapter';

async function runValidation() {
    console.log("=== System Sync Validation ===");

    const waId = "whatsapp:+499876543210";

    // 1. Simulate Bot Interaction
    console.log("[1/3] Simulating Bot message...");
    const res1 = await handleIncomingBotMessage({
        from: waId,
        text: "Hallo, ich brauche Bremsen für Audi A4 2018. VIN: WAUZZZ8K...",
    });
    console.log("Bot Reply:", res1.reply);

    // 2. Confirm Vehicle (to move state forward)
    console.log("[2/3] Confirming vehicle...");
    const res2 = await handleIncomingBotMessage({
        from: waId,
        text: "Ja",
        orderId: res1.orderId
    });
    console.log("Bot Reply after confirmation:", res2.reply);

    // 3. Validate Dashboard Sync (Internal Call)
    console.log("[3/3] Validating Dashboard sync...");
    const orders = await wawi.listOrders();
    console.log(`Orders in DB: ${orders.length}`);

    const targetOrder = orders.find(o => o.customerContact === waId);
    if (targetOrder) {
        console.log("SUCCESS: Order found in WAWI adapter list.");
        console.log("Order Status:", targetOrder.status);
        console.log("Order Data:", JSON.stringify(targetOrder.orderData));

        // Check if vehicle was persisted
        const vehicle = await wawi.getVehicleForOrder(targetOrder.id);
        if (vehicle && vehicle.make === "Audi") {
            console.log("SUCCESS: Vehicle data persisted correctly.");
        } else {
            console.log("FAILURE: Vehicle data missing or incorrect.");
        }
    } else {
        console.log("FAILURE: Order not found in WAWI adapter.");
    }

    console.log("=== Validation Finished ===");
}

runValidation().catch(err => {
    console.error("Validation failed:", err);
    process.exit(1);
});
