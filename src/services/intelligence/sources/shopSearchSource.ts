import { OEMResolverRequest, OEMCandidate } from "../types";
import { OEMSource, clampConfidence, logSourceResult } from "./baseSource";

/**
 * Placeholder for a shop-search based OEM extractor.
 * Intention: call Apify actors or internal shop-search endpoints with vehicle + part text,
 * then extract OEMs from product metadata.
 */
export const shopSearchSource: OEMSource = {
  name: "shop_search",

  async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
    // Kein echter Shop-Search angebunden -> keine Kandidaten zurückgeben, um False Positives zu vermeiden.
    const hasActors = !!process.env.APIFY_SHOP_ACTORS && !!process.env.APIFY_TOKEN;
    if (!hasActors) {
      logSourceResult(this.name, 0);
      return [];
    }

    // Hier könnte künftig ein echter Shop-Suchdienst integriert werden.
    logSourceResult(this.name, 0);
    return [];
  }
};
