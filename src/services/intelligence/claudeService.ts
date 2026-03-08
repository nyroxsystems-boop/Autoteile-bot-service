/**
 * 🤖 CLAUDE AI SERVICE
 * Anthropic Claude integration for adversarial OEM validation.
 *
 * Used exclusively in Phase 3 of the APEX pipeline:
 * - Claude receives Gemini's OEM candidate
 * - Attempts to verify or disprove it
 * - Returns CONFIRMED / SUSPICIOUS / WRONG verdict
 *
 * Model: Claude 3.5 Haiku (fast, cheap, accurate for structured tasks)
 * Cost: ~$0.002 per validation call
 */

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@utils/logger";

// ============================================================================
// Configuration
// ============================================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
const CLAUDE_TIMEOUT_MS = 12000;

let client: Anthropic | null = null;

function getClient(): Anthropic {
    if (!client) {
        if (!ANTHROPIC_API_KEY) {
            throw new Error("ANTHROPIC_API_KEY not set — Claude adversary disabled");
        }
        client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    }
    return client;
}

// ============================================================================
// Types
// ============================================================================

export interface ClaudeVerdict {
    verdict: "CONFIRMED" | "SUSPICIOUS" | "WRONG";
    reason: string;
    alternativeOem: string | null;
    confidenceInOriginal: number; // 0.0-1.0
}

export interface DebateResult {
    winner: "gemini" | "claude";
    winningOem: string;
    reasoning: string;
    confidence: number;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Ask Claude to validate/challenge an OEM number found by Gemini.
 * Claude acts as an adversary — its job is to find errors.
 */
export async function validateOemWithClaude(params: {
    oemCandidate: string;
    vehicleBrand: string;
    vehicleModel: string;
    vehicleYear?: number;
    partDescription: string;
    geminiSource?: string;
    geminiConfidence?: number;
}): Promise<ClaudeVerdict> {
    const { oemCandidate, vehicleBrand, vehicleModel, vehicleYear, partDescription, geminiSource, geminiConfidence } = params;

    const startTime = Date.now();

    try {
        const claude = getClient();

        const prompt = `Du bist ein strenger Qualitätsprüfer für Automobil-OEM-Teilenummern.
Ein anderes KI-System behauptet folgende OEM-Nummer gefunden zu haben:

OEM-NUMMER: ${oemCandidate}
FAHRZEUG: ${vehicleBrand} ${vehicleModel}${vehicleYear ? ` ${vehicleYear}` : ""}
TEIL: ${partDescription}
QUELLE: ${geminiSource || "KI-Suche"}
CONFIDENCE: ${geminiConfidence ? `${Math.round(geminiConfidence * 100)}%` : "unbekannt"}

PRÜFE KRITISCH:
1. Passt das Nummernformat zum Hersteller ${vehicleBrand}?
   - BMW: exakt 11 Ziffern (z.B. 34116855006)
   - VAG (VW/Audi/Skoda/Seat): 2-3 Buchstaben + 6-7 Ziffern + 0-2 Buchstaben (z.B. 5Q0615301F)
   - Mercedes: A + 10 Ziffern (z.B. A2044210512)
   - Opel/Ford/Renault: verschiedene, typischerweise 7-10 alphanumerisch
2. Ist das eine bekannte OE-Nummer oder könnte das eine Aftermarket-Nummer sein? (Brembo, TRW, Bosch, Febi = AFTERMARKET)
3. Passt die Nummerngruppe zum Teiltyp? (z.B. BMW 341xxx = Bremsen, 111xxx = Motor)
4. Gibt es für dieses Fahrzeug/Teil eine andere, wahrscheinlichere OEM-Nummer?

WICHTIG: Sei SKEPTISCH. Lieber "SUSPICIOUS" als eine falsche Nummer durchlassen.

Antworte NUR als JSON:
{
  "verdict": "CONFIRMED" | "SUSPICIOUS" | "WRONG",
  "reason": "Begründung in 1-2 Sätzen",
  "alternative_oem": null | "die bessere Nummer falls du eine kennst",
  "confidence_in_original": 0.0-1.0
}`;

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Claude request timed out")), CLAUDE_TIMEOUT_MS)
        );

        const apiPromise = claude.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 300,
            temperature: 0,
            messages: [{ role: "user", content: prompt }],
        });

        const response = await Promise.race([apiPromise, timeoutPromise]);
        const text = response.content[0]?.type === "text" ? response.content[0].text : "";

        const elapsed = Date.now() - startTime;
        logger.info("[Claude] Validation complete", {
            elapsed,
            oem: oemCandidate,
            responseLength: text.length,
        });

        return parseClaudeVerdict(text, oemCandidate);
    } catch (err: any) {
        const elapsed = Date.now() - startTime;
        logger.warn("[Claude] Validation failed", {
            error: err?.message,
            elapsed,
            oem: oemCandidate,
        });

        // On failure, return neutral — don't block the pipeline
        return {
            verdict: "SUSPICIOUS",
            reason: `Claude validation unavailable: ${err?.message}`,
            alternativeOem: null,
            confidenceInOriginal: 0.70,
        };
    }
}

/**
 * Debate round: When Gemini and Claude disagree, have them argue.
 * Returns the winner with reasoning.
 */
export async function runDebateRound(params: {
    geminiOem: string;
    claudeOem: string;
    vehicleBrand: string;
    vehicleModel: string;
    vehicleYear?: number;
    partDescription: string;
}): Promise<DebateResult> {
    const { geminiOem, claudeOem, vehicleBrand, vehicleModel, vehicleYear, partDescription } = params;

    try {
        const claude = getClient();

        const prompt = `Zwei KI-Systeme haben unterschiedliche OEM-Nummern für das gleiche Fahrzeugteil gefunden.

FAHRZEUG: ${vehicleBrand} ${vehicleModel}${vehicleYear ? ` ${vehicleYear}` : ""}
TEIL: ${partDescription}

SYSTEM A (Google-Suche): ${geminiOem}
SYSTEM B (Wissensbasiert): ${claudeOem}

Analysiere beide Nummern:
1. Welche passt besser zum Nummernformat des Herstellers ${vehicleBrand}?
2. Welche passt besser zum Fahrzeugtyp und Baujahr?
3. Könnte eine davon eine Aftermarket-Nummer sein?
4. Gibt es Hinweise welche die richtige OEM-Nummer ist?

Antworte NUR als JSON:
{
  "winner": "A" | "B" | "NEITHER",
  "winning_oem": "die gewählte Nummer",
  "reasoning": "Begründung in 2-3 Sätzen",
  "confidence": 0.0-1.0
}`;

        const response = await claude.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 400,
            temperature: 0,
            messages: [{ role: "user", content: prompt }],
        });

        const text = response.content[0]?.type === "text" ? response.content[0].text : "";
        return parseDebateResult(text, geminiOem, claudeOem);
    } catch (err: any) {
        logger.warn("[Claude] Debate round failed", { error: err?.message });
        // On failure, prefer Gemini (it has Google Search grounding)
        return {
            winner: "gemini",
            winningOem: geminiOem,
            reasoning: "Debate failed — defaulting to Google-grounded result.",
            confidence: 0.65,
        };
    }
}

// ============================================================================
// Parsers
// ============================================================================

function parseClaudeVerdict(text: string, originalOem: string): ClaudeVerdict {
    const defaultResult: ClaudeVerdict = {
        verdict: "SUSPICIOUS",
        reason: "Could not parse Claude response",
        alternativeOem: null,
        confidenceInOriginal: 0.60,
    };

    try {
        const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return defaultResult;

        const parsed = JSON.parse(jsonMatch[0]);

        const verdict = ["CONFIRMED", "SUSPICIOUS", "WRONG"].includes(parsed.verdict)
            ? (parsed.verdict as ClaudeVerdict["verdict"])
            : "SUSPICIOUS";

        const altOem = parsed.alternative_oem
            ? String(parsed.alternative_oem).replace(/[\s.-]/g, "").toUpperCase()
            : null;

        return {
            verdict,
            reason: String(parsed.reason || "No reason given").slice(0, 300),
            alternativeOem: altOem && altOem.length >= 5 && altOem !== originalOem.toUpperCase() ? altOem : null,
            confidenceInOriginal: typeof parsed.confidence_in_original === "number"
                ? Math.max(0, Math.min(1, parsed.confidence_in_original))
                : verdict === "CONFIRMED" ? 0.90 : verdict === "WRONG" ? 0.10 : 0.55,
        };
    } catch {
        return defaultResult;
    }
}

function parseDebateResult(text: string, geminiOem: string, claudeOem: string): DebateResult {
    try {
        const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON");

        const parsed = JSON.parse(jsonMatch[0]);
        const winner = parsed.winner === "B" ? "claude" as const : "gemini" as const;
        const winningOem = winner === "claude" ? claudeOem : geminiOem;

        return {
            winner,
            winningOem: parsed.winning_oem
                ? String(parsed.winning_oem).replace(/[\s.-]/g, "").toUpperCase()
                : winningOem,
            reasoning: String(parsed.reasoning || "").slice(0, 400),
            confidence: typeof parsed.confidence === "number"
                ? Math.max(0, Math.min(1, parsed.confidence))
                : 0.70,
        };
    } catch {
        return {
            winner: "gemini",
            winningOem: geminiOem,
            reasoning: "Failed to parse debate — defaulting to Gemini.",
            confidence: 0.60,
        };
    }
}

/**
 * Health check — verifies Claude API is accessible.
 */
export async function isClaudeAvailable(): Promise<boolean> {
    if (!ANTHROPIC_API_KEY) return false;
    try {
        getClient();
        return true;
    } catch {
        return false;
    }
}
