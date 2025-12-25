// src/services/oemResolver/sources/sepZapWebSource.ts
import fetch from 'node-fetch';
import { OEMCandidate, OEMResolverRequest } from '../types';
import { logger } from '../../../utils/logger';

/**
 * Simple HTML scraper for 7‑Zap shop (https://www.7zap.com).
 * No API key required – the public search page returns HTML.
 */
export const sepZapWebSource = {
    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        try {
            const query = encodeURIComponent(req.partQuery.rawText);
            const make = encodeURIComponent(req.vehicle.make ?? '');
            const model = encodeURIComponent(req.vehicle.model ?? '');
            const url = `https://www.7zap.com/search?searchTerm=${query}&make=${make}&model=${model}`;
            const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const html = await resp.text();

            const oemRegex = /\b([A-Z0-9]{5,14})\b/g;
            const matches = new Set<string>();
            let m: RegExpExecArray | null;
            while ((m = oemRegex.exec(html)) !== null) {
                const candidate = m[1];
                if (/\d/.test(candidate)) matches.add(candidate);
            }

            return Array.from(matches).map(oem => ({
                oem,
                source: '7zap_web',
                confidence: 0.55,
                meta: { note: '7‑Zap HTML scrape' },
            }));
        } catch (e) {
            logger.error('sepZapWebSource failed', { error: e });
            return [];
        }
    },
};
