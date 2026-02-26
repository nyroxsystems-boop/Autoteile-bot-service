/**
 * 🌐 GEMINI GROUNDED OEM SOURCE — Hardened Multi-Query Edition
 *
 * Uses Gemini 2.0 Flash with Google Search GROUNDING.
 * 3 parallel grounded queries for cross-validation:
 * 
 *   Query 1: German — "OEM Teilenummer [Teil] [Fahrzeug]"
 *   Query 2: English — "OEM part number [part] [vehicle] genuine"
 *   Query 3: Verification — "Is [OEM] correct for [vehicle]?"
 *
 * Cross-query consensus:
 * - Same OEM from 2+ queries → confidence boost (+0.08)
 * - Same OEM from 3 queries → max confidence (+0.12)
 * - Only 1 query → standard confidence
 *
 * Brand-specific OEM format validation prevents hallucination.
 *
 * Cost: 0 ScraperAPI credits. Uses existing GEMINI_API_KEY.
 */

import { OEMCandidate, OEMResolverRequest } from '../types';
import { OEMSource, clampConfidence, logSourceResult } from './baseSource';
import { generateGroundedCompletion, GroundedResult } from '../geminiService';
import { validateOemPattern } from '../brandPatternRegistry';
import { isAftermarketNumber } from '../aftermarketFilter';
import { logger } from '@utils/logger';

// ============================================================================
// Constants
// ============================================================================

const TRUSTED_SITES = [
    'autodoc.de', 'autodoc.com', 'daparto.de', 'kfzteile24.de',
    'pkwteile.de', 'realoem.com', '7zap.com', 'catcar.info',
    'parts.bmw.de', 'amayama.com', 'partsouq.com',
    'ebay.de', 'ebay.com', 'autoteile-markt.de', 'teilehaber.de',
    'oscaro.de', 'mister-auto.de', 'spareto.com',
];

// Brand-specific OEM format hints for the prompt
const BRAND_FORMAT_HINTS: Record<string, string> = {
    'VW': 'VAG-Format: 2-3 Buchstaben + 3 Ziffern + 3 Ziffern + 0-2 Buchstaben, z.B. 5Q0615301F, 1K0698151A',
    'VOLKSWAGEN': 'VAG-Format: z.B. 5Q0615301F, 1K0698151A',
    'AUDI': 'VAG-Format: z.B. 8K0615301A, 4G0698151C',
    'SEAT': 'VAG-Format: z.B. 5F0615301A',
    'SKODA': 'VAG-Format: z.B. 5E0615301A',
    'BMW': 'BMW-Format: exakt 11 Ziffern, z.B. 34116792219, 11127588412',
    'MINI': 'BMW-Format: exakt 11 Ziffern, z.B. 34116792219',
    'MERCEDES': 'Mercedes-Format: A + 10 Ziffern, z.B. A2044210512, A0004230230',
    'MERCEDES-BENZ': 'Mercedes-Format: A + 10 Ziffern, z.B. A2044210512',
    'OPEL': 'Opel-Format: z.B. 13502045, 95507535',
    'FORD': 'Ford-Format: z.B. 1917578, EM2C-2C562-A1A',
    'TOYOTA': 'Toyota-Format: z.B. 04465-33471, 43512-06130',
    'HONDA': 'Honda-Format: z.B. 45251-TA0-A00',
    'HYUNDAI': 'Hyundai-Format: z.B. 58101-3XA10',
    'KIA': 'Kia-Format: z.B. 58101-3XA10',
    'RENAULT': 'Renault-Format: z.B. 7701209841, 402060010R',
    'PEUGEOT': 'PSA-Format: z.B. 4249H0, 1611083580',
    'CITROEN': 'PSA-Format: z.B. 4249H0, 1611083580',
    'FIAT': 'Fiat-Format: z.B. 77366596, 51810609',
    'VOLVO': 'Volvo-Format: z.B. 31423554, 31262209',
    'PORSCHE': 'Porsche-Format: z.B. 99635104510, 955351044',
    'NISSAN': 'Nissan-Format: z.B. D1060-JD00A, 40206-JD000',
    'MAZDA': 'Mazda-Format: z.B. G33Y-33-28Z, GHY9-33-25XC',
    'SUBARU': 'Subaru-Format: z.B. 26296AG000, 26296FG000',
};

// ============================================================================
// Prompt Builders
// ============================================================================

function buildVehicleDesc(req: OEMResolverRequest): string {
    const parts = [
        req.vehicle.make,
        req.vehicle.model,
        req.vehicle.year ? String(req.vehicle.year) : '',
        req.vehicle.motorcode ? `Motor: ${req.vehicle.motorcode}` : '',
    ].filter(Boolean);
    return parts.join(' ');
}

function buildGermanPrompt(req: OEMResolverRequest): string {
    const brand = req.vehicle.make || '';
    const vehicle = buildVehicleDesc(req);
    const part = req.partQuery.rawText;
    const formatHint = BRAND_FORMAT_HINTS[brand.toUpperCase()] || '';

    return `Finde die ORIGINALE OEM-Teilenummer (Herstellernummer) für:

Fahrzeug: ${vehicle}
Teil: ${part}

WICHTIG:
- NUR die OEM/OE-Nummer vom Hersteller ${brand}, KEINE Aftermarket-Nummern (nicht Brembo, TRW, Bosch etc.)
- Suche auf autodoc.de, daparto.de, pkwteile.de oder Herstellerkatalogen
${formatHint ? `- Erwartetes Format: ${formatHint}` : ''}

Antworte NUR als JSON:
{"oem_numbers":[{"number":"OEM-NUMMER","description":"Beschreibung","confidence":"high/medium/low"}],"notes":""}`;
}

function buildEnglishPrompt(req: OEMResolverRequest): string {
    const brand = req.vehicle.make || '';
    const vehicle = buildVehicleDesc(req);
    const part = req.partQuery.rawText;
    const formatHint = BRAND_FORMAT_HINTS[brand.toUpperCase()] || '';

    return `Find the GENUINE OEM part number for:

Vehicle: ${vehicle}
Part: ${part}

IMPORTANT:
- Only the ORIGINAL manufacturer (${brand}) part number, NOT aftermarket (not Brembo, TRW, Bosch etc.)
- Search on parts websites for the exact OE/OEM reference number
${formatHint ? `- Expected format: ${formatHint}` : ''}

Reply ONLY as JSON:
{"oem_numbers":[{"number":"OEM-NUMBER","description":"description","confidence":"high/medium/low"}],"notes":""}`;
}

// ============================================================================
// Response Parser
// ============================================================================

interface ParsedOem {
    number: string;
    description?: string;
    confidence?: string;
}

function parseResponse(text: string): ParsedOem[] {
    const results: ParsedOem[] = [];

    // Strategy 1: JSON parse
    try {
        const cleaned = text
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();

        // Find JSON object in text (Gemini sometimes adds text before/after JSON)
        const jsonMatch = cleaned.match(/\{[\s\S]*"oem_numbers"[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;

        const data = JSON.parse(jsonStr);
        if (data.oem_numbers && Array.isArray(data.oem_numbers)) {
            for (const item of data.oem_numbers) {
                if (item.number && typeof item.number === 'string') {
                    const normalized = item.number.replace(/[\s]/g, '').toUpperCase();
                    // Allow dashes in OEM numbers (Toyota, Honda use them)
                    if (normalized.length >= 5 && normalized.length <= 18) {
                        results.push({
                            number: normalized.replace(/[-]/g, ''), // Remove dashes for comparison
                            description: item.description,
                            confidence: item.confidence,
                        });
                    }
                }
            }
        }
    } catch {
        // Strategy 2: Regex extraction
        extractFromText(text, results);
    }

    // Deduplicate
    const seen = new Set<string>();
    return results.filter(r => {
        const key = r.number.replace(/[-\s.]/g, '').toUpperCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function extractFromText(text: string, results: ParsedOem[]): void {
    // VAG pattern: 2-3 letters + 6-7 digits + 0-2 letters
    for (const m of text.matchAll(/\b([A-Z0-9]{2,3}\d{3}\s?\d{3}[A-Z]{0,2})\b/gi)) {
        const n = m[1].replace(/\s/g, '').toUpperCase();
        if (n.length >= 9 && n.length <= 12) results.push({ number: n });
    }

    // BMW: 11 digits
    for (const m of text.matchAll(/\b(\d{11})\b/g)) {
        results.push({ number: m[1] });
    }

    // Mercedes: A + 10+ digits
    for (const m of text.matchAll(/\b([A-Z]\d{10,12})\b/g)) {
        results.push({ number: m[1] });
    }

    // Toyota/Honda: XXXXX-XXXXX-XXX
    for (const m of text.matchAll(/\b(\d{5}-[A-Z0-9]{5}(?:-[A-Z0-9]{3})?)\b/gi)) {
        results.push({ number: m[1].replace(/-/g, '') });
    }

    // Generic: 7-13 alphanumeric
    for (const m of text.matchAll(/\b([A-Z]{1,2}\d{6,10}[A-Z]?)\b/gi)) {
        const n = m[1].toUpperCase();
        if (n.length >= 7 && n.length <= 13 && /\d/.test(n)) {
            results.push({ number: n });
        }
    }
}

// ============================================================================
// Confidence Scoring
// ============================================================================

function scoreConfidence(
    oem: string,
    brand: string,
    groundingChunks: Array<{ uri?: string; title?: string }>,
    selfConfidence: string | undefined,
    queryCount: number,  // How many queries found this OEM
): number {
    let confidence = 0.72; // Base: Gemini found via search

    // Brand pattern validation — the most important factor
    const patternScore = validateOemPattern(oem, brand);
    if (patternScore >= 0.9) confidence += 0.10;      // Perfect pattern match
    else if (patternScore >= 0.5) confidence += 0.04;  // Partial match
    else if (patternScore < 0.3) confidence -= 0.20;   // Wrong format = heavy penalty

    // Multi-query consensus — the second most important factor
    if (queryCount >= 3) confidence += 0.12;     // All queries agree = very strong
    else if (queryCount >= 2) confidence += 0.08; // 2 queries agree = strong

    // Grounding source quality
    const trustedCount = groundingChunks.filter(c =>
        c.uri && TRUSTED_SITES.some(site => c.uri!.includes(site))
    ).length;

    if (trustedCount >= 3) confidence += 0.06;
    else if (trustedCount >= 2) confidence += 0.04;
    else if (trustedCount >= 1) confidence += 0.02;

    // No grounding at all = suspicious (might be hallucinated)
    if (groundingChunks.length === 0) confidence -= 0.10;

    // Gemini's self-assessment
    if (selfConfidence === 'high') confidence += 0.02;
    else if (selfConfidence === 'low') confidence -= 0.08;

    return clampConfidence(confidence);
}

// ============================================================================
// Source Implementation
// ============================================================================

export const geminiGroundedOemSource: OEMSource = {
    name: 'gemini_grounded',

    async resolveCandidates(req: OEMResolverRequest): Promise<OEMCandidate[]> {
        const brand = req.vehicle.make || '';

        logger.info('[GeminiGrounded] Starting multi-query grounded search', {
            brand,
            model: req.vehicle.model,
            part: req.partQuery.rawText.substring(0, 50),
        });

        const systemInstruction = `Du bist ein Automobil-Ersatzteil-Experte. Nutze Google-Suche um die korrekte OEM/OE-Nummer zu finden. Antworte NUR im JSON-Format. Keine Erklärungen.`;

        // =====================================================================
        // PARALLEL MULTI-QUERY: 2 grounded calls for cross-validation
        // =====================================================================
        const [deResult, enResult] = await Promise.all([
            generateGroundedCompletion({
                prompt: buildGermanPrompt(req),
                systemInstruction,
                temperature: 0.1,
            }),
            generateGroundedCompletion({
                prompt: buildEnglishPrompt(req),
                systemInstruction: 'You are an automotive parts expert. Use Google Search to find the correct OEM/OE part number. Reply ONLY in JSON format.',
                temperature: 0.1,
            }),
        ]);

        // =====================================================================
        // PARSE & MERGE: Collect OEMs from all queries
        // =====================================================================
        const oemCounts = new Map<string, {
            count: number;
            descriptions: string[];
            confidences: string[];
            allChunks: Array<{ uri?: string; title?: string }>;
        }>();

        function processResult(result: GroundedResult, queryName: string): void {
            if (!result.text) return;
            const parsed = parseResponse(result.text);

            for (const p of parsed) {
                if (isAftermarketNumber(p.number)) continue;

                const key = p.number.replace(/[-\s.]/g, '').toUpperCase();
                const existing = oemCounts.get(key) || {
                    count: 0,
                    descriptions: [],
                    confidences: [],
                    allChunks: [],
                };

                existing.count++;
                if (p.description) existing.descriptions.push(p.description);
                if (p.confidence) existing.confidences.push(p.confidence);
                existing.allChunks.push(...result.groundingChunks);

                oemCounts.set(key, existing);
            }

            logger.debug(`[GeminiGrounded] ${queryName}`, {
                parsed: parsed.length,
                grounded: result.isGrounded,
                chunks: result.groundingChunks.length,
            });
        }

        processResult(deResult, 'German query');
        processResult(enResult, 'English query');

        // =====================================================================
        // VERIFY TOP CANDIDATE: 3rd query confirms the best OEM
        // =====================================================================
        const sortedOems = [...oemCounts.entries()]
            .sort((a, b) => b[1].count - a[1].count);

        if (sortedOems.length > 0) {
            const topOem = sortedOems[0][0];
            const verifyResult = await generateGroundedCompletion({
                prompt: `Ist "${topOem}" die korrekte OEM-Teilenummer für ${req.partQuery.rawText} beim ${buildVehicleDesc(req)}?

Suche im Internet und bestätige ob diese Nummer korrekt ist.
Antworte als JSON:
{"verified": true/false, "correct_number": "die richtige Nummer falls anders", "source": "wo gefunden"}`,
                systemInstruction,
                temperature: 0.1,
            });

            if (verifyResult.text) {
                try {
                    const cleaned = verifyResult.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
                    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const verifyData = JSON.parse(jsonMatch[0]);
                        if (verifyData.verified === true) {
                            // Verification confirms → count it as another agreement
                            const existing = oemCounts.get(topOem)!;
                            existing.count++;
                            existing.allChunks.push(...verifyResult.groundingChunks);
                            logger.info('[GeminiGrounded] ✅ Verification CONFIRMED', { oem: topOem });
                        } else if (verifyData.correct_number) {
                            // Verification says different number → add it
                            const alt = String(verifyData.correct_number).replace(/[-\s.]/g, '').toUpperCase();
                            if (alt.length >= 5 && alt !== topOem && !isAftermarketNumber(alt)) {
                                const existing = oemCounts.get(alt) || {
                                    count: 0, descriptions: ['Verification correction'], confidences: ['high'], allChunks: [],
                                };
                                existing.count += 2; // Correction = strong signal
                                existing.allChunks.push(...verifyResult.groundingChunks);
                                oemCounts.set(alt, existing);
                                logger.info('[GeminiGrounded] 🔄 Verification CORRECTED', { from: topOem, to: alt });
                            }
                        }
                    }
                } catch {
                    // Verification parse failed — no boost
                }
            }
        }

        // =====================================================================
        // BUILD CANDIDATES with cross-query confidence
        // =====================================================================
        const candidates: OEMCandidate[] = [];

        for (const [oem, data] of oemCounts) {
            const topConfidence = data.confidences.includes('high') ? 'high'
                : data.confidences.includes('medium') ? 'medium' : 'low';

            const confidence = scoreConfidence(
                oem, brand, data.allChunks, topConfidence, data.count,
            );

            if (confidence < 0.45) continue;

            const trustedHits = [...new Set(
                data.allChunks
                    .filter(c => c.uri && TRUSTED_SITES.some(s => c.uri!.includes(s)))
                    .map(c => TRUSTED_SITES.find(s => c.uri!.includes(s)) || c.uri)
            )];

            candidates.push({
                oem,
                brand: brand.toUpperCase(),
                source: this.name,
                confidence,
                meta: {
                    description: data.descriptions[0],
                    queryAgreement: data.count,
                    groundedSources: trustedHits.slice(0, 5),
                    totalGroundingChunks: data.allChunks.length,
                    isGrounded: data.allChunks.length > 0,
                    source_type: 'gemini_search_grounded',
                    priority: data.count >= 2 ? 9 : (data.allChunks.length > 0 ? 7 : 4),
                },
            });
        }

        candidates.sort((a, b) => b.confidence - a.confidence);

        logger.info('[GeminiGrounded] Multi-query complete', {
            totalOems: oemCounts.size,
            candidates: candidates.length,
            topOem: candidates[0]?.oem,
            topConf: candidates[0]?.confidence,
            topAgreement: candidates[0]?.meta?.queryAgreement,
        });

        logSourceResult(this.name, candidates.length);
        return candidates;
    },
};

export default geminiGroundedOemSource;
