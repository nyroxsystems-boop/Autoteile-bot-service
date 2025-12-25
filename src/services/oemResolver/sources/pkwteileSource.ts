/**
 * Pkwteile.de Scraper
 * German auto parts platform with OEM references
 */
import { OEMSource, OEMCandidate } from "./baseSource";
import { extractOemsFromHtml, normalizeOem } from "../../oemScraper";
import { logger } from "../../../utils/logger";

import { fetchWithTimeoutAndRetry } from "../../../utils/httpClient";

export const pkwteileSource: OEMSource = {
    name: "Pkwteile",

    async resolveCandidates(req: any): Promise<OEMCandidate[]> {
        try {
            const { vehicle, partDescription } = req;

            const parts = [
                vehicle.brand,
                vehicle.model,
                partDescription
            ].filter(Boolean);

            const query = parts.join(" ");
            const url = `https://www.pkwteile.de/search?search=${encodeURIComponent(query)}`;

            logger.info(`[Pkwteile] Searching: ${url}`);

            const resp = await fetchWithTimeoutAndRetry(url);
            const html = await resp.text();

            // Extract OEM numbers
            const oems = extractOemsFromHtml(html);

            // Look for specific OEM markers in product details
            const oemMarkers = [
                /OE[M]?\s*(?:Nr|Nummer)[:.\s]*([A-Z0-9\-\.]{5,18})/gi,
                /Vergleichsnummer[:.\s]*([A-Z0-9\-\.]{5,18})/gi,
                /Originalnummer[:.\s]*([A-Z0-9\-\.]{5,18})/gi
            ];

            const additionalOems: string[] = [];

            for (const pattern of oemMarkers) {
                let match;
                while ((match = pattern.exec(html)) !== null) {
                    const normalized = normalizeOem(match[1]);
                    if (normalized) additionalOems.push(normalized);
                }
            }

            const allOems = [...new Set([...oems, ...additionalOems])];

            logger.info(`[Pkwteile] Found ${allOems.length} OEM candidates`);

            return allOems.map(oem => ({
                oem,
                source: "Pkwteile",
                confidence: 0.82,
                metadata: { url }
            }));

        } catch (error: any) {
            logger.error(`[Pkwteile] Error: ${error.message}`);
            return [];
        }
    }
};
