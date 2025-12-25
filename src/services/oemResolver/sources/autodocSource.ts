import { webScrapeSource } from "./webScrapeSource";
import { OEMCandidate, OEMResolverRequest } from "../types";

/**
 * Autodoc source – currently reuses the generic webScrapeSource (which includes eBay, 7zap, etc.)
 * but tags the source as "autodoc" to count as an independent source.
 */
export const autodocSource = {
    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        const candidates = await webScrapeSource.resolveCandidates(req);
        // Override source name to "autodoc" for each candidate
        return candidates.map(c => ({ ...c, source: "autodoc" }));
    }
};
