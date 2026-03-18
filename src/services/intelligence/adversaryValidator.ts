/**
 * 🤖 AI Adversary for OEM Validation
 *
 * Provides adversarial validation of OEM numbers using a secondary AI model.
 * Primary: Claude (Anthropic) — different training data = genuine adversarial check
 * Fallback: Gemini Pro with adversarial prompt — same model but different context
 *
 * Usage:
 *   import { validateWithAdversary, isAdversaryAvailable } from './adversaryValidator';
 */

import { logger } from '@utils/logger';

// ---------------------------------------------------------------------------
// Feature Flag + Budget
// ---------------------------------------------------------------------------

const ADVERSARY_ENABLED = process.env.ADVERSARY_ENABLED !== 'false'; // enabled by default
const DAILY_BUDGET_USD = parseFloat(process.env.ADVERSARY_DAILY_BUDGET || '5.0');
let dailySpendUSD = 0;
let lastResetDate = new Date().toDateString();

function checkBudget(): boolean {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    dailySpendUSD = 0;
    lastResetDate = today;
  }
  return dailySpendUSD < DAILY_BUDGET_USD;
}

function trackSpend(inputTokens: number, outputTokens: number, model: 'claude' | 'gemini') {
  // Approximate costs (USD per 1K tokens)
  const rates = {
    claude: { input: 0.003, output: 0.015 },  // Claude 3 Haiku
    gemini: { input: 0.00025, output: 0.0005 }, // Gemini 1.5 Flash
  };
  const rate = rates[model];
  dailySpendUSD += (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdversaryRequest {
  oemNumber: string;
  make: string;
  model: string;
  year?: string | number;
  partName: string;
  primarySource: string;       // 'db' | 'gemini' | 'pattern'
  primaryConfidence: number;
}

export interface AdversaryResult {
  verdict: 'CONFIRMED' | 'REJECTED' | 'WRONG' | 'UNCERTAIN' | 'UNAVAILABLE';
  confidenceAdjustment: number;  // -0.3 to +0.2
  reason: string;
  alternativeOem?: string;
  adversaryModel: 'claude' | 'gemini-adversary' | 'none';
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Claude Adversary
// ---------------------------------------------------------------------------

async function validateWithClaude(req: AdversaryRequest): Promise<AdversaryResult | null> {
  const claudeApiKey = process.env.ANTHROPIC_API_KEY;
  if (!claudeApiKey) return null;

  const start = Date.now();

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: claudeApiKey });

    const prompt = `You are an automotive OEM parts verification expert. Your job is to CHALLENGE the following OEM number assignment.

Vehicle: ${req.make} ${req.model} ${req.year || ''}
Part requested: ${req.partName}
Proposed OEM number: ${req.oemNumber}
Source confidence: ${(req.primaryConfidence * 100).toFixed(0)}% from ${req.primarySource}

Your task:
1. Is this OEM number valid for this vehicle + part combination?
2. Could this be a different part or wrong vehicle variant?
3. Is the format consistent with ${req.make}'s OEM numbering scheme?

Respond in JSON only:
{
  "verdict": "CONFIRMED" or "REJECTED" or "UNCERTAIN",
  "confidence_adjustment": number between -0.3 and +0.2,
  "reason": "one sentence explanation",
  "alternative_oem": "if rejected, suggest the correct one, else null"
}`;

    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    trackSpend(response.usage.input_tokens, response.usage.output_tokens, 'claude');

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('[Adversary] Claude returned non-JSON response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      verdict: parsed.verdict || 'UNCERTAIN',
      confidenceAdjustment: Math.max(-0.3, Math.min(0.2, parsed.confidence_adjustment || 0)),
      reason: parsed.reason || 'No reason provided',
      alternativeOem: parsed.alternative_oem || undefined,
      adversaryModel: 'claude',
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    logger.warn('[Adversary] Claude validation failed', { error: err?.message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gemini Adversary (Fallback)
// ---------------------------------------------------------------------------

async function validateWithGeminiAdversary(req: AdversaryRequest): Promise<AdversaryResult | null> {
  const start = Date.now();

  try {
    const { generateChatCompletion } = await import('./geminiService');

    const adversarialPrompt = `ADVERSARIAL MODE: You must try to DISPROVE the following OEM assignment.
Be skeptical and look for errors.

Vehicle: ${req.make} ${req.model} ${req.year || ''}
Part: ${req.partName}
Proposed OEM: ${req.oemNumber}

CHALLENGE this assignment:
1. Does the OEM number format match ${req.make}'s known patterns?
2. Could this be for a different model year or engine variant?
3. Is this possibly an aftermarket number disguised as OEM?

Respond strictly in JSON:
{"verdict":"CONFIRMED|REJECTED|UNCERTAIN","confidence_adjustment":-0.3 to 0.2,"reason":"explanation","alternative_oem":null}`;

    const result = await generateChatCompletion({
      messages: [
        { role: 'system', content: 'You are a skeptical automotive parts expert verifying OEM numbers. Always try to find errors.' },
        { role: 'user', content: adversarialPrompt },
      ],
      temperature: 0.3,
    });

    const jsonMatch = (result || '').match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      verdict: parsed.verdict || 'UNCERTAIN',
      confidenceAdjustment: Math.max(-0.3, Math.min(0.2, parsed.confidence_adjustment || 0)),
      reason: parsed.reason || 'No reason',
      alternativeOem: parsed.alternative_oem || undefined,
      adversaryModel: 'gemini-adversary',
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    logger.warn('[Adversary] Gemini adversary failed', { error: err?.message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check if the adversary is available (enabled + within budget).
 */
export async function isAdversaryAvailable(): Promise<boolean> {
  if (!ADVERSARY_ENABLED) return false;
  if (!checkBudget()) {
    logger.info('[Adversary] Daily budget exceeded', { spent: dailySpendUSD.toFixed(4), budget: DAILY_BUDGET_USD });
    return false;
  }
  return true;
}

/**
 * Validate an OEM number using adversarial AI.
 * Tries Claude first, falls back to Gemini adversary.
 */
export async function validateWithAdversary(req: AdversaryRequest): Promise<AdversaryResult> {
  if (!await isAdversaryAvailable()) {
    return {
      verdict: 'UNAVAILABLE',
      confidenceAdjustment: 0,
      reason: 'Adversary disabled or budget exceeded',
      adversaryModel: 'none',
      latencyMs: 0,
    };
  }

  // Try Claude first (genuine adversarial — different model)
  const claudeResult = await validateWithClaude(req);
  if (claudeResult) {
    logger.info('[Adversary] Claude verdict', {
      verdict: claudeResult.verdict,
      adjustment: claudeResult.confidenceAdjustment,
      latencyMs: claudeResult.latencyMs,
    });
    return claudeResult;
  }

  // Fallback to Gemini with adversarial prompt
  const geminiResult = await validateWithGeminiAdversary(req);
  if (geminiResult) {
    logger.info('[Adversary] Gemini adversary verdict', {
      verdict: geminiResult.verdict,
      adjustment: geminiResult.confidenceAdjustment,
      latencyMs: geminiResult.latencyMs,
    });
    return geminiResult;
  }

  return {
    verdict: 'UNAVAILABLE',
    confidenceAdjustment: 0,
    reason: 'Both Claude and Gemini adversary failed',
    adversaryModel: 'none',
    latencyMs: 0,
  };
}

/**
 * Get current adversary budget status.
 */
export function getAdversaryBudgetStatus(): { spent: number; budget: number; remaining: number } {
  return {
    spent: dailySpendUSD,
    budget: DAILY_BUDGET_USD,
    remaining: Math.max(0, DAILY_BUDGET_USD - dailySpendUSD),
  };
}
