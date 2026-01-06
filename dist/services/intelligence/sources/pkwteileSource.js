"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pkwteileSource = void 0;
const oemScraper_1 = require("../oemScraper");
const logger_1 = require("../../../utils/logger");
const httpClient_1 = require("../../../utils/httpClient");
exports.pkwteileSource = {
    name: "Pkwteile",
    async resolveCandidates(req) {
        try {
            const { vehicle, partDescription } = req;
            const parts = [
                vehicle.brand,
                vehicle.model,
                partDescription
            ].filter(Boolean);
            const query = parts.join(" ");
            const url = `https://www.pkwteile.de/search?search=${encodeURIComponent(query)}`;
            logger_1.logger.info(`[Pkwteile] Searching: ${url}`);
            const resp = await (0, httpClient_1.fetchWithTimeoutAndRetry)(url);
            const html = await resp.text();
            // Extract OEM numbers
            const oems = (0, oemScraper_1.extractOemsFromHtml)(html);
            // Look for specific OEM markers in product details
            const oemMarkers = [
                /OE[M]?\s*(?:Nr|Nummer)[:.\s]*([A-Z0-9\-\.]{5,18})/gi,
                /Vergleichsnummer[:.\s]*([A-Z0-9\-\.]{5,18})/gi,
                /Originalnummer[:.\s]*([A-Z0-9\-\.]{5,18})/gi
            ];
            const additionalOems = [];
            for (const pattern of oemMarkers) {
                let match;
                while ((match = pattern.exec(html)) !== null) {
                    const normalized = (0, oemScraper_1.normalizeOem)(match[1]);
                    if (normalized)
                        additionalOems.push(normalized);
                }
            }
            const allOems = [...new Set([...oems, ...additionalOems])];
            logger_1.logger.info(`[Pkwteile] Found ${allOems.length} OEM candidates`);
            return allOems.map(oem => ({
                oem,
                source: "Pkwteile",
                confidence: 0.82,
                metadata: { url }
            }));
        }
        catch (error) {
            logger_1.logger.error(`[Pkwteile] Error: ${error.message}`);
            return [];
        }
    }
};
