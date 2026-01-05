"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sepZapWebSource = void 0;
// src/services/oemResolver/sources/sepZapWebSource.ts
const node_fetch_1 = __importDefault(require("node-fetch"));
const logger_1 = require("@utils/logger");
/**
 * Simple HTML scraper for 7‑Zap shop (https://www.7zap.com).
 * No API key required – the public search page returns HTML.
 */
exports.sepZapWebSource = {
    async resolveCandidates(req) {
        try {
            const query = encodeURIComponent(req.partQuery.rawText);
            const make = encodeURIComponent(req.vehicle.make ?? '');
            const model = encodeURIComponent(req.vehicle.model ?? '');
            const url = `https://www.7zap.com/search?searchTerm=${query}&make=${make}&model=${model}`;
            const resp = await (0, node_fetch_1.default)(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const html = await resp.text();
            const oemRegex = /\b([A-Z0-9]{5,14})\b/g;
            const matches = new Set();
            let m;
            while ((m = oemRegex.exec(html)) !== null) {
                const candidate = m[1];
                if (/\d/.test(candidate))
                    matches.add(candidate);
            }
            return Array.from(matches).map(oem => ({
                oem,
                source: '7zap_web',
                confidence: 0.55,
                meta: { note: '7‑Zap HTML scrape' },
            }));
        }
        catch (e) {
            logger_1.logger.error('sepZapWebSource failed', { error: e });
            return [];
        }
    },
};
