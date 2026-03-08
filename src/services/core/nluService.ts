/**
 * NLU Service — Natural Language Understanding for the WhatsApp Bot.
 *
 * Extracted from botLogicService.ts for clean separation of concerns.
 * Handles: user message parsing, intent detection, language detection,
 * smalltalk detection, abuse detection, VIN/HSN/TSN extraction.
 */

import { logger } from "@utils/logger";
import { generateChatCompletion } from "../intelligence/geminiService";
import { TEXT_NLU_PROMPT } from "../../prompts/textNluPrompt";

// ============================================================================
// Types
// ============================================================================

export type SmalltalkType = "greeting" | "thanks" | "bot_question";

export interface ParsedUserMessage {
    intent:
    | "greeting"
    | "send_vehicle_doc"
    | "request_part"
    | "describe_symptoms"
    | "general_question"
    | "smalltalk"
    | "other"
    | "unknown";

    // Vehicle info
    make?: string | null;
    model?: string | null;
    year?: number | null;
    engine?: string | null;
    engineCode?: string | null;
    engineKw?: number | null;
    fuelType?: string | null;
    emissionClass?: string | null;
    hsn?: string | null;
    tsn?: string | null;
    vin?: string | null;

    // Part info
    isAutoPart?: boolean;
    userPartText?: string | null;
    normalizedPartName?: string | null;
    partCategory?: string | null;
    position?: string | null;
    positionNeeded?: boolean;
    sideNeeded?: boolean;
    quantity?: number | null;
    symptoms?: string | null;
    part?: string | null;
    partDetails?: any | null;
    missingVehicleInfo?: string[];
    missingPartInfo?: string[];

    // Smalltalk
    smalltalkType?: SmalltalkType | null;
    smalltalkReply?: string | null;
}

export type MessageIntent = "new_order" | "status_question" | "abort_order" | "continue_order" | "oem_direct" | "unknown";

export interface IntentResult {
    intent: MessageIntent;
    extractedOem?: string;
}

// ============================================================================
// Language Detection
// ============================================================================

export function detectLanguageSelection(text: string): "de" | "en" | "tr" | "ku" | "pl" | null {
    if (!text) return null;
    const t = text.trim().toLowerCase();

    if (["1", "de", "deutsch", "german", "ger"].includes(t)) return "de";
    if (["2", "en", "english", "englisch", "eng"].includes(t)) return "en";
    if (["3", "tr", "türkçe", "turkce", "turkish", "türkisch"].includes(t)) return "tr";
    if (["4", "ku", "kurdî", "kurdi", "kurdisch", "kurdish"].includes(t)) return "ku";
    if (["5", "pl", "polski", "polnisch", "polish"].includes(t)) return "pl";

    return null;
}

export function detectLanguageFromText(text: string): "de" | "en" | null {
    const t = text?.toLowerCase() ?? "";
    const germanHints = ["hallo", "moin", "servus", "grüß", "danke", "tschau", "bitte"];
    const englishHints = ["hello", "hi", "hey", "thanks", "thank you", "cheers"];

    if (germanHints.some((w) => t.includes(w))) return "de";
    if (englishHints.some((w) => t.includes(w))) return "en";
    return null;
}

// ============================================================================
// Smalltalk & Abuse Detection
// ============================================================================

export function detectSmalltalk(text: string): SmalltalkType | null {
    const t = text?.toLowerCase() ?? "";
    if (!t) return null;
    const greetings = ["hallo", "hi", "hello", "hey", "moin", "servus", "guten tag", "good morning", "good evening"];
    const thanks = ["danke", "vielen dank", "thx", "thanks", "thank you"];
    const botQuestions = ["bist du ein bot", "are you a bot", "echter mensch", "real person"];

    if (greetings.some((g) => t.includes(g))) return "greeting";
    if (thanks.some((w) => t.includes(w))) return "thanks";
    if (botQuestions.some((b) => t.includes(b))) return "bot_question";
    return null;
}

export function detectAbusive(text: string): boolean {
    if (!text) return false;
    const t = text.toLowerCase();
    const abusive = [
        "hurensohn", "arschloch", "fotze", "verpiss", "scheiss", "scheiße",
        "fuck", "bitch", "shit", "idiot", "dummkopf",
    ];
    return abusive.some((w) => t.includes(w));
}

// ============================================================================
// Text Processing Helpers
// ============================================================================

export function sanitizeText(input: string, maxLen = 500): string {
    if (!input) return "";
    const trimmed = input.trim().slice(0, maxLen);
    return trimmed.replace(/[\u0000-\u001F\u007F]/g, " ");
}

export function extractVinHsnTsn(text: string): { vin?: string; hsn?: string; tsn?: string } {
    const vinRegex = /\b([A-HJ-NPR-Z0-9]{17})\b/i;
    const hsnRegex = /(?:hsn|hersteller)[:\s]*([0-9]{4})\b/i;
    const tsnRegex = /(?:tsn|typ(?:schl[uü]ssel)?)[:\s]*([A-Z0-9]{3,8})\b/i;
    const vinMatch = text.match(vinRegex);
    const hsnMatch = text.match(hsnRegex);
    const tsnMatch = text.match(tsnRegex);
    const vin = vinMatch ? vinMatch[1].toUpperCase() : undefined;
    const hsn = hsnMatch ? hsnMatch[1] : undefined;
    const tsn = tsnMatch ? tsnMatch[1].toUpperCase() : undefined;
    return { vin, hsn, tsn };
}

export function hasVehicleHints(text: string): boolean {
    const t = text.toLowerCase();
    const brands = ["bmw", "audi", "vw", "volkswagen", "mercedes", "benz", "ford", "opel", "skoda", "seat", "toyota", "honda", "hyundai", "kia"];
    const yearPattern = /\b(19|20)\d{2}\b/;
    return brands.some((b) => t.includes(b)) || yearPattern.test(t);
}

// ============================================================================
// Intent Detection
// ============================================================================

export function detectIntent(text: string, hasVehicleImage: boolean): IntentResult {
    const t = (text || "").toLowerCase().trim();

    if (hasVehicleImage) {
        return { intent: "new_order" };
    }
    if (!t) {
        return { intent: "unknown" };
    }

    // OEM direct
    const oemPatterns = [/oem[:\s]+([A-Z0-9\-]+)/i, /teilenummer[:\s]+([A-Z0-9\-]+)/i];
    for (const p of oemPatterns) {
        const m = text.match(p);
        if (m) {
            return { intent: "oem_direct", extractedOem: m[1] };
        }
    }

    // Status
    const statusQuestions = ["status", "wie weit", "wie lange", "where is", "how long", "tracking", "lieferstatus"];
    if (statusQuestions.some((q) => t.includes(q))) return { intent: "status_question" };

    // Abort
    const abortTokens = ["abbrechen", "stornieren", "storno", "cancel", "nicht mehr", "kein bedarf"];
    if (abortTokens.some((a) => t.includes(a))) return { intent: "abort_order" };

    // Vehicle data / new order
    const vehicleTokens = ["brauche", "suche", "möchte", "want", "need", "looking for", "part for", "teil für"];
    if (vehicleTokens.some((v) => t.includes(v))) return { intent: "new_order" };

    if (hasVehicleHints(text)) {
        return { intent: "continue_order" };
    }

    return { intent: "unknown" };
}

// ============================================================================
// NLU Parsing (Gemini-based)
// ============================================================================

export async function parseUserMessage(text: string): Promise<ParsedUserMessage> {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not set");
        }

        const sanitized = sanitizeText(text);
        const rawText = await generateChatCompletion({
            messages: [
                { role: "system", content: TEXT_NLU_PROMPT },
                { role: "user", content: sanitized },
            ],
            responseFormat: "json_object",
            temperature: 0,
        });

        const start = rawText.indexOf("{");
        const end = rawText.lastIndexOf("}");
        const jsonString = start !== -1 && end !== -1 && end > start ? rawText.slice(start, end + 1) : rawText;
        const raw = JSON.parse(jsonString) as any;

        // Merge regex-preparsed VIN/HSN/TSN if NLU missed them
        const regexVehicle = extractVinHsnTsn(sanitized);
        if (regexVehicle.vin && !raw.vin) raw.vin = regexVehicle.vin;
        if (regexVehicle.hsn && !raw.hsn) raw.hsn = regexVehicle.hsn;
        if (regexVehicle.tsn && !raw.tsn) raw.tsn = regexVehicle.tsn;

        const intent =
            raw.intent === "greeting" ||
                raw.intent === "send_vehicle_doc" ||
                raw.intent === "request_part" ||
                raw.intent === "describe_symptoms" ||
                raw.intent === "other"
                ? raw.intent
                : "unknown";

        return {
            intent,
            make: raw.vehicle?.make ?? raw.make ?? null,
            model: raw.vehicle?.model ?? raw.model ?? null,
            year: raw.vehicle?.year ?? raw.year ?? null,
            engine: raw.engine ?? null,
            engineCode: raw.engineCode ?? null,
            engineKw: raw.engineKw ?? null,
            fuelType: raw.fuelType ?? null,
            emissionClass: raw.emissionClass ?? null,
            hsn: raw.hsn ?? null,
            tsn: raw.tsn ?? null,
            vin: raw.vin ?? null,
            isAutoPart: raw.is_auto_part ?? false,
            userPartText: raw.user_part_text ?? null,
            normalizedPartName: raw.normalized_part_name ?? null,
            partCategory: raw.part_category ?? null,
            position: raw.position ?? null,
            positionNeeded: raw.position_needed ?? false,
            sideNeeded: raw.side_needed ?? false,
            quantity: raw.quantity ?? null,
            symptoms: raw.symptoms ?? null,
            smalltalkType: raw.smalltalkType ?? null,
            smalltalkReply: raw.smalltalkReply ?? null,
        };
    } catch (error: any) {
        logger.error("parseUserMessage failed", { error: error?.message, text });

        return {
            intent: "unknown",
            isAutoPart: false,
            userPartText: null,
            normalizedPartName: null,
            partCategory: null,
            position: null,
            positionNeeded: false,
            sideNeeded: false,
            quantity: null,
            symptoms: null,
            smalltalkType: null,
            smalltalkReply: null,
        };
    }
}

// ============================================================================
// Exported helper: pickLanguageFromChoice
// ============================================================================

export function pickLanguageFromChoice(text: string): string | null {
    const t = text.toLowerCase();
    if (t.includes("1") || t.includes("deutsch")) return "de";
    if (t.includes("2") || t.includes("english")) return "en";
    if (t.includes("3") || t.includes("türk")) return "tr";
    if (t.includes("4") || t.includes("kurdi")) return "ku";
    if (t.includes("5") || t.includes("polsk")) return "pl";
    return null;
}
