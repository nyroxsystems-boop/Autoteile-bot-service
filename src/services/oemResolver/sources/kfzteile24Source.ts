/**
 * Kfzteile24.de Scraper
 * Große deutsche Plattform mit OEM-Referenzen
 */
import { OEMSource, OEMCandidate } from "./baseSource";
import { extractOemsFromHtml, normalizeOem } from "../../oemScraper";
import { logger } from "../../../utils/logger";

import { fetchWithTimeoutAndRetry } from "../../../utils/httpClient";

export const kfzteile24Source: OEMSource = {
    name: "Kfzteile24",

    async resolveCandidates(req: any): Promise<OEMCandidate[]> {
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

            logger.info(`[Kfzteile24] Searching: ${url}`);

            const resp = await fetchWithTimeoutAndRetry(url);
            const html = await resp.text();

            // Check for bot detection
            if (html.includes("captcha") || html.includes("challenge")) {
                logger.warn("[Kfzteile24] Bot detection triggered");
                return [];
            }

            // Extract OEM numbers from HTML
            const oems = extractOemsFromHtml(html);

            // Also look for specific JSON-LD structured data
            const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
            const additionalOems: string[] = [];

            jsonLdMatches.forEach(match => {
                try {
                    const json = JSON.parse(match.replace(/<script[^>]*>|<\/script>/gi, ""));
                    if (json.mpn) additionalOems.push(json.mpn);
                    if (json.sku) additionalOems.push(json.sku);
                } catch {
                    // Ignore parse errors
                }
            });

            // Look for OEM numbers in product listings
            const oemPattern = /(?:OE[M]?[-\s]*(?:Nr|Nummer|Number)[:.\s]*)?([A-Z0-9]{5,18})/gi;
            let match;
            while ((match = oemPattern.exec(html)) !== null) {
                const normalized = normalizeOem(match[1]);
                if (normalized) additionalOems.push(normalized);
            }

            const allOems = [...new Set([...oems, ...additionalOems])];

            logger.info(`[Kfzteile24] Found ${allOems.length} OEM candidates`);

            return allOems.map(oem => ({
                oem,
                source: "Kfzteile24",
                confidence: 0.85, // High confidence for established source
                metadata: { url }
            }));

        } catch (error: any) {
            logger.error(`[Kfzteile24] Error: ${error.message}`);
            return [];
        }
    }
};
