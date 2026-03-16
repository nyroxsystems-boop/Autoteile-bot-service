/**
 * Bot Helpers — Shared utility functions for the WhatsApp Bot.
 *
 * Extracted from botLogicService.ts for clean separation of concerns.
 * Contains: orchestrator, smalltalk replies, follow-up question builders,
 * part info handling, price calculations, and general question answering.
 */

import { ConversationStatus } from "@adapters/supabaseService";
import { logger } from "@utils/logger";
import { generateChatCompletion } from "../intelligence/geminiService";
import { ORCHESTRATOR_PROMPT } from "../../prompts/orchestratorPrompt";
import { GENERAL_QA_SYSTEM_PROMPT } from "../../prompts/generalQaPrompt";
import { COLLECT_PART_BRAIN_PROMPT } from "../../prompts/collectPartBrainPrompt";
import { t } from "./botResponses";
import type { ParsedUserMessage, SmalltalkType } from "./nluService";

// ============================================================================
// Orchestrator Types
// ============================================================================

export type OrchestratorAction =
    | "ask_slot"
    | "confirm"
    | "oem_lookup"
    | "order_status"
    | "stock_check"
    | "price_quote"
    | "abort_order"
    | "new_order"
    | "escalate_human"
    | "smalltalk"
    | "abusive"
    | "noop";

export interface OrchestratorResult {
    action: OrchestratorAction;
    reply: string;
    slots: Record<string, any>;
    required_slots?: string[];
    confidence?: number;
}

export interface CollectPartBrainResult {
    replyText: string;
    nextStatus: ConversationStatus;
    slotsToAsk: string[];
    shouldApologize: boolean;
    detectedFrustration: boolean;
}

// ============================================================================
// Orchestrator
// ============================================================================

export async function callOrchestrator(payload: any): Promise<OrchestratorResult | null> {
    const startTime = Date.now();

    try {
        const userContent = JSON.stringify(payload);

        logger.info("🤖 Calling Orchestrator", {
            payloadSize: userContent.length,
            status: payload.conversation?.status,
            language: payload.conversation?.language,
            hasOCR: !!payload.ocr,
            messagePreview: payload.latestMessage?.substring(0, 100),
        });

        const raw = await generateChatCompletion({
            messages: [
                { role: "system", content: ORCHESTRATOR_PROMPT },
                { role: "user", content: userContent },
            ],
            temperature: 0,
            responseFormat: "json_object",
        });

        const elapsed = Date.now() - startTime;

        logger.info("✅ Orchestrator raw response received", {
            elapsed,
            responseLength: raw?.length || 0,
            responsePreview: raw?.substring(0, 200),
        });

        let parsed;
        try {
            parsed = JSON.parse(raw);
            logger.info("✅ JSON parsed successfully", {
                hasAction: !!parsed.action,
                action: parsed.action,
                hasReply: !!parsed.reply,
                hasSlotsCount: Object.keys(parsed.slots || {}).length,
            });
        } catch (parseErr: any) {
            logger.error("❌ JSON parsing failed", {
                error: parseErr.message,
                rawResponse: raw,
                responseType: typeof raw,
            });
            return null;
        }

        if (!parsed.action) {
            logger.error("❌ Orchestrator response missing 'action' field", { parsed, rawPreview: raw.slice(0, 500) });
            return null;
        }

        logger.info("✅ Orchestrator succeeded", {
            action: parsed.action,
            confidence: parsed.confidence,
            slotsCount: Object.keys(parsed.slots || {}).length,
            totalElapsed: Date.now() - startTime,
        });

        return {
            action: parsed.action as OrchestratorAction,
            reply: parsed.reply ?? "",
            slots: parsed.slots ?? {},
            required_slots: Array.isArray(parsed.required_slots) ? parsed.required_slots : [],
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 1,
        };
    } catch (err: any) {
        const elapsed = Date.now() - startTime;
        logger.error("Orchestrator call FAILED", {
            error: err?.message,
            errorType: err?.constructor?.name,
            errorCode: err?.code,
            statusCode: err?.status || err?.statusCode,
            elapsed,
            stack: err?.stack?.split("\n").slice(0, 5).join("\n"),
            isGeminiError: err?.constructor?.name?.includes("Gemini") || err?.message?.includes("Gemini"),
            isNetworkError: err?.code === "ECONNREFUSED" || err?.code === "ETIMEDOUT" || err?.code === "ENOTFOUND",
        });
        return null;
    }
}

// ============================================================================
// Smalltalk Reply Builder
// ============================================================================

export function buildSmalltalkReply(kind: SmalltalkType, lang: "de" | "en", stage: string | null): string {
    const needsVehicleDoc = stage === "awaiting_vehicle_document";
    const needsVehicleData = stage === "collecting_vehicle_data";
    const needsPartData = stage === "collecting_part_data";

    if (kind === "thanks") {
        return lang === "de"
            ? "Gern geschehen! Melden Sie sich einfach, wenn Sie noch ein Teil oder mehr Infos brauchen."
            : "You're welcome! Let me know if you need a part or any other help.";
    }

    if (kind === "bot_question") {
        return lang === "de"
            ? "Ich bin Ihr Teile-Assistent und helfe Ihnen, das richtige Ersatzteil zu finden. Schicken Sie mir Marke/Modell/Baujahr oder ein Foto vom Fahrzeugschein."
            : "I'm your parts assistant and can help you find the right part. Send me the car brand/model/year or a photo of the registration document.";
    }

    // greeting
    if (needsVehicleDoc) {
        return lang === "de"
            ? "Hi! 👋 Schicken Sie mir am besten zuerst ein Foto Ihres Fahrzeugscheins. Wenn Sie keins haben, nennen Sie mir bitte Marke, Modell, Baujahr und falls möglich Motor/HSN/TSN."
            : "Hi there! 👋 Please send a photo of your vehicle registration first. If you don't have one, tell me brand, model, year and, if possible, engine/HSN/TSN.";
    }
    if (needsVehicleData) {
        return lang === "de"
            ? "Hallo! 👋 Welche Fahrzeugdaten haben Sie für mich? Marke, Modell, Baujahr und Motor helfen mir am meisten."
            : "Hello! 👋 Which vehicle details do you have for me? Brand, model, year, and engine help the most.";
    }
    if (needsPartData) {
        return lang === "de"
            ? "Hey! 👋 Um Ihnen das richtige Teil zu finden, sagen Sie mir bitte, um welches Teil es geht und vorne/hinten, links/rechts."
            : "Hey! 👋 To find the right part, tell me which part you need and whether it's front/rear, left/right.";
    }

    return lang === "de"
        ? "Hallo! 👋 Wie kann ich Ihnen helfen? Suchen Sie ein Ersatzteil? Dann schicken Sie mir Marke/Modell/Baujahr oder ein Foto vom Fahrzeugschein."
        : "Hi! 👋 How can I help? Looking for a part? Share the car brand/model/year or send a photo of the registration.";
}

// ============================================================================
// Question Builders
// ============================================================================

export function needsVehicleDocumentHint(order: any): boolean {
    return order?.status === "choose_language" || order?.status === "collect_vehicle";
}

export function buildVehicleFollowUpQuestion(missingFields: string[], lang: string): string | null {
    if (!missingFields || missingFields.length === 0) return null;

    const qDe: Record<string, string> = {
        make: "Welche Automarke ist es?",
        model: "Welches Modell genau?",
        year: "Welches Baujahr hat Ihr Fahrzeug?",
        engine: "Welche Motorisierung ist verbaut (kW oder Motorkennbuchstabe)?",
        vin: "Haben Sie die Fahrgestellnummer (VIN) für mich?",
        hsn: "Haben Sie die HSN (Feld 2.1 im Fahrzeugschein)?",
        tsn: "Haben Sie die TSN (Feld 2.2 im Fahrzeugschein)?",
        vin_or_hsn_tsn_or_engine: "Haben Sie VIN oder HSN/TSN oder die Motorisierung (kW/MKB)?",
    };

    const qEn: Record<string, string> = {
        make: "What is the brand of your car?",
        model: "What is the exact model?",
        year: "What is the model year of your car?",
        engine: "Which engine is installed (kW or engine code)?",
        vin: "Do you have the VIN (vehicle identification number)?",
        hsn: "Do you have the HSN (field 2.1 on the registration)?",
        tsn: "Do you have the TSN (field 2.2 on the registration)?",
        vin_or_hsn_tsn_or_engine: "Do you have VIN or HSN/TSN or at least the engine (kW/engine code)?",
    };

    const key = missingFields[0];
    const map = lang === "de" ? qDe : qEn;
    return map[key] || null;
}

export function buildPartFollowUpQuestion(missingFields: string[], lang: "de" | "en"): string | null {
    if (!missingFields || missingFields.length === 0) return null;

    const field = missingFields[0];
    if (field === "part_name") return t("collect_part", lang);
    if (field === "position") return t("collect_part_position", lang);
    return null;
}

// ============================================================================
// Part Required Fields
// ============================================================================

export const partRequiredFields: Record<string, string[]> = {
    brake_caliper: ["position"],
    brake_disc: ["position", "disc_diameter"],
    brake_pad: ["position"],
    shock_absorber: ["position"],
};

export function detectNoVehicleDocument(text: string): boolean {
    if (!text) return false;
    const t = text.toLowerCase();
    const patterns = [
        "kein fahrzeugschein", "keinen fahrzeugschein",
        "brief nicht da", "brief habe ich nicht",
        "hab den schein nicht", "hab kein schein", "hab keinen schein",
        "keine papiere", "papiere nicht da",
        "no registration", "no vehicle document", "lost my papers",
    ];
    return patterns.some((p) => t.includes(p));
}

export function hasSufficientPartInfo(parsed: ParsedUserMessage, orderData: any): { ok: boolean; missing: string[] } {
    const normalizedPartName = parsed.normalizedPartName || orderData?.requestedPart || orderData?.partText || null;
    if (!normalizedPartName) return { ok: false, missing: ["part_name"] };

    const category = parsed.partCategory || orderData?.partCategory || null;
    const positionNeededFromCategory =
        category === "brake_component" || category === "suspension_component" || category === "body_component";
    const positionNeeded = parsed.positionNeeded === true || positionNeededFromCategory;

    if (positionNeeded) {
        const position = parsed.position || orderData?.partPosition || null;
        if (!position) return { ok: false, missing: ["position"] };
    }

    return { ok: true, missing: [] };
}

export function mergePartInfo(existing: any, parsed: ParsedUserMessage) {
    const merged: any = { ...existing, partDetails: { ...(existing?.partDetails || {}) } };

    if (parsed.partCategory) merged.partCategory = parsed.partCategory;
    if (parsed.position) merged.partPosition = parsed.position;

    if (parsed.partDetails?.discDiameter !== undefined && parsed.partDetails?.discDiameter !== null) {
        merged.partDetails.discDiameter = parsed.partDetails.discDiameter;
    }
    if (parsed.partDetails?.suspensionType) {
        merged.partDetails.suspensionType = parsed.partDetails.suspensionType;
    }

    const candidatePartTexts: (string | null | undefined)[] = [
        parsed.normalizedPartName,
        parsed.userPartText,
        (parsed as any).part,
    ];

    for (const candidate of candidatePartTexts) {
        if (candidate && candidate.trim()) {
            merged.partText = merged.partText ? `${merged.partText}\n${candidate.trim()}` : candidate.trim();
            break;
        }
    }

    return merged;
}

// ============================================================================
// Price Calculation
// ============================================================================

export function calculateEndPrice(buyingPrice: number, margin?: number): number {
    // Priority: explicit margin param > env var > 25% default
    const m = margin ?? (process.env.DEALER_MARGIN_PERCENT
      ? parseFloat(process.env.DEALER_MARGIN_PERCENT) / 100
      : 0.25);
    const raw = buyingPrice * (1 + m);
    // Round to .99 pattern for professional pricing (89.99 instead of 90.00)
    const floor = Math.floor(raw);
    return raw - floor > 0.5 ? floor + 0.99 : (floor > 0 ? floor - 0.01 : raw);
}

export function calculateEstimatedDeliveryRange(days: number): string {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + Math.max(1, days));
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    return `${fmt(startDate)} – ${fmt(endDate)}`;
}

// ============================================================================
// General Question Answering
// ============================================================================

export async function answerGeneralQuestion(params: {
    userText: string;
    language: string;
    missingVehicleInfo: string[];
    knownVehicleSummary: string;
}): Promise<string> {
    try {
        const generalQaMessages = [
            { role: "system" as const, content: GENERAL_QA_SYSTEM_PROMPT },
            {
                role: "user" as const,
                content: JSON.stringify({
                    userQuestion: params.userText,
                    language: params.language,
                    missingVehicleInfo: params.missingVehicleInfo,
                    knownVehicleSummary: params.knownVehicleSummary,
                }),
            },
        ];
        return await generateChatCompletion({ messages: generalQaMessages, temperature: 0.3 });
    } catch (err: any) {
        logger.error("General QA failed", { error: err?.message });
        return params.language === "de"
            ? "Entschuldigung, ich konnte Ihre Frage nicht beantworten. Fragen Sie gerne nochmal oder nennen Sie mir ein konkretes Ersatzteil."
            : "Sorry, I couldn't answer your question. Feel free to ask again or name a specific spare part.";
    }
}

// ============================================================================
// Collect Part Brain
// ============================================================================

export async function runCollectPartBrain(params: {
    userText: string;
    parsed: ParsedUserMessage;
    order: any;
    orderData: any;
    language: string;
    lastQuestionType: string | null;
}): Promise<CollectPartBrainResult> {
    try {
        const payload = {
            userText: params.userText,
            parsedMessage: params.parsed,
            currentVehicle: params.order,
            currentPartInfo: params.orderData,
            language: params.language,
            lastQuestionType: params.lastQuestionType,
        };

        const raw = await generateChatCompletion({
            messages: [
                { role: "system", content: COLLECT_PART_BRAIN_PROMPT },
                { role: "user", content: JSON.stringify(payload) },
            ],
            responseFormat: "json_object",
            temperature: 0,
        });

        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        const jsonStr = start !== -1 && end !== -1 && end > start ? raw.slice(start, end + 1) : raw;
        const result = JSON.parse(jsonStr);

        return {
            replyText: result.replyText ?? result.reply ?? "",
            nextStatus: result.nextStatus ?? "collect_part",
            slotsToAsk: result.slotsToAsk ?? [],
            shouldApologize: result.shouldApologize ?? false,
            detectedFrustration: result.detectedFrustration ?? false,
        };
    } catch (err: any) {
        logger.error("CollectPartBrain failed", { error: err?.message });
        return {
            replyText:
                params.language === "de"
                    ? "Bitte nennen Sie mir das Ersatzteil, das Sie suchen."
                    : "Please tell me which spare part you need.",
            nextStatus: "collect_part" as ConversationStatus,
            slotsToAsk: ["part_name"],
            shouldApologize: false,
            detectedFrustration: false,
        };
    }
}

// ============================================================================
// Misc Helpers
// ============================================================================

export function shortOrderLabel(o: { id: string; vehicle_description?: string | null; part_description?: string | null }) {
    const idShort = o.id.slice(0, 8);
    const vehicle = o.vehicle_description || o.part_description || "Anfrage";
    return `${idShort} (${vehicle.slice(0, 40)})`;
}

export async function verifyOemWithAi(params: {
    vehicle: any;
    part: string;
    oem: string;
    language: string;
}): Promise<boolean> {
    if (!process.env.GEMINI_API_KEY) return true;
    try {
        const prompt =
            'Prüfe, ob die OEM-Nummer zum Fahrzeug und Teil plausibel ist. Antworte NUR mit JSON: {"ok":true|false,"reason":"..."}.\n' +
            `Fahrzeug: ${JSON.stringify(params.vehicle)}\nTeil: ${params.part}\nOEM: ${params.oem}\n` +
            "Setze ok=false nur wenn OEM offensichtlich nicht zum Fahrzeug/Teil passen kann.";

        const raw = await generateChatCompletion({
            messages: [{ role: "user", content: prompt }],
            responseFormat: "json_object",
            temperature: 0,
        });
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        const jsonString = start !== -1 && end !== -1 && end > start ? raw.slice(start, end + 1) : raw;
        const parsed = JSON.parse(jsonString);
        return parsed.ok !== false;
    } catch (err: any) {
        logger.warn("OEM AI verification skipped", { error: err?.message });
        return true;
    }
}
