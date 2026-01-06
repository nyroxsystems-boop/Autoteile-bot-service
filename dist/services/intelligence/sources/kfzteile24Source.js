"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kfzteile24Source = void 0;
const oemScraper_1 = require("../oemScraper");
const logger_1 = require("../../../utils/logger");
const httpClient_1 = require("../../../utils/httpClient");
exports.kfzteile24Source = {
    name: "Kfzteile24",
    async resolveCandidates(req) {
        try {
            const { vehicle, partDescription } = req;
            // Build search query
            const parts = [
                vehicle.brand,
                vehicle.model,
                partDescription
            ].filter(Boolean);
            const query = parts.join(" ");
            const url = `https://www.kfzteile24.de/search?q=${encodeURIComponent(query)}`;
            logger_1.logger.info(`[Kfzteile24] Searching: ${url}`);
            const resp = await (0, httpClient_1.fetchWithTimeoutAndRetry)(url);
            const html = await resp.text();
            // Check for bot detection
            if (html.includes("captcha") || html.includes("challenge")) {
                logger_1.logger.warn("[Kfzteile24] Bot detection triggered");
                return [];
            }
            // Extract OEM numbers from HTML
            const oems = (0, oemScraper_1.extractOemsFromHtml)(html);
            // Also look for specific JSON-LD structured data
            const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
            const additionalOems = [];
            jsonLdMatches.forEach(match => {
                try {
                    const json = JSON.parse(match.replace(/<script[^>]*>|<\/script>/gi, ""));
                    if (json.mpn)
                        additionalOems.push(json.mpn);
                    if (json.sku)
                        additionalOems.push(json.sku);
                }
                catch {
                    // Ignore parse errors
                }
            });
            // Look for OEM numbers in product listings
            const oemPattern = /(?:OE[M]?[-\s]*(?:Nr|Nummer|Number)[:.\s]*)?([A-Z0-9]{5,18})/gi;
            let match;
            while ((match = oemPattern.exec(html)) !== null) {
                const normalized = (0, oemScraper_1.normalizeOem)(match[1]);
                if (normalized)
                    additionalOems.push(normalized);
            }
            const allOems = [...new Set([...oems, ...additionalOems])];
            logger_1.logger.info(`[Kfzteile24] Found ${allOems.length} OEM candidates`);
            return allOems.map(oem => ({
                oem,
                source: "Kfzteile24",
                confidence: 0.85, // High confidence for established source
                metadata: { url }
            }));
        }
        catch (error) {
            logger_1.logger.error(`[Kfzteile24] Error: ${error.message}`);
            return [];
        }
    }
};
