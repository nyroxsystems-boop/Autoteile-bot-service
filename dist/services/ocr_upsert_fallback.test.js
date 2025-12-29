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
// Ensure OpenAI client initialization doesn't throw in tests
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
// Provide dummy Twilio creds so downloadFromTwilio doesn't throw before we mock network
process.env.TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'AC_TEST';
process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'AUTH_TEST';
// Mock the OpenAI SDK used inside botLogicService so OCR function returns predictable JSON
jest.mock('openai', () => {
    return function MockOpenAI(opts) {
        this.chat = {
            completions: {
                create: async (params) => {
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
const botLogicService_1 = require("./botLogicService");
const botLogic = __importStar(require("./botLogicService"));
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
jest.spyOn(botLogic, 'extractVehicleDataFromImage').mockImplementation(async () => {
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
    };
});
// Mock downloadFromTwilio to return a small buffer
jest.spyOn(botLogic, 'downloadFromTwilio').mockImplementation(async () => Buffer.from('img'));
const supa = __importStar(require("./supabaseService"));
describe('OCR upsert fallback', () => {
    beforeEach(() => jest.clearAllMocks());
    it('continues OEM lookup when upsertVehicleForOrderFromPartial fails', async () => {
        const payload = { from: 'user-ocr', text: '', mediaUrls: ['https://example.com/fake.jpg'] };
        const res = await (0, botLogicService_1.handleIncomingBotMessage)(payload);
        // Because resolveOEM is mocked to success, handler should respond with show_offers transition reply
        expect(res).toBeDefined();
        expect(typeof res.reply).toBe('string');
        expect(res.orderId).toBe('order-ocr-1');
        // upsertVehicleForOrderFromPartial should have been attempted and thrown
        expect(supa.upsertVehicleForOrderFromPartial.mock.calls.length).toBeGreaterThan(0);
        // Handler should not crash and should return a user-facing reply (flow continued using OCR)
        expect(res.reply.length).toBeGreaterThan(0);
    }, 10000);
});
