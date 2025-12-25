// Integration-style unit test for orchestrator -> OEM -> scrape flow
// Mocks orchestrator (openAiService), oemService and scrapingService and asserts handler triggers them.

// Ensure OpenAI client initialization doesn't throw in tests
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

// Mock openAiService to return an oem_lookup action with slots
jest.mock('./openAiService', () => ({
  generateChatCompletion: jest.fn(async () =>
    JSON.stringify({
      action: 'oem_lookup',
      reply: 'Perfekt, ich habe genug Infos.',
      slots: {
        make: 'VW',
        model: 'Golf',
        year: 2015,
        engine: '2.0 TDI',
        vin: 'WVWZZZ1JZXW000001',
        requestedPart: 'Bremsscheiben vorne',
        position: 'front'
      },
      required_slots: [],
      confidence: 0.99
    })
  )
}));

// Mock supabase service
jest.mock('./supabaseService', () => ({
  insertMessage: jest.fn(() => Promise.resolve()),
  findOrCreateOrder: jest.fn(() => Promise.resolve({ id: 'order-int-1', status: 'collect_part', language: 'de' })),
  getOrderById: jest.fn(() => Promise.resolve({ orderData: {} })),
  updateOrderData: jest.fn(() => Promise.resolve()),
  updateOrder: jest.fn(() => Promise.resolve()),
  upsertVehicleForOrderFromPartial: jest.fn(() => Promise.resolve()),
  getVehicleForOrder: jest.fn(() => Promise.resolve(null)),
  updateOrderScrapeTask: jest.fn(() => Promise.resolve())
}));

// Mock OEM resolver to return success
jest.mock('./oemService', () => ({
  resolveOEM: jest.fn(async () => ({ success: true, oemNumber: 'OEM-INT-123' }))
}));

// Mock scraping service to simulate synchronous scrape result
jest.mock('./scrapingService', () => ({
  scrapeOffersForOrder: jest.fn(async (orderId: string, oemNumber: string) => ({ ok: true, offersInserted: 3 }))
}));

// Avoid network calls for downloads / OCR
jest.mock('../utils/httpClient', () => ({
  fetchWithTimeoutAndRetry: jest.fn(async () => ({ ok: true, status: 200, statusText: 'OK', arrayBuffer: async () => Buffer.from('img').buffer }))
}));

import { handleIncomingBotMessage } from './botLogicService';
import { generateChatCompletion } from './openAiService';
import { resolveOEM } from './oemService';
import { scrapeOffersForOrder } from './scrapingService';

const supa = require('./supabaseService');

describe('integration: orchestrator -> OEM -> scrape', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls resolveOEM and scrapeOffersForOrder when orchestrator returns oem_lookup', async () => {
    const payload = { from: 'user-int', text: 'Ich brauche Bremsscheiben', mediaUrls: [] } as any;

    const res = await handleIncomingBotMessage(payload);

    // Orchestrator should have been invoked
    expect(generateChatCompletion).toHaveBeenCalled();

    // OEM resolver should be called with vehicle info and part
    expect(resolveOEM).toHaveBeenCalledWith(
      expect.objectContaining({ make: 'VW', model: 'Golf', year: 2015, vin: 'WVWZZZ1JZXW000001' }),
      expect.stringContaining('Bremsscheiben')
    );

    // Scraping should be started with returned OEM
    expect(scrapeOffersForOrder).toHaveBeenCalledWith('order-int-1', 'OEM-INT-123');

    // Handler should return a reply indicating it moved to show_offers (German expected from current code)
    expect(res.reply).toMatch(/prüfe|prüfe|Angebote|Angebote|prüfe jetzt/i);
    expect(res.orderId).toBe('order-int-1');
  });
});
