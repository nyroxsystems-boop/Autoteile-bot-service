"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const botLogicService_1 = require("./botLogicService");
// Mock the OpenAI wrapper and supabase service functions used by the handler
jest.mock('./openAiService', () => ({
    generateChatCompletion: jest.fn()
}));
jest.mock('./supabaseService', () => ({
    insertMessage: jest.fn(() => Promise.resolve()),
    findOrCreateOrder: jest.fn(() => Promise.resolve({ id: 'order-1', status: 'collect_vehicle', language: null })),
    getOrderById: jest.fn(() => Promise.resolve({ orderData: {} })),
    updateOrderData: jest.fn(() => Promise.resolve()),
    updateOrder: jest.fn(() => Promise.resolve()),
    getVehicleForOrder: jest.fn(() => Promise.resolve(null))
}));
const openAiService_1 = require("./openAiService");
describe('orchestrator-first handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('returns orchestrator ask_slot reply and persists slots best-effort', async () => {
        const orchResponse = JSON.stringify({
            action: 'ask_slot',
            reply: 'Welche Automarke ist es?',
            slots: { requestedPart: null },
            required_slots: ['make'],
            confidence: 0.98
        });
        openAiService_1.generateChatCompletion.mockResolvedValue(orchResponse);
        const payload = { from: 'user-1', text: 'Hi', mediaUrls: [] };
        const res = await (0, botLogicService_1.handleIncomingBotMessage)(payload);
        expect(res).toBeDefined();
        expect(res.reply).toBe('Welche Automarke ist es?');
        // generateChatCompletion (orchestrator) should have been invoked
        expect(openAiService_1.generateChatCompletion).toHaveBeenCalled();
    });
});
