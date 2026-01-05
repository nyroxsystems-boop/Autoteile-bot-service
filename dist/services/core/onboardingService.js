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
exports.initializeOnboarding = initializeOnboarding;
exports.configureTwilio = configureTwilio;
exports.importInventory = importInventory;
exports.connectShop = connectShop;
const crypto_1 = require("crypto");
const logger_1 = require("@utils/logger");
const wawi = __importStar(require("../adapters/realInvenTreeAdapter"));
// In-Memory State for the Wizard (Demo purpose)
const onboardingSessions = new Map();
async function initializeOnboarding(name, email) {
    // 1. Create Tenant (Company in InvenTree)
    const company = await wawi.createCompany({
        name: name,
        email: email,
        is_customer: true,
        is_supplier: false,
        active: true,
        description: "Onboarding via Wizard"
    });
    const tenantId = String(company.pk);
    const sessionId = (0, crypto_1.randomUUID)();
    // 2. Initialize Session
    onboardingSessions.set(sessionId, {
        step: 'identity',
        tenantId: tenantId,
        data: { name, email }
    });
    logger_1.logger.info(`[Onboarding] Session started: ${sessionId} for Tenant: ${tenantId}`);
    return { sessionId, tenantId };
}
async function configureTwilio(sessionId, phoneNumber, sid, token) {
    const session = onboardingSessions.get(sessionId);
    if (!session)
        throw new Error("Session not found");
    // Mock Validation
    if (!phoneNumber.startsWith("+"))
        throw new Error("Invalid Phone Number format");
    // Save Settings
    await wawi.upsertMerchantSettings(session.tenantId, {
        twilio_phone_number: phoneNumber,
        twilio_sid: sid,
        twilio_auth_token: token
    });
    session.step = 'communication';
    logger_1.logger.info(`[Onboarding] Twilio configured for Tenant ${session.tenantId}`);
    return { success: true };
}
async function importInventory(sessionId, csvData) {
    const session = onboardingSessions.get(sessionId);
    if (!session)
        throw new Error("Session not found");
    // Mock CSV Parsing
    const lines = csvData.split('\n').filter(l => l.trim().length > 0);
    const headers = lines[0].split(',');
    const items = lines.slice(1);
    logger_1.logger.info(`[Onboarding] Importing ${items.length} items for Tenant ${session.tenantId}`);
    let importedCount = 0;
    for (const line of items) {
        const cols = line.split(',');
        // Simple format: Name, Brand, OEM, Qty, Price
        if (cols.length < 3)
            continue;
        const [name, brand, oem, qtyStr, priceStr] = cols.map(c => c.trim());
        try {
            // Create Part
            const part = await wawi.createPart(session.tenantId, {
                name: name,
                IPN: oem, // Use OEM as internal number
                description: `${brand} ${oem}`,
                active: true
            });
            // Add Stock
            if (part && part.pk) {
                await wawi.processStockAction(session.tenantId, part.pk, 'add', Number(qtyStr) || 0);
            }
            importedCount++;
        }
        catch (err) {
            logger_1.logger.warn(`[Onboarding] Import failed for line: ${line}`);
        }
    }
    session.step = 'inventory';
    return { imported: importedCount, total: items.length };
}
async function connectShop(sessionId, shopType, apiKey, shopUrl) {
    const session = onboardingSessions.get(sessionId);
    if (!session)
        throw new Error("Session not found");
    // Mock Connection Check
    if (!shopUrl.includes("http"))
        throw new Error("Invalid Shop URL");
    // Save Settings
    await wawi.upsertMerchantSettings(session.tenantId, {
        shop_type: shopType,
        shop_url: shopUrl,
        shop_api_key: apiKey
    });
    // Register Mock Webhook
    logger_1.logger.info(`[Onboarding] Webhook registered at ${shopUrl}/webhooks -> /api/integrations/shop/webhook`);
    session.step = 'complete';
    return { success: true, webhookUrl: "/api/integrations/shop/webhook" };
}
