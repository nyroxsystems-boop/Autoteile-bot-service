"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const botLogicService_1 = require("./services/botLogicService");
const wawi = __importStar(require("./services/inventreeAdapter"));
async function runValidation() {
    console.log("=== System Sync Validation ===");
    const waId = "whatsapp:+499876543210";
    // 1. Simulate Bot Interaction
    console.log("[1/3] Simulating Bot message...");
    const res1 = await (0, botLogicService_1.handleIncomingBotMessage)({
        from: waId,
        text: "Hallo, ich brauche Bremsen für Audi A4 2018. VIN: WAUZZZ8K...",
    });
    console.log("Bot Reply:", res1.reply);
    // 2. Confirm Vehicle (to move state forward)
    console.log("[2/3] Confirming vehicle...");
    const res2 = await (0, botLogicService_1.handleIncomingBotMessage)({
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
        }
        else {
            console.log("FAILURE: Vehicle data missing or incorrect.");
        }
    }
    else {
        console.log("FAILURE: Order not found in WAWI adapter.");
    }
    console.log("=== Validation Finished ===");
}
runValidation().catch(err => {
    console.error("Validation failed:", err);
    process.exit(1);
});
