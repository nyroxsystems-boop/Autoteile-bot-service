/**
 * 🔍 AI SEARCH AGENT — v2 OEM Intelligence Engine
 *
 * Single optimized Gemini Grounded Search call per request.
 * Replaces the old 3-call system (DE + EN + Verify) with 1 perfected prompt.
 *
 * Key optimizations:
 * - Brand-specific prompt with exact OEM format constraints
 * - Brand-specific preferred search domains
 * - Strict anti-aftermarket rules in the prompt itself
 * - JSON response format for reliable parsing
 *
 * Cost: ~$0.001 per search (1 Gemini 2.0 Flash grounded call)
 */

import { OEMResolverRequest, OEMCandidate } from '../types';
import { generateGroundedCompletion, GroundedResult } from '../geminiService';
import { validateOemPattern } from '../brandPatternRegistry';
import { isAftermarketNumber } from '../aftermarketFilter';
import { logger } from '@utils/logger';

// ============================================================================
// Brand-Specific Configuration
// ============================================================================

interface BrandConfig {
  formatHint: string;
  preferredDomains: string[];
  exampleOems: string[];
}

const BRAND_CONFIGS: Record<string, BrandConfig> = {
  BMW: {
    formatHint: 'BMW OEM-Nummern sind IMMER exakt 11 Ziffern, z.B. 34116792219, 11427953129',
    preferredDomains: ['realoem.com', 'autodoc.de', 'daparto.de', 'bmw-etk.de'],
    exampleOems: ['34116858652', '11428507683', '64119237555'],
  },
  MINI: {
    formatHint: 'MINI OEM-Nummern sind exakt 11 Ziffern (BMW-Format), z.B. 34116855006',
    preferredDomains: ['realoem.com', 'autodoc.de', 'daparto.de'],
    exampleOems: ['34116855006', '34216799369'],
  },
  VW: {
    formatHint: 'VW OEM-Nummern: 2-3 Zeichen + 3 Ziffern + 3 Ziffern + 0-2 Buchstaben, z.B. 5Q0615301F, 1K0698151A',
    preferredDomains: ['7zap.com', 'autodoc.de', 'daparto.de', 'kfzteile24.de'],
    exampleOems: ['5Q0615301F', '1K0698151A', '5Q0819653'],
  },
  VOLKSWAGEN: {
    formatHint: 'VW OEM-Nummern: 2-3 Zeichen + 3 Ziffern + 3 Ziffern + 0-2 Buchstaben, z.B. 5Q0615301F',
    preferredDomains: ['7zap.com', 'autodoc.de', 'daparto.de'],
    exampleOems: ['5Q0615301F', '1K0698151A'],
  },
  AUDI: {
    formatHint: 'Audi OEM-Nummern: VAG-Format, z.B. 8K0615301B, 4G0698151C, 5Q0615301F',
    preferredDomains: ['7zap.com', 'autodoc.de', 'daparto.de'],
    exampleOems: ['8K0615301B', '4G0698151C', '5Q0615301F'],
  },
  SKODA: {
    formatHint: 'Skoda OEM-Nummern: VAG-Format, z.B. 5E0615301A, 5Q0615601A',
    preferredDomains: ['7zap.com', 'autodoc.de', 'daparto.de'],
    exampleOems: ['5E0615301A', '5Q0615601A'],
  },
  SEAT: {
    formatHint: 'Seat OEM-Nummern: VAG-Format, z.B. 5F0615301A, 5Q0615301F',
    preferredDomains: ['7zap.com', 'autodoc.de', 'daparto.de'],
    exampleOems: ['5F0615301A', '5Q0615301F'],
  },
  CUPRA: {
    formatHint: 'Cupra OEM-Nummern: VAG-Format, z.B. 5Q0615301K',
    preferredDomains: ['7zap.com', 'autodoc.de', 'daparto.de'],
    exampleOems: ['5Q0615301K'],
  },
  MERCEDES: {
    formatHint: 'Mercedes OEM-Nummern: "A" + 10 Ziffern, z.B. A2054211012, A0004230230',
    preferredDomains: ['catcar.info', 'autodoc.de', 'daparto.de', 'pkwteile.de'],
    exampleOems: ['A2054211012', 'A0004206400', 'A6511800109'],
  },
  'MERCEDES-BENZ': {
    formatHint: 'Mercedes OEM-Nummern: "A" + 10 Ziffern, z.B. A2054211012',
    preferredDomains: ['catcar.info', 'autodoc.de', 'daparto.de'],
    exampleOems: ['A2054211012', 'A0004206400'],
  },
  OPEL: {
    formatHint: 'Opel OEM-Nummern: 7-10 Ziffern, z.B. 13502050, 95507535',
    preferredDomains: ['autodoc.de', 'daparto.de', 'kfzteile24.de'],
    exampleOems: ['13502050', '55594651'],
  },
  FORD: {
    formatHint: 'Ford OEM-Nummern: 7-stellig (FINIS) z.B. 1738818, oder Engineering-Format z.B. LX6C-1125-AA',
    preferredDomains: ['autodoc.de', 'daparto.de', 'kfzteile24.de'],
    exampleOems: ['1738818', '2275819', 'LX6C1125AA'],
  },
  TOYOTA: {
    formatHint: 'Toyota OEM-Nummern: 10 Ziffern/Buchstaben, z.B. 4351202380, 0446502390',
    preferredDomains: ['amayama.com', 'autodoc.de', 'daparto.de'],
    exampleOems: ['4351202380', '0446502390', '0415237010'],
  },
  HYUNDAI: {
    formatHint: 'Hyundai OEM-Nummern: 10-stellig alphanumerisch, z.B. 51712D7500, 58411D7300',
    preferredDomains: ['autodoc.de', 'daparto.de', 'kfzteile24.de'],
    exampleOems: ['51712D7500', '58411D7300'],
  },
  KIA: {
    formatHint: 'Kia OEM-Nummern: 10-stellig alphanumerisch, z.B. 51712D7500',
    preferredDomains: ['autodoc.de', 'daparto.de', 'kfzteile24.de'],
    exampleOems: ['51712D7500', '51712A6000'],
  },
  RENAULT: {
    formatHint: 'Renault OEM-Nummern: 10-stellig, z.B. 402068532R, 152093920R',
    preferredDomains: ['autodoc.de', 'daparto.de', 'oscaro.de'],
    exampleOems: ['402068532R', '152093920R'],
  },
  PEUGEOT: {
    formatHint: 'Peugeot OEM-Nummern: PSA-Format, 10-stellig, z.B. 1612293880, 9818914980',
    preferredDomains: ['autodoc.de', 'daparto.de', 'oscaro.de'],
    exampleOems: ['1612293880', '9818914980'],
  },
  CITROEN: {
    formatHint: 'Citroën OEM-Nummern: PSA-Format, z.B. 9810613280, 1612293880',
    preferredDomains: ['autodoc.de', 'daparto.de', 'oscaro.de'],
    exampleOems: ['9810613280', '1612293880'],
  },
  FIAT: {
    formatHint: 'Fiat OEM-Nummern: 8 Ziffern, z.B. 51935455, 77366596',
    preferredDomains: ['autodoc.de', 'daparto.de'],
    exampleOems: ['51935455', '77366596'],
  },
  VOLVO: {
    formatHint: 'Volvo OEM-Nummern: 7-8 oder 10 Ziffern, z.B. 31423554',
    preferredDomains: ['autodoc.de', 'daparto.de'],
    exampleOems: ['31423554', '31262209'],
  },
  PORSCHE: {
    formatHint: 'Porsche OEM-Nummern: 9-12 Zeichen, z.B. 99635104510',
    preferredDomains: ['autodoc.de', 'daparto.de'],
    exampleOems: ['99635104510'],
  },
};

/** Trusted domains for grounding quality scoring */
const TRUSTED_DOMAINS = new Set([
  'autodoc.de', 'autodoc.com', 'daparto.de', 'kfzteile24.de',
  'pkwteile.de', 'realoem.com', '7zap.com', 'catcar.info',
  'amayama.com', 'partsouq.com', 'parts.bmw.de',
  'oscaro.de', 'mister-auto.de',
  'ebay.de', 'ebay.com',
]);

// ============================================================================
// Prompt Builder
// ============================================================================

function buildVehicleDescription(req: OEMResolverRequest): string {
  return [
    req.vehicle.make,
    req.vehicle.model,
    req.vehicle.year ? String(req.vehicle.year) : '',
    req.vehicle.motorcode ? `Motor: ${req.vehicle.motorcode}` : '',
    req.vehicle.kw ? `${req.vehicle.kw}kW` : '',
  ].filter(Boolean).join(' ');
}

function buildOptimizedPrompt(req: OEMResolverRequest): string {
  const brand = req.vehicle.make?.toUpperCase() || '';
  const vehicle = buildVehicleDescription(req);
  const part = req.partQuery.rawText;
  const config = BRAND_CONFIGS[brand];

  const formatHint = config?.formatHint || '';
  const domains = config?.preferredDomains?.join(', ') || 'autodoc.de, daparto.de';
  const examples = config?.exampleOems?.join(', ') || '';

  return `Du bist ein Automobil-Ersatzteil-Experte. Finde die ECHTE OEM-Teilenummer.

FAHRZEUG: ${vehicle}
TEIL: ${part}

SUCHSTRATEGIE:
1. Suche auf Herstellerkatalogen und Teileshops: ${domains}
2. Suche nach "${part} ${vehicle} OEM Teilenummer"
3. Prüfe ob die gefundene Nummer zum Hersteller ${brand} passt

${formatHint ? `NUMMERNFORMAT: ${formatHint}` : ''}
${examples ? `BEISPIELE für korrekte ${brand}-Nummern: ${examples}` : ''}

REGELN:
- NUR Original-OE/OEM-Nummern vom Hersteller ${brand || 'des Fahrzeugs'}
- KEINE Aftermarket-Nummern (Brembo, TRW, ATE, Bosch, Febi, Meyle, MANN, Hengst = FALSCH)
- Wenn du KEINE sichere Nummer findest: "oem_numbers": []
- ERFINDE NIEMALS eine Nummer. Leere Antwort > falsche Nummer
- Gib IMMER die source_url an wo du die Nummer gefunden hast

Antworte NUR als JSON:
{"oem_numbers":[{"number":"OEM-NUMMER","source_url":"URL","description":"Teilbeschreibung","confidence":"high/medium/low"}],"notes":""}`;
}

// ============================================================================
// Response Parser
// ============================================================================

interface ParsedOemResult {
  number: string;
  sourceUrl?: string;
  description?: string;
  confidence?: string;
}

function parseAiResponse(text: string): ParsedOemResult[] {
  const results: ParsedOemResult[] = [];

  // Strategy 1: JSON parse
  try {
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*"oem_numbers"[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;
    const data = JSON.parse(jsonStr);

    if (data.oem_numbers && Array.isArray(data.oem_numbers)) {
      for (const item of data.oem_numbers) {
        if (item.number && typeof item.number === 'string') {
          const normalized = item.number.replace(/[\s]/g, '').toUpperCase();
          if (normalized.length >= 5 && normalized.length <= 18) {
            results.push({
              number: normalized.replace(/[-]/g, ''), // Remove dashes for comparison
              sourceUrl: item.source_url,
              description: item.description,
              confidence: item.confidence,
            });
          }
        }
      }
    }
  } catch (err) {
    logger.debug('[v2 AI] JSON parse failed, using regex fallback', { error: err });
    // Strategy 2: Regex extraction fallback
    extractOemsFromText(text, results);
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

function extractOemsFromText(text: string, results: ParsedOemResult[]): void {
  // VAG: 2-3 letters + 6-7 digits + 0-2 letters
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
  // Toyota/Honda: XXXXX-XXXXX
  for (const m of text.matchAll(/\b(\d{5}-[A-Z0-9]{5}(?:-[A-Z0-9]{3})?)\b/gi)) {
    results.push({ number: m[1].replace(/-/g, '') });
  }
  // Generic: 7-13 alphanumeric with at least one digit
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

export interface AiSearchResult {
  candidates: OEMCandidate[];
  topCandidate?: OEMCandidate;
  searchLatencyMs: number;
  rawGroundingChunks: number;
}

function scoreCandidate(
  oem: string,
  brand: string,
  groundingChunks: Array<{ uri?: string; title?: string }>,
  selfConfidence: string | undefined,
): number {
  let score = 0.70; // Base: Gemini found something via search

  // 1. Brand pattern validation (most important — ±0.15)
  const patternScore = validateOemPattern(oem, brand);
  if (patternScore >= 0.9) score += 0.12;
  else if (patternScore >= 0.5) score += 0.04;
  else if (patternScore < 0.3) score -= 0.18;

  // 2. Grounding quality (±0.08)
  const trustedCount = groundingChunks.filter(c =>
    c.uri && [...TRUSTED_DOMAINS].some(d => c.uri!.includes(d))
  ).length;

  if (trustedCount >= 3) score += 0.08;
  else if (trustedCount >= 2) score += 0.05;
  else if (trustedCount >= 1) score += 0.02;
  else if (groundingChunks.length === 0) score -= 0.10; // No grounding = suspicious

  // 3. Self-confidence (±0.04)
  if (selfConfidence === 'high') score += 0.03;
  else if (selfConfidence === 'low') score -= 0.06;

  return Math.max(0, Math.min(0.99, score));
}

// ============================================================================
// Main Search Function
// ============================================================================

/**
 * Perform a single optimized Gemini Grounded search for OEM candidates.
 * Returns scored and filtered candidates.
 */
export async function searchWithAi(req: OEMResolverRequest): Promise<AiSearchResult> {
  const brand = req.vehicle.make?.toUpperCase() || '';
  const startTime = Date.now();

  logger.info('[v2 AI] Starting Gemini grounded search', {
    brand,
    model: req.vehicle.model,
    part: req.partQuery.rawText.substring(0, 50),
  });

  try {
    const prompt = buildOptimizedPrompt(req);

    const result: GroundedResult = await generateGroundedCompletion({
      prompt,
      systemInstruction: 'Du bist ein Automobil-Teilenummer-Experte. Suche im Internet und finde die korrekte OEM-Teilenummer. Antworte NUR im JSON-Format. ERFINDE NIEMALS eine Nummer.',
      temperature: 0.1,
    });

    const searchLatencyMs = Date.now() - startTime;

    if (!result.text) {
      logger.info('[v2 AI] Empty response from Gemini', { searchLatencyMs });
      return { candidates: [], searchLatencyMs, rawGroundingChunks: 0 };
    }

    // Parse response
    const parsed = parseAiResponse(result.text);

    // Score and filter candidates
    const candidates: OEMCandidate[] = [];

    for (const p of parsed) {
      // Filter aftermarket numbers
      if (isAftermarketNumber(p.number)) {
        logger.debug('[v2 AI] Filtered aftermarket', { oem: p.number });
        continue;
      }

      const confidence = scoreCandidate(
        p.number,
        brand,
        result.groundingChunks,
        p.confidence,
      );

      // Skip very low confidence
      if (confidence < 0.45) continue;

      const trustedSources = [...new Set(
        result.groundingChunks
          .filter(c => c.uri && [...TRUSTED_DOMAINS].some(d => c.uri!.includes(d)))
          .map(c => [...TRUSTED_DOMAINS].find(d => c.uri!.includes(d)) || c.uri)
      )];

      candidates.push({
        oem: p.number,
        brand: brand || undefined,
        source: 'v2_ai_search',
        confidence,
        meta: {
          description: p.description,
          sourceUrl: p.sourceUrl,
          groundedSources: trustedSources.slice(0, 5),
          groundingChunks: result.groundingChunks.length,
          isGrounded: result.isGrounded,
          selfConfidence: p.confidence,
        },
      });
    }

    // Sort by confidence
    candidates.sort((a, b) => b.confidence - a.confidence);

    logger.info('[v2 AI] Search complete', {
      parsedCount: parsed.length,
      candidateCount: candidates.length,
      topOem: candidates[0]?.oem,
      topConf: candidates[0]?.confidence,
      isGrounded: result.isGrounded,
      groundingChunks: result.groundingChunks.length,
      searchLatencyMs,
    });

    return {
      candidates: candidates.slice(0, 5), // Max 5 candidates
      topCandidate: candidates[0],
      searchLatencyMs,
      rawGroundingChunks: result.groundingChunks.length,
    };

  } catch (err: any) {
    const searchLatencyMs = Date.now() - startTime;
    logger.error('[v2 AI] Search failed', { error: err?.message, searchLatencyMs });
    return { candidates: [], searchLatencyMs, rawGroundingChunks: 0 };
  }
}
