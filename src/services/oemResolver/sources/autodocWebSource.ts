// src/services/oemResolver/sources/autodocWebSource.ts
import fetch from 'node-fetch';
import { OEMCandidate, OEMResolverRequest } from '../types';
import { logger } from '../../../utils/logger';

/**
 * Simple HTML scraper for Autodoc.de search results.
 * The URL pattern works without authentication – it returns a public HTML page.
 * We extract strings that look like OEM numbers (alphanumeric, 5‑14 chars, contain a digit).
 */
export const autodocWebSource = {
    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        try {
            const query = encodeURIComponent(req.partQuery.rawText);
            const make = encodeURIComponent(req.vehicle.make ?? '');
            const model = encodeURIComponent(req.vehicle.model ?? '');
            const url = `https://www.autodoc.de/search?searchTerm=${query}&make=${make}&model=${model}`;
            const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const html = await resp.text();

            // Very simple regex to capture potential OEM strings in the page
            const oemRegex = /\b([A-Z0-9]{5,14})\b/g;
            const matches = new Set<string>();
            let m: RegExpExecArray | null;
            while ((m = oemRegex.exec(html)) !== null) {
                const candidate = m[1];
                // Basic filter – must contain at least one digit
                if (/\d/.test(candidate)) matches.add(candidate);
            }

            const candidates: OEMCandidate[] = Array.from(matches).map(oem => ({
                oem,
                source: 'autodoc_web',
                confidence: 0.55, // lower than premium sources
                meta: { note: 'Autodoc HTML scrape' },
            }));
            return candidates;
        } catch (e) {
            logger.error('autodocWebSource failed', { error: e });
            return [];
        }
    },
};
