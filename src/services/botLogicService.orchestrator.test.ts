import { handleIncomingBotMessage } from './core/botLogicService';

// Mock the Gemini wrapper and supabase service functions used by the handler
jest.mock('./intelligence/geminiService', () => ({
  generateChatCompletion: jest.fn(),
  generateVisionCompletion: jest.fn()
}));

jest.mock('./adapters/supabaseService', () => ({
  insertMessage: jest.fn(() => Promise.resolve()),
  findOrCreateOrder: jest.fn(() => Promise.resolve({ id: 'order-1', status: 'collect_vehicle', language: null })),
  getOrderById: jest.fn(() => Promise.resolve({ orderData: {} })),
  updateOrderData: jest.fn(() => Promise.resolve()),
  updateOrder: jest.fn(() => Promise.resolve()),
  getVehicleForOrder: jest.fn(() => Promise.resolve(null)),
  getMerchantSettings: jest.fn(() => Promise.resolve({ supportedLanguages: ['de', 'en'] })),
  listActiveOrdersByContact: jest.fn(() => Promise.resolve([]))
}));

import { generateChatCompletion } from './intelligence/geminiService';
import * as supa from './adapters/supabaseService';

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

    (generateChatCompletion as jest.Mock).mockResolvedValue(orchResponse);

    const payload = { from: 'user-1', text: 'Hi', mediaUrls: [] };

    const res = await handleIncomingBotMessage(payload as any);

    expect(res).toBeDefined();
    expect(res.reply).toBe('Welche Automarke ist es?');

    // generateChatCompletion (orchestrator) should have been invoked
    expect(generateChatCompletion).toHaveBeenCalled();
  });
});
