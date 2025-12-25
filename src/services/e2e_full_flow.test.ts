// Mocked end-to-end test: WhatsApp -> Orchestrator -> OEM -> Scrape -> shop_offers -> dashboard list
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

jest.mock('./openAiService', () => ({
  generateChatCompletion: jest.fn(async () =>
    JSON.stringify({
      action: 'oem_lookup',
      reply: 'Alles klar, ich suche Angebote.',
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

jest.mock('./oemService', () => ({
  resolveOEM: jest.fn(async () => ({ success: true, oemNumber: 'OEM-E2E-1' }))
}));

// Mock scraping service to return offers (but keep real insertShopOffers in supabaseService mocked)
// Do not mock scrapingService here — use the real scrapingService which calls adapters and
// then `insertShopOffers` (which we mock below) so we can verify DB insert behavior.

// Mock supabase insert/list functions so we can assert they were called and return values
const mockInsertedOffers: any[] = [];
jest.mock('./supabaseService', () => ({
  insertMessage: jest.fn(() => Promise.resolve()),
  findOrCreateOrder: jest.fn(() => Promise.resolve({ id: 'order-e2e', status: 'collect_part', language: 'de' })),
  getOrderById: jest.fn(() => Promise.resolve({ orderData: {} })),
  updateOrderData: jest.fn(() => Promise.resolve()),
  updateOrder: jest.fn(() => Promise.resolve()),
  upsertVehicleForOrderFromPartial: jest.fn(() => Promise.resolve({ id: 'veh-1' })),
  getVehicleForOrder: jest.fn(() => Promise.resolve(null)),
  insertShopOffers: jest.fn(async (orderId: string, oem: string, offers: any[]) => {
    // capture inserted offers and pretend DB returned them with ids
    const mapped = offers.map((o, idx) => ({ id: `so-${idx + 1}`, orderId, oemNumber: oem, ...o }));
    mockInsertedOffers.push(...mapped);
    return mapped;
  }),
  listShopOffersByOrderId: jest.fn(async (orderId: string) => mockInsertedOffers.filter((o) => o.orderId === orderId))
}));

import { handleIncomingBotMessage } from './botLogicService';
import { generateChatCompletion } from './openAiService';
import { resolveOEM } from './oemService';
import { scrapeOffersForOrder } from './scrapingService';
import { insertShopOffers, listShopOffersByOrderId } from './supabaseService';

describe('E2E mocked: WhatsApp -> Orchestrator -> OEM -> Scrape -> Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsertedOffers.length = 0;
  });

  it('processes message, resolves OEM, scrapes offers and returns dashboard-listable offers', async () => {
    const payload = { from: 'whatsapp:+49123456789', text: 'Bremsscheiben vorne', mediaUrls: [] } as any;
    const res = await handleIncomingBotMessage(payload);

  expect(generateChatCompletion).toHaveBeenCalled();
  expect(resolveOEM).toHaveBeenCalled();

  // insertShopOffers should have been invoked by scrapingService (the real scrapingService calls adapters then insertShopOffers)
  expect(insertShopOffers).toHaveBeenCalled();

    // listShopOffersByOrderId should return the inserted offers
    const offers = await listShopOffersByOrderId('order-e2e');
    expect(Array.isArray(offers)).toBe(true);
    expect(offers.length).toBeGreaterThan(0);

    // Handler reply should indicate scanning offers (German text present in code)
    expect(res.reply).toMatch(/prüf|Angebot|Angebote|prüfe/i);
  });
});
