"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oscaroSource = void 0;
const oemScraper_1 = require("../oemScraper");
const logger_1 = require("../../../utils/logger");
const httpClient_1 = require("../../../utils/httpClient");
exports.oscaroSource = {
    name: "Oscaro",
    async resolveCandidates(req) {
        try {
            const { vehicle, partDescription } = req;
            // Oscaro uses a structured search with vehicle selection
            const parts = [
                vehicle.brand,
                vehicle.model,
                vehicle.year,
                partDescription
            ].filter(Boolean);
            const query = parts.join(" ");
            const url = `https://www.oscaro.com/search?term=${encodeURIComponent(query)}`;
            logger_1.logger.info(`[Oscaro] Searching: ${url}`);
            const resp = await (0, httpClient_1.fetchWithTimeoutAndRetry)(url);
            const html = await resp.text();
            // Check for Cloudflare or bot detection
            if (html.includes("cf-browser-verification") || html.includes("challenge-platform")) {
                logger_1.logger.warn("[Oscaro] Bot detection triggered");
                return [];
            }
            // Extract OEM numbers
            const oems = (0, oemScraper_1.extractOemsFromHtml)(html);
            // Oscaro often has OEM references in data attributes
            const dataOemPattern = /data-oem[^=]*=["']([A-Z0-9\-\.]{5,18})["']/gi;
            const additionalOems = [];
            let match;
            while ((match = dataOemPattern.exec(html)) !== null) {
                const normalized = (0, oemScraper_1.normalizeOem)(match[1]);
                if (normalized)
                    additionalOems.push(normalized);
            }
            // Look for "Référence OE" or "OE Number"
            const oeRefPattern = /(?:Référence OE|OE Number|Numéro OE)[:.\s]*([A-Z0-9\-\.]{5,18})/gi;
            while ((match = oeRefPattern.exec(html)) !== null) {
                const normalized = (0, oemScraper_1.normalizeOem)(match[1]);
                if (normalized)
                    additionalOems.push(normalized);
            }
            const allOems = [...new Set([...oems, ...additionalOems])];
            logger_1.logger.info(`[Oscaro] Found ${allOems.length} OEM candidates`);
            return allOems.map(oem => ({
                oem,
                source: "Oscaro",
                confidence: 0.83, // Slightly lower than German sources due to potential language issues
                metadata: { url }
            }));
        }
        catch (error) {
            logger_1.logger.error(`[Oscaro] Error: ${error.message}`);
            return [];
        }
    }
};
