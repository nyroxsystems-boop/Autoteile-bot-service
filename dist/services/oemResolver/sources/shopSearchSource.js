"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopSearchSource = void 0;
const baseSource_1 = require("./baseSource");
/**
 * Placeholder for a shop-search based OEM extractor.
 * Intention: call Apify actors or internal shop-search endpoints with vehicle + part text,
 * then extract OEMs from product metadata.
 */
exports.shopSearchSource = {
    name: "shop_search",
    async resolveCandidates(req) {
        // Kein echter Shop-Search angebunden -> keine Kandidaten zurückgeben, um False Positives zu vermeiden.
        const hasActors = !!process.env.APIFY_SHOP_ACTORS && !!process.env.APIFY_TOKEN;
        if (!hasActors) {
            (0, baseSource_1.logSourceResult)(this.name, 0);
            return [];
        }
        // Hier könnte künftig ein echter Shop-Suchdienst integriert werden.
        (0, baseSource_1.logSourceResult)(this.name, 0);
        return [];
    }
};
