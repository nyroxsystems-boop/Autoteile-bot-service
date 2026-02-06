/**
 * E2E TEST HARNESS
 * 
 * Provides a complete test environment for end-to-end bot conversation testing.
 * Mocks all external services (Twilio, Supabase, OEM resolvers) to allow
 * deterministic, fast testing of complete conversation flows.
 */

import { handleIncomingBotMessage } from '../core/botLogicService';
import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface MockMessage {
    from: string;
    text: string;
    mediaUrls?: string[];
}

export interface BotResponse {
    reply: string;
    orderId: string;
    mediaUrl?: string;
    buttons?: string[];
}

export interface ConversationFlow {
    name: string;
    messages: MockMessage[];
    expectedStates?: string[];
    assertions?: ((responses: BotResponse[]) => void)[];
}

export interface TestContext {
    orderId: string;
    language: string;
    status: string;
    vehicleData: any;
    orderData: any;
}

// ============================================================================
// Mock Twilio Adapter
// ============================================================================

export class MockTwilioAdapter {
    private downloadedMedia: Map<string, Buffer> = new Map();

    setMediaResponse(url: string, buffer: Buffer): void {
        this.downloadedMedia.set(url, buffer);
    }

    async downloadMedia(url: string): Promise<Buffer> {
        const buffer = this.downloadedMedia.get(url);
        if (!buffer) {
            throw new Error(`No mock media for URL: ${url}`);
        }
        return buffer;
    }
}

// ============================================================================
// Mock Supabase Adapter
// ============================================================================

export class MockSupabaseAdapter {
    private orders: Map<string, any> = new Map();
    private vehicles: Map<string, any> = new Map();
    private messages: any[] = [];
    private offers: Map<string, any[]> = new Map();

    async findOrCreateOrder(from: string): Promise<any> {
        const existing = Array.from(this.orders.values()).find(o => o.customerContact === from);
        if (existing) return existing;

        const id = `test-order-${Date.now()}`;
        const order = {
            id,
            customerContact: from,
            status: 'choose_language',
            language: null,
            orderData: {}
        };
        this.orders.set(id, order);
        return order;
    }

    async updateOrder(orderId: string, patch: any): Promise<any> {
        const order = this.orders.get(orderId);
        if (!order) throw new Error(`Order not found: ${orderId}`);
        Object.assign(order, patch);
        return order;
    }

    async updateOrderData(orderId: string, data: any): Promise<void> {
        const order = this.orders.get(orderId);
        if (!order) throw new Error(`Order not found: ${orderId}`);
        order.orderData = { ...order.orderData, ...data };
    }

    async upsertVehicle(orderId: string, partial: any): Promise<void> {
        const existing = this.vehicles.get(orderId) || {};
        this.vehicles.set(orderId, { ...existing, ...partial });
    }

    async getVehicle(orderId: string): Promise<any> {
        return this.vehicles.get(orderId) || null;
    }

    async insertMessage(msg: any): Promise<void> {
        this.messages.push(msg);
    }

    async insertOffers(orderId: string, offers: any[]): Promise<void> {
        this.offers.set(orderId, offers);
    }

    async getOffers(orderId: string): Promise<any[]> {
        return this.offers.get(orderId) || [];
    }

    // Test utilities
    getOrder(orderId: string): any { return this.orders.get(orderId); }
    getAllOrders(): any[] { return Array.from(this.orders.values()); }
    getAllMessages(): any[] { return this.messages; }
    reset(): void {
        this.orders.clear();
        this.vehicles.clear();
        this.messages = [];
        this.offers.clear();
    }
}

// ============================================================================
// Mock OEM Resolver
// ============================================================================

export class MockOemResolver {
    private responses: Map<string, any> = new Map();

    setResponse(partKey: string, response: any): void {
        this.responses.set(partKey.toLowerCase(), response);
    }

    async resolve(vehicle: any, part: string): Promise<any> {
        const key = part.toLowerCase();
        const response = this.responses.get(key);
        if (response) return response;

        // Default mock response
        return {
            primaryOEM: 'MOCK-OEM-12345',
            overall: 0.95,
            note: 'Mock OEM (test)',
            candidates: [{ oem: 'MOCK-OEM-12345', confidence: 0.95, source: 'mock' }]
        };
    }
}

// ============================================================================
// Bot Test Harness
// ============================================================================

export class BotTestHarness {
    public twilioAdapter: MockTwilioAdapter;
    public supabaseAdapter: MockSupabaseAdapter;
    public oemResolver: MockOemResolver;

    private responses: BotResponse[] = [];

    constructor() {
        this.twilioAdapter = new MockTwilioAdapter();
        this.supabaseAdapter = new MockSupabaseAdapter();
        this.oemResolver = new MockOemResolver();
    }

    /**
     * Send a message through the bot and capture the response.
     */
    async sendMessage(msg: MockMessage): Promise<BotResponse> {
        logger.info('[E2E] Sending message', { from: msg.from, text: msg.text });

        try {
            const result = await handleIncomingBotMessage({
                from: msg.from,
                text: msg.text,
                channel: 'whatsapp',
                mediaUrls: msg.mediaUrls
            });

            const response: BotResponse = {
                reply: result.reply,
                orderId: result.orderId,
                mediaUrl: result.mediaUrl,
                buttons: result.buttons
            };

            this.responses.push(response);
            logger.info('[E2E] Got response', { reply: response.reply.slice(0, 100) });

            return response;
        } catch (err: any) {
            logger.error('[E2E] Bot error', { error: err.message });
            throw err;
        }
    }

    /**
     * Run a complete conversation flow.
     */
    async runFlow(flow: ConversationFlow): Promise<BotResponse[]> {
        logger.info(`[E2E] Running flow: ${flow.name}`);
        this.responses = [];

        for (const msg of flow.messages) {
            await this.sendMessage(msg);
        }

        // Run assertions if provided
        if (flow.assertions) {
            for (const assertion of flow.assertions) {
                assertion(this.responses);
            }
        }

        return this.responses;
    }

    /**
     * Get current test context.
     */
    async getContext(from: string): Promise<TestContext | null> {
        const orders = this.supabaseAdapter.getAllOrders();
        const order = orders.find(o => o.customerContact === from);
        if (!order) return null;

        const vehicle = await this.supabaseAdapter.getVehicle(order.id);

        return {
            orderId: order.id,
            language: order.language,
            status: order.status,
            vehicleData: vehicle,
            orderData: order.orderData
        };
    }

    /**
     * Reset all mocks for fresh test.
     */
    reset(): void {
        this.supabaseAdapter.reset();
        this.responses = [];
    }

    getResponses(): BotResponse[] {
        return this.responses;
    }
}

// ============================================================================
// Common Test Flows
// ============================================================================

export const COMMON_FLOWS = {
    happyPath: {
        name: 'Happy Path - German User Orders Brake Pads',
        messages: [
            { from: '+4915112345678', text: '1' },  // Select German
            { from: '+4915112345678', text: 'VW Golf 2019 2.0 TDI' },  // Vehicle info
            { from: '+4915112345678', text: 'Bremsbeläge vorne' }  // Request part
        ]
    } as ConversationFlow,

    englishUser: {
        name: 'English User Flow',
        messages: [
            { from: '+447911123456', text: '2' },  // Select English
            { from: '+447911123456', text: 'BMW 320d 2018' },
            { from: '+447911123456', text: 'Front brake pads' }
        ]
    } as ConversationFlow,

    partChange: {
        name: 'User Changes Part Mid-Flow',
        messages: [
            { from: '+4915187654321', text: '1' },
            { from: '+4915187654321', text: 'Audi A4 2020' },
            { from: '+4915187654321', text: 'Bremsbeläge' },
            { from: '+4915187654321', text: 'Ne doch lieber Bremsscheiben' }  // Change mind
        ]
    } as ConversationFlow
};
