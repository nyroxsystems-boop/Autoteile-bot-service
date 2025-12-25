// Ensure OpenAI client initialization doesn't throw in tests
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
// Provide dummy Twilio creds so downloadFromTwilio doesn't throw before we mock network
process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'AC_TEST';
process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'AUTH_TEST';

// Mock the OpenAI SDK used inside botLogicService so OCR function returns predictable JSON
jest.mock('openai', () => {
  return function MockOpenAI(this: any, opts: any) {
    this.chat = {
      completions: {
        create: async (params: any) => {
          const content = JSON.stringify({
            make: 'VW',
            model: 'Golf',
            vin: 'WVWZZZ1JZXW000001',
            hsn: null,
            tsn: null,
            year: 2015,
            engineKw: 85,
            fuelType: 'Diesel',
            emissionClass: null,
            rawText: 'mocked OCR text'
          });
          return { choices: [{ message: { content } }] };
        }
      }
    };
  };
});

// Mock fetch helper to simulate Twilio media download
jest.mock('../utils/httpClient', () => ({
  fetchWithTimeoutAndRetry: jest.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () => Buffer.from('img').buffer
  }))
}));
// Mock OpenAI wrapper to avoid real API calls and to make orchestrator return noop
jest.mock('./openAiService', () => ({
  generateChatCompletion: jest.fn(async () => JSON.stringify({ action: 'noop', reply: '', slots: {}, required_slots: [], confidence: 1 }))
}));
import { handleIncomingBotMessage } from './botLogicService';
import * as botLogic from './botLogicService';

// Mock supabase service functions
jest.mock('./supabaseService', () => ({
  insertMessage: jest.fn(() => Promise.resolve()),
  findOrCreateOrder: jest.fn(() => Promise.resolve({ id: 'order-ocr-1', status: 'collect_vehicle', language: 'de' })),
  getOrderById: jest.fn(() => Promise.resolve({ orderData: { requestedPart: 'Bremsscheiben' } })),
  updateOrderData: jest.fn(() => Promise.resolve()),
  updateOrder: jest.fn(() => Promise.resolve()),
  upsertVehicleForOrderFromPartial: jest.fn(() => { throw new Error('DB column missing'); }),
  getVehicleForOrder: jest.fn(() => Promise.resolve(null)),
  updateOrderScrapeTask: jest.fn(() => Promise.resolve())
}));

// Mock OEM resolver and scrapers
jest.mock('./oemService', () => ({
  resolveOEM: jest.fn(() => Promise.resolve({ success: true, oemNumber: 'OEM-1111' }))
}));

jest.mock('./scrapingService', () => ({
  scrapeOffersForOrder: jest.fn(() => Promise.resolve({ ok: true }))
}));

// Mock the OCR extractor to return a confident VIN/HSN/TSN
jest.spyOn(botLogic, 'extractVehicleDataFromImage' as any).mockImplementation(async () => {
  return {
    make: 'VW',
    model: 'Golf',
    vin: 'WVWZZZ1JZXW000001',
    hsn: null,
    tsn: null,
    year: 2015,
    engineKw: 85,
    fuelType: 'Diesel',
    emissionClass: null,
    rawText: 'mocked OCR full text'
  } as any;
});

// Mock downloadFromTwilio to return a small buffer
jest.spyOn(botLogic, 'downloadFromTwilio' as any).mockImplementation(async () => Buffer.from('img'));

import * as supa from './supabaseService';

describe('OCR upsert fallback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('continues OEM lookup when upsertVehicleForOrderFromPartial fails', async () => {
    const payload = { from: 'user-ocr', text: '', mediaUrls: ['https://example.com/fake.jpg'] } as any;

    const res = await handleIncomingBotMessage(payload);

    // Because resolveOEM is mocked to success, handler should respond with show_offers transition reply
    expect(res).toBeDefined();
    expect(typeof res.reply).toBe('string');
    expect(res.orderId).toBe('order-ocr-1');

  // upsertVehicleForOrderFromPartial should have been attempted and thrown
  expect((supa.upsertVehicleForOrderFromPartial as jest.Mock).mock.calls.length).toBeGreaterThan(0);

  // Handler should not crash and should return a user-facing reply (flow continued using OCR)
  expect(res.reply.length).toBeGreaterThan(0);
  }, 10000);
});
