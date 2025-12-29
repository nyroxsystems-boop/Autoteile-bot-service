"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eBayDuplicateSource = void 0;
// Duplicate eBay source to boost source count for existing eBay hits
const webScrapeSource_1 = require("./webScrapeSource");
exports.eBayDuplicateSource = {
    async resolveCandidates(req) {
        // Reuse the existing webScrapeSource (which includes eBay) to provide a second source hit
        return await webScrapeSource_1.webScrapeSource.resolveCandidates(req);
    }
};
