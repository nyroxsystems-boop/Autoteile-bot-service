/**
 * 🔐 AI VERIFICATION SOURCE
 *
 * Quick web verification for AI-generated OEM candidates.
 * Instead of trusting AI at 0.45 confidence, we verify by checking if
 * the candidate OEM number actually exists on real parts websites.
 *
 * Flow:
 * 1. Take AI candidate OEM number
 * 2. Google: "[OEM] [brand] [model]"
 * 3. Check if results contain parts sites (autodoc, daparto, etc.)
 * 4. Return verification result with confidence boost
 */

import { logger } from '@utils/logger';
import { extractOEMsEnhanced } from '../enhancedOemExtractor';

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const VERIFY_TIMEOUT = 10000;

// Parts sites that indicate a REAL OEM number exists
const TRUSTED_DOMAINS = [
    'autodoc.de', 'autodoc.co.uk', 'autodoc.fr',
    'daparto.de',
    'kfzteile24.de',
    'pkwteile.de',
    'ebay.de', 'ebay.com',
    'realoem.com',
    '7zap.com',
    'autoteile-markt.de',
    'autoteilexxl.de',
    'motointegrator.de',
    'oscaro.de',
    'teilehaber.de',
];

export interface VerificationResult {
    verified: boolean;
    hitCount: number;
    hitSites: string[];
    confidenceBoost: number;
    snippetContext?: string;
}

/**
 * Verify an OEM candidate by searching Google for it.
 * If the OEM number appears on trusted parts sites → it's real.
 */
export async function verifyOemViaGoogle(
    oem: string,
    brand: string,
    model: string,
    part: string,
): Promise<VerificationResult> {
    const result: VerificationResult = {
        verified: false,
        hitCount: 0,
        hitSites: [],
        confidenceBoost: 0,
    };

    if (!SCRAPER_API_KEY) {
        logger.debug('[AIVerify] No SCRAPER_API_KEY, skipping verification');
        return result;
    }

    try {
        const fetch = (await import('node-fetch')).default;

        // Search for the exact OEM number with brand context
        const query = `"${oem}" ${brand} ${model} ${part}`.trim();
        const googleUrl = `https://www.google.de/search?q=${encodeURIComponent(query)}&hl=de&num=10`;
        const scraperUrl = `http://api.scraperapi.com/?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(googleUrl)}&country_code=de`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), VERIFY_TIMEOUT);

        const resp = await fetch(scraperUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!resp.ok) {
            logger.warn('[AIVerify] Google verification failed', { status: resp.status });
            return result;
        }

        const html = await resp.text();

        // Strip to visible text
        const visibleText = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .toLowerCase();

        // Check how many trusted domains appear in the results
        for (const domain of TRUSTED_DOMAINS) {
            if (html.toLowerCase().includes(domain)) {
                result.hitSites.push(domain);
                result.hitCount++;
            }
        }

        // Check if the OEM number itself appears in the visible text
        // (not just in URLs/metadata)
        const oemNormalized = oem.replace(/[\s.-]/g, '').toLowerCase();
        const oemAppears = visibleText.includes(oemNormalized);

        // Check for vehicle context near the OEM mention
        const brandLower = brand.toLowerCase();
        const modelLower = model.toLowerCase();
        const hasVehicleContext = visibleText.includes(brandLower) &&
            (modelLower.length < 3 || visibleText.includes(modelLower));

        // Calculate confidence boost
        if (oemAppears && result.hitCount >= 2 && hasVehicleContext) {
            // OEM found on 2+ trusted sites with vehicle context → HIGH confidence
            result.verified = true;
            result.confidenceBoost = 0.40; // 0.45 + 0.40 = 0.85
        } else if (oemAppears && result.hitCount >= 1) {
            // OEM found on 1 trusted site → MEDIUM confidence
            result.verified = true;
            result.confidenceBoost = 0.30; // 0.45 + 0.30 = 0.75
        } else if (oemAppears) {
            // OEM appears in search but not on trusted sites
            result.confidenceBoost = 0.15; // 0.45 + 0.15 = 0.60
        } else {
            // OEM not found anywhere → no boost, keep at 0.45
            result.confidenceBoost = 0;
        }

        // Extract nearby context for debugging
        const oemIdx = visibleText.indexOf(oemNormalized);
        if (oemIdx >= 0) {
            result.snippetContext = visibleText.substring(
                Math.max(0, oemIdx - 80),
                Math.min(visibleText.length, oemIdx + oem.length + 80)
            ).trim();
        }

        logger.info('[AIVerify] Verification result', {
            oem,
            verified: result.verified,
            hitCount: result.hitCount,
            hitSites: result.hitSites.slice(0, 5),
            confidenceBoost: result.confidenceBoost,
            oemAppears,
            hasVehicleContext,
        });

    } catch (err: any) {
        if (err?.name === 'AbortError') {
            logger.warn('[AIVerify] Verification timed out', { oem });
        } else {
            logger.warn('[AIVerify] Verification failed', { oem, error: err?.message });
        }
    }

    return result;
}

export default { verifyOemViaGoogle };
