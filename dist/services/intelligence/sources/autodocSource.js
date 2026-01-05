"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autodocSource = void 0;
const webScrapeSource_1 = require("./webScrapeSource");
/**
 * Autodoc source – currently reuses the generic webScrapeSource (which includes eBay, 7zap, etc.)
 * but tags the source as "autodoc" to count as an independent source.
 */
exports.autodocSource = {
    async resolveCandidates(req) {
        const candidates = await webScrapeSource_1.webScrapeSource.resolveCandidates(req);
        // Override source name to "autodoc" for each candidate
        return candidates.map(c => ({ ...c, source: "autodoc" }));
    }
};
