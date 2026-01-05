"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.autodocWebSource = void 0;
// src/services/oemResolver/sources/autodocWebSource.ts
const node_fetch_1 = __importDefault(require("node-fetch"));
const logger_1 = require("@utils/logger");
/**
 * Simple HTML scraper for Autodoc.de search results.
 * The URL pattern works without authentication – it returns a public HTML page.
 * We extract strings that look like OEM numbers (alphanumeric, 5‑14 chars, contain a digit).
 */
exports.autodocWebSource = {
    async resolveCandidates(req) {
        try {
            const query = encodeURIComponent(req.partQuery.rawText);
            const make = encodeURIComponent(req.vehicle.make ?? '');
            const model = encodeURIComponent(req.vehicle.model ?? '');
            const url = `https://www.autodoc.de/search?searchTerm=${query}&make=${make}&model=${model}`;
            const resp = await (0, node_fetch_1.default)(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const html = await resp.text();
            // Very simple regex to capture potential OEM strings in the page
            const oemRegex = /\b([A-Z0-9]{5,14})\b/g;
            const matches = new Set();
            let m;
            while ((m = oemRegex.exec(html)) !== null) {
                const candidate = m[1];
                // Basic filter – must contain at least one digit
                if (/\d/.test(candidate))
                    matches.add(candidate);
            }
            const candidates = Array.from(matches).map(oem => ({
                oem,
                source: 'autodoc_web',
                confidence: 0.55, // lower than premium sources
                meta: { note: 'Autodoc HTML scrape' },
            }));
            return candidates;
        }
        catch (e) {
            logger_1.logger.error('autodocWebSource failed', { error: e });
            return [];
        }
    },
};
