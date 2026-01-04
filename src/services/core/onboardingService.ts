import { randomUUID } from "crypto";
import { logger } from "@utils/logger";
import * as db from "./database";
import * as wawi from "../adapters/realInvenTreeAdapter";

/**
 * Onboarding Service
 * Orchestrates the setup of new Dealers (Tenants).
 */

export interface OnboardingState {
    step: 'identity' | 'communication' | 'inventory' | 'shop' | 'complete';
    tenantId?: string;
    data?: any;
}

// In-Memory State for the Wizard (Demo purpose)
const onboardingSessions = new Map<string, OnboardingState>();

export async function initializeOnboarding(name: string, email: string): Promise<{ sessionId: string, tenantId: string }> {
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
    const sessionId = randomUUID();

    // 2. Initialize Session
    onboardingSessions.set(sessionId, {
        step: 'identity',
        tenantId: tenantId,
        data: { name, email }
    });

    logger.info(`[Onboarding] Session started: ${sessionId} for Tenant: ${tenantId}`);

    return { sessionId, tenantId };
}

export async function configureTwilio(sessionId: string, phoneNumber: string, sid: string, token: string) {
    const session = onboardingSessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    // Mock Validation
    if (!phoneNumber.startsWith("+")) throw new Error("Invalid Phone Number format");

    // Save Settings
    await wawi.upsertMerchantSettings(session.tenantId!, {
        twilio_phone_number: phoneNumber,
        twilio_sid: sid,
        twilio_auth_token: token
    });

    session.step = 'communication';
    logger.info(`[Onboarding] Twilio configured for Tenant ${session.tenantId}`);
    return { success: true };
}

export async function importInventory(sessionId: string, csvData: string) {
    const session = onboardingSessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    // Mock CSV Parsing
    const lines = csvData.split('\n').filter(l => l.trim().length > 0);
    const headers = lines[0].split(',');
    const items = lines.slice(1);

    logger.info(`[Onboarding] Importing ${items.length} items for Tenant ${session.tenantId}`);

    let importedCount = 0;
    for (const line of items) {
        const cols = line.split(',');
        // Simple format: Name, Brand, OEM, Qty, Price
        if (cols.length < 3) continue;

        const [name, brand, oem, qtyStr, priceStr] = cols.map(c => c.trim());

        try {
            // Create Part
            const part = await wawi.createPart(session.tenantId!, {
                name: name,
                IPN: oem, // Use OEM as internal number
                description: `${brand} ${oem}`,
                active: true
            });

            // Add Stock
            if (part && part.pk) {
                await wawi.processStockAction(session.tenantId!, part.pk, 'add', Number(qtyStr) || 0);
            }
            importedCount++;
        } catch (err) {
            logger.warn(`[Onboarding] Import failed for line: ${line}`);
        }
    }

    session.step = 'inventory';
    return { imported: importedCount, total: items.length };
}

export async function connectShop(sessionId: string, shopType: 'shopify' | 'woocommerce', apiKey: string, shopUrl: string) {
    const session = onboardingSessions.get(sessionId);
    if (!session) throw new Error("Session not found");

    // Mock Connection Check
    if (!shopUrl.includes("http")) throw new Error("Invalid Shop URL");

    // Save Settings
    await wawi.upsertMerchantSettings(session.tenantId!, {
        shop_type: shopType,
        shop_url: shopUrl,
        shop_api_key: apiKey
    });

    // Register Mock Webhook
    logger.info(`[Onboarding] Webhook registered at ${shopUrl}/webhooks -> /api/integrations/shop/webhook`);

    session.step = 'complete';
    return { success: true, webhookUrl: "/api/integrations/shop/webhook" };
}
