import fetch from 'node-fetch';
import { OEMCandidate, OEMResolverRequest } from '../types';
import { extractOemsFromHtml } from '../../oemScraper';
import { logger } from '../../../utils/logger';

/**
 * Simple Motointegrator source.
 * It performs a GET request to the public search endpoint and extracts OEM‑like strings.
 * The endpoint is undocumented; we use the generic search URL:
 *   https://www.motointegrator.com/search?q=<part>&make=<make>&model=<model>
 * The response is HTML; we reuse `extractOemsFromHtml` to pull candidates.
 */
export const motointegratorSource = {
    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        try {
            const query = encodeURIComponent(req.partQuery?.rawText ?? "");
            const make = encodeURIComponent(req.vehicle?.make ?? "");
            const model = encodeURIComponent(req.vehicle?.model ?? "");
            const url = `https://www.motointegrator.com/search?q=${query}&make=${make}&model=${model}`;
            const response = await fetch(url);
            const html = await response.text();
            const oems = extractOemsFromHtml(html);
            return oems.map(o => ({
                oem: o,
                source: 'motointegrator',
                confidence: 0.6,
                meta: { note: 'Motointegrator scrape' }
            }));
        } catch (e) {
            logger.error('Motointegrator source failed', { error: e });
            return [];
        }
    }
};
