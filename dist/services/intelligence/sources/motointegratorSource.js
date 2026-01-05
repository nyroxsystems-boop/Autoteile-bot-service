"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.motointegratorSource = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const oemScraper_1 = require("../oemScraper");
const logger_1 = require("@utils/logger");
/**
 * Simple Motointegrator source.
 * It performs a GET request to the public search endpoint and extracts OEM‑like strings.
 * The endpoint is undocumented; we use the generic search URL:
 *   https://www.motointegrator.com/search?q=<part>&make=<make>&model=<model>
 * The response is HTML; we reuse `extractOemsFromHtml` to pull candidates.
 */
exports.motointegratorSource = {
    async resolveCandidates(req) {
        try {
            const query = encodeURIComponent(req.partQuery?.rawText ?? "");
            const make = encodeURIComponent(req.vehicle?.make ?? "");
            const model = encodeURIComponent(req.vehicle?.model ?? "");
            const url = `https://www.motointegrator.com/search?q=${query}&make=${make}&model=${model}`;
            const response = await (0, node_fetch_1.default)(url);
            const html = await response.text();
            const oems = (0, oemScraper_1.extractOemsFromHtml)(html);
            return oems.map(o => ({
                oem: o,
                source: 'motointegrator',
                confidence: 0.6,
                meta: { note: 'Motointegrator scrape' }
            }));
        }
        catch (e) {
            logger_1.logger.error('Motointegrator source failed', { error: e });
            return [];
        }
    }
};
