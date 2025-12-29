"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webScrapeSource = void 0;
const baseSource_1 = require("./baseSource");
const oemWebFinder_1 = require("../../oemWebFinder");
/**
 * Wraps the web-based OEM finder (PartSouq, 7zap, etc.) as a source for the resolver.
 * Treats the best OEM as high-confidence (but below TecDoc), and exposes all candidates.
 */
exports.webScrapeSource = {
    name: "web_scrape",
    async resolveCandidates(req) {
        // Build a minimal SearchContext from the resolver request
        const suspected = req.partQuery.suspectedNumber;
        const ctx = {
            vehicle: {
                brand: req.vehicle.make ?? undefined,
                model: req.vehicle.model ?? undefined,
                year: req.vehicle.year ?? undefined,
                vin: req.vehicle.vin ?? undefined,
                hsn: req.vehicle.hsn ?? undefined,
                tsn: req.vehicle.tsn ?? undefined
            },
            userQuery: suspected ||
                req.partQuery.rawText ||
                [req.vehicle.make, req.vehicle.model, req.partQuery.normalizedCategory].filter(Boolean).join(" "),
            suspectedNumber: suspected ?? undefined
        };
        const result = await (0, oemWebFinder_1.findBestOemForVehicle)(ctx, false);
        const candidates = result.candidates.map((c) => ({
            oem: c.normalized,
            brand: undefined,
            source: `${this.name}:${c.source}`,
            confidence: (0, baseSource_1.clampConfidence)(0.6 + Math.min(c.score ?? 0, 0.2)), // baseline 0.6, add small score if present
            meta: { confirmationHits: result.confirmationHits, confirmationSources: result.confirmationSources }
        }));
        // Push the best OEM again with a slightly higher confidence if available
        if (result.bestOem) {
            candidates.push({
                oem: result.bestOem,
                brand: undefined,
                source: `${this.name}:best`,
                confidence: (0, baseSource_1.clampConfidence)(0.75 + (result.confirmationHits ? 0.1 : 0)),
                meta: { confirmationHits: result.confirmationHits, confirmationSources: result.confirmationSources }
            });
        }
        (0, baseSource_1.logSourceResult)(this.name, candidates.length);
        return candidates;
    }
};
