/**
 * E2E BOT FLOW TESTS
 * 
 * Tests complete conversation flows from start to finish.
 */

// Skip real service initialization
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

// Mock all external services BEFORE imports
jest.mock('../intelligence/geminiService', () => ({
    generateChatCompletion: jest.fn(async () => JSON.stringify({
        action: 'collect_slots',
        reply: 'Mock AI reply',
        slots: {},
        required_slots: [],
        confidence: 0.9
    })),
    generateVisionCompletion: jest.fn()
}));

jest.mock('../adapters/supabaseService', () => ({
    insertMessage: jest.fn(() => Promise.resolve()),
    findOrCreateOrder: jest.fn(() => Promise.resolve({
        id: 'test-order-1',
        status: 'choose_language',
        language: null,
        orderData: {}
    })),
    getOrderById: jest.fn(() => Promise.resolve({ orderData: {} })),
    updateOrderData: jest.fn(() => Promise.resolve()),
    updateOrder: jest.fn(() => Promise.resolve()),
    getVehicleForOrder: jest.fn(() => Promise.resolve(null)),
    upsertVehicleForOrderFromPartial: jest.fn(() => Promise.resolve()),
    getMerchantSettings: jest.fn(() => Promise.resolve({ supportedLanguages: ['de', 'en'] })),
    listActiveOrdersByContact: jest.fn(() => Promise.resolve([]))
}));

// Mock OEM service
jest.mock('../intelligence/oemService', () => ({
    resolveOEM: jest.fn(() => Promise.resolve({
        primaryOEM: 'TEST-OEM-123',
        overall: 0.95,
        note: 'Test OEM'
    }))
}));

import { handleIncomingBotMessage } from '../core/botLogicService';
import * as supabase from '../adapters/supabaseService';
import { generateChatCompletion } from '../intelligence/geminiService';

describe('E2E Bot Flows', () => {
    const TEST_PHONE = '+4915112345678';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Language Selection Flow', () => {
        it('selects German when user sends "1"', async () => {
            (supabase.findOrCreateOrder as jest.Mock).mockResolvedValueOnce({
                id: 'order-lang-1',
                status: 'choose_language',
                language: null,
                orderData: {}
            });

            const result = await handleIncomingBotMessage({
                from: TEST_PHONE,
                text: '1'
            });

            expect(result.reply).toBeDefined();
            expect(result.orderId).toBe('order-lang-1');
            expect(supabase.updateOrder).toHaveBeenCalled();
        });

        it('selects English when user sends "2"', async () => {
            (supabase.findOrCreateOrder as jest.Mock).mockResolvedValueOnce({
                id: 'order-lang-2',
                status: 'choose_language',
                language: null,
                orderData: {}
            });

            const result = await handleIncomingBotMessage({
                from: TEST_PHONE,
                text: '2'
            });

            expect(result.reply).toBeDefined();
            expect(result.orderId).toBe('order-lang-2');
        });

        it('shows language menu for unrecognized input', async () => {
            (supabase.findOrCreateOrder as jest.Mock).mockResolvedValueOnce({
                id: 'order-lang-3',
                status: 'choose_language',
                language: null,
                orderData: {}
            });

            const result = await handleIncomingBotMessage({
                from: TEST_PHONE,
                text: 'hello'
            });

            expect(result.reply).toContain('Deutsch');
            expect(result.reply).toContain('English');
        });
    });

    describe('Vehicle Collection Flow', () => {
        it('stores vehicle info from text message', async () => {
            (supabase.findOrCreateOrder as jest.Mock).mockResolvedValueOnce({
                id: 'order-vehicle-1',
                status: 'collect_vehicle',
                language: 'de',
                orderData: {}
            });

            (generateChatCompletion as jest.Mock).mockResolvedValueOnce(JSON.stringify({
                action: 'collect_slots',
                reply: 'Super, ein VW Golf. Welches Teil brauchst du?',
                slots: { make: 'VW', model: 'Golf', year: 2019 },
                required_slots: [],
                confidence: 0.95
            }));

            const result = await handleIncomingBotMessage({
                from: TEST_PHONE,
                text: 'VW Golf 2019'
            });

            expect(result.reply).toBeDefined();
            expect(supabase.upsertVehicleForOrderFromPartial).toHaveBeenCalled();
        });
    });

    describe('Part Request Flow', () => {
        it('processes part request and triggers OEM lookup', async () => {
            (supabase.findOrCreateOrder as jest.Mock).mockResolvedValueOnce({
                id: 'order-part-1',
                status: 'collect_part',
                language: 'de',
                orderData: { requestedPart: null }
            });

            (supabase.getVehicleForOrder as jest.Mock).mockResolvedValueOnce({
                make: 'VW',
                model: 'Golf',
                year: 2019,
                vin: 'WVWZZZ1JZXW000001'
            });

            (generateChatCompletion as jest.Mock).mockResolvedValueOnce(JSON.stringify({
                action: 'oem_lookup',
                reply: 'Ich suche nach Bremsbelägen für deinen VW Golf...',
                slots: { requestedPart: 'Bremsbeläge vorne', position: 'front' },
                required_slots: [],
                confidence: 0.95
            }));

            const result = await handleIncomingBotMessage({
                from: TEST_PHONE,
                text: 'Bremsbeläge vorne'
            });

            expect(result.reply).toBeDefined();
            expect(supabase.updateOrderData).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('handles gracefully when Gemini fails', async () => {
            (supabase.findOrCreateOrder as jest.Mock).mockResolvedValueOnce({
                id: 'order-error-1',
                status: 'collect_vehicle',
                language: 'de',
                orderData: {}
            });

            (generateChatCompletion as jest.Mock).mockRejectedValueOnce(new Error('API timeout'));

            const result = await handleIncomingBotMessage({
                from: TEST_PHONE,
                text: 'Test message'
            });

            expect(result.reply).toBeDefined();
        });
    });
});
