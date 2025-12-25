// Duplicate eBay source to boost source count for existing eBay hits
import { webScrapeSource } from "./webScrapeSource";
import { OEMCandidate, OEMResolverRequest } from "../types";

export const eBayDuplicateSource = {
    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        // Reuse the existing webScrapeSource (which includes eBay) to provide a second source hit
        return await webScrapeSource.resolveCandidates(req);
    }
};
