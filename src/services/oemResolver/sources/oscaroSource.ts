/**
 * Oscaro.com Scraper
 * French market leader with extensive European coverage
 */
import { OEMSource, OEMCandidate } from "./baseSource";
import { extractOemsFromHtml, normalizeOem } from "../../oemScraper";
import { logger } from "../../../utils/logger";

import { fetchWithTimeoutAndRetry } from "../../../utils/httpClient";

export const oscaroSource: OEMSource = {
    name: "Oscaro",

    async resolveCandidates(req: any): Promise<OEMCandidate[]> {
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

            logger.info(`[Oscaro] Searching: ${url}`);

            const resp = await fetchWithTimeoutAndRetry(url);
            const html = await resp.text();

            // Check for Cloudflare or bot detection
            if (html.includes("cf-browser-verification") || html.includes("challenge-platform")) {
                logger.warn("[Oscaro] Bot detection triggered");
                return [];
            }

            // Extract OEM numbers
            const oems = extractOemsFromHtml(html);

            // Oscaro often has OEM references in data attributes
            const dataOemPattern = /data-oem[^=]*=["']([A-Z0-9\-\.]{5,18})["']/gi;
            const additionalOems: string[] = [];
            let match;

            while ((match = dataOemPattern.exec(html)) !== null) {
                const normalized = normalizeOem(match[1]);
                if (normalized) additionalOems.push(normalized);
            }

            // Look for "Référence OE" or "OE Number"
            const oeRefPattern = /(?:Référence OE|OE Number|Numéro OE)[:.\s]*([A-Z0-9\-\.]{5,18})/gi;
            while ((match = oeRefPattern.exec(html)) !== null) {
                const normalized = normalizeOem(match[1]);
                if (normalized) additionalOems.push(normalized);
            }

            const allOems = [...new Set([...oems, ...additionalOems])];

            logger.info(`[Oscaro] Found ${allOems.length} OEM candidates`);

            return allOems.map(oem => ({
                oem,
                source: "Oscaro",
                confidence: 0.83, // Slightly lower than German sources due to potential language issues
                metadata: { url }
            }));

        } catch (error: any) {
            logger.error(`[Oscaro] Error: ${error.message}`);
            return [];
        }
    }
};
