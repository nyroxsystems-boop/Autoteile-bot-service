"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadFromTwilio = downloadFromTwilio;
exports.extractVehicleDataFromImage = extractVehicleDataFromImage;
exports.understandUserText = understandUserText;
exports.parseUserMessage = parseUserMessage;
exports.handleIncomingBotMessage = handleIncomingBotMessage;
// Gemini AI Service (replaces OpenAI)
const node_fetch_1 = __importDefault(require("node-fetch"));
const supabaseService_1 = require("../adapters/supabaseService");
const oemRequiredFieldsService_1 = require("../intelligence/oemRequiredFieldsService");
const oemService = __importStar(require("../intelligence/oemService"));
const logger_1 = require("../../utils/logger");
const scrapingService_1 = require("../scraping/scrapingService");
const generalQaPrompt_1 = require("../../prompts/generalQaPrompt");
const textNluPrompt_1 = require("../../prompts/textNluPrompt");
const collectPartBrainPrompt_1 = require("../../prompts/collectPartBrainPrompt");
const httpClient_1 = require("../../utils/httpClient");
const orchestratorPrompt_1 = require("../../prompts/orchestratorPrompt");
const geminiService_1 = require("../intelligence/geminiService");
const conversationIntelligence_1 = require("../intelligence/conversationIntelligence");
const vehicleGuard_1 = require("../intelligence/vehicleGuard");
const botResponses_1 = require("./botResponses");
const fs = __importStar(require("fs/promises"));
const featureFlags_1 = require("./featureFlags");
// REMOVED: LangChain agent — dead code, fallback path always used
// import { langchainCallOrchestrator } from '../intelligence/langchainAgent';
const langchainCallOrchestrator = async (_payload) => null;
const phoneMerchantMapper_1 = require("../adapters/phoneMerchantMapper");
// Lazy accessor so tests can mock `supabaseService` after this module was loaded.
function getSupa() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("../adapters/supabaseService");
}
/**
 * Berechnet den Endpreis für den Kunden inkl. Händler-Marge.
 */
function calculateEndPrice(buyingPrice, margin) {
    const m = margin ? (1 + margin / 100) : (Number(process.env.DEALER_MARGIN) || 1.25);
    return Math.round(buyingPrice * m * 100) / 100;
}
function calculateEstimatedDeliveryRange(days) {
    const today = new Date();
    const min = new Date();
    min.setDate(today.getDate() + days);
    const max = new Date();
    max.setDate(today.getDate() + days + 2);
    const fmt = (d) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    return `${fmt(min)} - ${fmt(max)}`;
}
// Gemini is initialized in geminiService.ts
async function answerGeneralQuestion(params) {
    const { userText, language, missingVehicleInfo, knownVehicleSummary } = params;
    let missingInfoSentence = "";
    if (missingVehicleInfo.length > 0) {
        if (language === "de") {
            missingInfoSentence =
                "\n\nDamit ich passende Teile finden kann, brauche ich noch: " + missingVehicleInfo.join(", ") + ".";
        }
        else {
            missingInfoSentence =
                "\n\nTo find the correct parts, I still need: " + missingVehicleInfo.join(", ") + ".";
        }
    }
    const userPrompt = (language === "de"
        ? `Nutzerfrage: "${userText}"\n\nBereits bekannte Fahrzeugdaten: ${knownVehicleSummary}\nNoch fehlende Infos: ${missingVehicleInfo.join(", ") || "keine"}`
        : `User question: "${userText}"\n\nKnown vehicle data: ${knownVehicleSummary}\nMissing info: ${missingVehicleInfo.join(", ") || "none"}`) + "\n\nBitte beantworte die Frage oben.";
    try {
        const text = await (0, geminiService_1.generateChatCompletion)({
            messages: [
                { role: "system", content: generalQaPrompt_1.GENERAL_QA_SYSTEM_PROMPT },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.2
        });
        return (text?.trim() || "") + missingInfoSentence;
    }
    catch (err) {
        logger_1.logger.error("General QA failed", { error: err?.message });
        return language === "de"
            ? "Gute Frage! Leider kann ich sie gerade nicht beantworten. Versuch es bitte später erneut."
            : "Good question! I can’t answer it right now, please try again later.";
    }
}
async function runCollectPartBrain(params) {
    const payload = {
        userText: sanitizeText(params.userText, 1000),
        parsed: params.parsed,
        orderData: params.orderData || {},
        language: params.language,
        currentStatus: "collect_part",
        lastQuestionType: params.lastQuestionType
    };
    try {
        const rawText = await (0, geminiService_1.generateChatCompletion)({
            messages: [
                { role: "system", content: collectPartBrainPrompt_1.COLLECT_PART_BRAIN_PROMPT },
                { role: "user", content: JSON.stringify(payload) }
            ],
            responseFormat: "json_object",
            temperature: 0.2
        });
        const start = rawText.indexOf("{");
        const end = rawText.lastIndexOf("}");
        const jsonString = start !== -1 && end !== -1 && end > start ? rawText.slice(start, end + 1) : rawText;
        const raw = JSON.parse(jsonString);
        return {
            replyText: raw.replyText ?? "",
            nextStatus: raw.nextStatus ?? "collect_part",
            slotsToAsk: Array.isArray(raw.slotsToAsk) ? raw.slotsToAsk : [],
            shouldApologize: Boolean(raw.shouldApologize),
            detectedFrustration: Boolean(raw.detectedFrustration)
        };
    }
    catch (error) {
        logger_1.logger.error("runCollectPartBrain failed", { error: error?.message });
        return {
            replyText: params.language === "en"
                ? "Please tell me which exact part you need and, if relevant, for which side/axle."
                : "Bitte teilen Sie mir mit, welches Teil Sie genau benötigen und falls relevant, für welche Achse/Seite.",
            nextStatus: "collect_part",
            slotsToAsk: [],
            shouldApologize: false,
            detectedFrustration: false
        };
    }
}
// Pflichtfelder pro Teilkategorie (Minimalanforderungen für OEM-Ermittlung)
const partRequiredFields = {
    brake_caliper: ["position"],
    brake_disc: ["position", "disc_diameter"],
    brake_pad: ["position"],
    shock_absorber: ["position"]
};
// ------------------------------
// Hilfsfunktionen
// ------------------------------
function detectLanguageSelection(text) {
    if (!text)
        return null;
    const t = text.trim().toLowerCase();
    if (["1", "de", "deutsch", "german", "ger"].includes(t))
        return "de";
    if (["2", "en", "english", "englisch", "eng"].includes(t))
        return "en";
    if (["3", "tr", "türkçe", "turkce", "turkish", "türkisch"].includes(t))
        return "tr";
    if (["4", "ku", "kurdî", "kurdi", "kurdisch", "kurdish"].includes(t))
        return "ku";
    if (["5", "pl", "polski", "polnisch", "polish"].includes(t))
        return "pl";
    return null;
}
function detectLanguageFromText(text) {
    const t = text?.toLowerCase() ?? "";
    const germanHints = ["hallo", "moin", "servus", "grüß", "danke", "tschau", "bitte"];
    const englishHints = ["hello", "hi", "hey", "thanks", "thank you", "cheers"];
    if (germanHints.some((w) => t.includes(w)))
        return "de";
    if (englishHints.some((w) => t.includes(w)))
        return "en";
    return null;
}
function needsVehicleDocumentHint(order) {
    return order?.status === "choose_language" || order?.status === "collect_vehicle";
}
function detectSmalltalk(text) {
    const t = text?.toLowerCase() ?? "";
    if (!t)
        return null;
    const greetings = ["hallo", "hi", "hello", "hey", "moin", "servus", "guten tag", "good morning", "good evening"];
    const thanks = ["danke", "vielen dank", "thx", "thanks", "thank you"];
    const botQuestions = ["bist du ein bot", "are you a bot", "echter mensch", "real person"];
    if (greetings.some((g) => t.includes(g)))
        return "greeting";
    if (thanks.some((w) => t.includes(w)))
        return "thanks";
    if (botQuestions.some((b) => t.includes(b)))
        return "bot_question";
    return null;
}
async function verifyOemWithAi(params) {
    if (!process.env.GEMINI_API_KEY)
        return true;
    try {
        const prompt = "Prüfe, ob die OEM-Nummer zum Fahrzeug und Teil plausibel ist. Antworte NUR mit JSON: {\"ok\":true|false,\"reason\":\"...\"}.\n" +
            `Fahrzeug: ${JSON.stringify(params.vehicle)}\nTeil: ${params.part}\nOEM: ${params.oem}\n` +
            "Setze ok=false nur wenn OEM offensichtlich nicht zum Fahrzeug/Teil passen kann.";
        const raw = await (0, geminiService_1.generateChatCompletion)({
            messages: [{ role: "user", content: prompt }],
            responseFormat: "json_object",
            temperature: 0
        });
        const start = raw.indexOf("{");
        const end = raw.lastIndexOf("}");
        const jsonString = start !== -1 && end !== -1 && end > start ? raw.slice(start, end + 1) : raw;
        const parsed = JSON.parse(jsonString);
        return parsed.ok !== false;
    }
    catch (err) {
        logger_1.logger.warn("OEM AI verification skipped", { error: err?.message });
        return true;
    }
}
/**
 * Detects obviously abusive or insulting messages with a simple word list.
 * Returns true when the message should be treated as abuse (and not advance the flow).
 */
function detectAbusive(text) {
    if (!text)
        return false;
    const t = text.toLowerCase();
    // Short list of strong insults / slurs commonly used in German and English.
    // This is intentionally conservative — tune/extend as needed.
    const abusive = [
        "hurensohn",
        "arschloch",
        "fotze",
        "verpiss",
        "scheiss",
        "scheiße",
        "fuck",
        "bitch",
        "shit",
        "idiot",
        "dummkopf"
    ];
    return abusive.some((w) => t.includes(w));
}
async function callOrchestrator(payload) {
    const startTime = Date.now();
    // 🚀 LANGCHAIN AGENT FEATURE FLAG (with percentage rollout)
    const userId = payload.from || payload.phoneNumber || payload.sender;
    if ((0, featureFlags_1.isEnabled)(featureFlags_1.FF.USE_AI_ORCHESTRATOR, { userId })) {
        try {
            const sessionId = userId || "default";
            const result = await langchainCallOrchestrator({
                ...payload,
                sessionId,
            });
            if (result && result.action && result.reply) {
                logger_1.logger.info("Langchain orchestrator succeeded", {
                    sessionId,
                    action: result.action,
                    confidence: result.confidence,
                    elapsed: Date.now() - startTime
                });
                // Cast to OrchestratorResult (langchain returns compatible structure)
                return {
                    action: result.action,
                    reply: result.reply,
                    slots: result.slots || {},
                    required_slots: result.required_slots,
                    confidence: result.confidence
                };
            }
        }
        catch (langchainError) {
            logger_1.logger.warn("Langchain agent failed, falling back to legacy", {
                error: langchainError?.message,
                userId,
                elapsed: Date.now() - startTime
            });
            // Fall through to legacy implementation
        }
    }
    try {
        const userContent = JSON.stringify(payload);
        // LOG: What we're sending to OpenAI
        logger_1.logger.info("🤖 Calling Orchestrator", {
            payloadSize: userContent.length,
            status: payload.conversation?.status,
            language: payload.conversation?.language,
            hasOCR: !!payload.ocr,
            messagePreview: payload.latestMessage?.substring(0, 100)
        });
        // Use dynamic require so tests that mock `./openAiService` after this module
        // was loaded (compiled dist tests) still influence the invoked function.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const gen = require("../intelligence/openAiService").generateChatCompletion;
        const raw = await gen({
            messages: [
                { role: "system", content: orchestratorPrompt_1.ORCHESTRATOR_PROMPT },
                { role: "user", content: userContent }
            ],
            model: "gpt-4.1-mini",
            responseFormat: "json_object",
            temperature: 0
        });
        const elapsed = Date.now() - startTime;
        // LOG: Raw OpenAI response
        logger_1.logger.info("✅ Orchestrator raw response received", {
            elapsed,
            responseLength: raw?.length || 0,
            responsePreview: raw?.substring(0, 200)
        });
        // Try to parse JSON
        let parsed;
        try {
            parsed = JSON.parse(raw);
            logger_1.logger.info("✅ JSON parsed successfully", {
                hasAction: !!parsed.action,
                action: parsed.action,
                hasReply: !!parsed.reply,
                hasSlotsCount: Object.keys(parsed.slots || {}).length
            });
        }
        catch (parseErr) {
            logger_1.logger.error("❌ JSON parsing failed", {
                error: parseErr.message,
                rawResponse: raw,
                responseType: typeof raw
            });
            return null;
        }
        // Validate required fields
        if (!parsed.action) {
            logger_1.logger.error("❌ Orchestrator response missing 'action' field", {
                parsed,
                rawPreview: raw.slice(0, 500)
            });
            return null;
        }
        logger_1.logger.info("✅ Orchestrator succeeded", {
            action: parsed.action,
            confidence: parsed.confidence,
            slotsCount: Object.keys(parsed.slots || {}).length,
            totalElapsed: Date.now() - startTime
        });
        return {
            action: parsed.action,
            reply: parsed.reply ?? "",
            slots: parsed.slots ?? {},
            required_slots: Array.isArray(parsed.required_slots) ? parsed.required_slots : [],
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 1
        };
    }
    catch (err) {
        const elapsed = Date.now() - startTime;
        // Structured error logging - no console.error
        logger_1.logger.error("Orchestrator call FAILED", {
            error: err?.message,
            errorType: err?.constructor?.name,
            errorCode: err?.code,
            statusCode: err?.status || err?.statusCode,
            elapsed,
            stack: err?.stack?.split('\n').slice(0, 5).join('\n'),
            isGeminiError: err?.constructor?.name?.includes('Gemini') || err?.message?.includes('Gemini'),
            isNetworkError: err?.code === 'ECONNREFUSED' || err?.code === 'ETIMEDOUT' || err?.code === 'ENOTFOUND'
        });
        return null;
    }
}
function buildSmalltalkReply(kind, lang, stage) {
    const needsVehicleDoc = stage === "awaiting_vehicle_document";
    const needsVehicleData = stage === "collecting_vehicle_data";
    const needsPartData = stage === "collecting_part_data";
    if (kind === "thanks") {
        return lang === "de"
            ? "Gern geschehen! Melden Sie sich einfach, wenn Sie noch ein Teil oder mehr Infos brauchen."
            : "You’re welcome! Let me know if you need a part or any other help.";
    }
    if (kind === "bot_question") {
        return lang === "de"
            ? "Ich bin Ihr Teile-Assistent und helfe Ihnen, das richtige Ersatzteil zu finden. Schicken Sie mir Marke/Modell/Baujahr oder ein Foto vom Fahrzeugschein."
            : "I’m your parts assistant and can help you find the right part. Send me the car brand/model/year or a photo of the registration document.";
    }
    // greeting
    if (needsVehicleDoc) {
        return lang === "de"
            ? "Hi! 👋 Schicken Sie mir am besten zuerst ein Foto Ihres Fahrzeugscheins. Wenn Sie keins haben, nennen Sie mir bitte Marke, Modell, Baujahr und falls möglich Motor/HSN/TSN."
            : "Hi there! 👋 Please send a photo of your vehicle registration first. If you don’t have one, tell me brand, model, year and, if possible, engine/HSN/TSN.";
    }
    if (needsVehicleData) {
        return lang === "de"
            ? "Hallo! 👋 Welche Fahrzeugdaten haben Sie für mich? Marke, Modell, Baujahr und Motor helfen mir am meisten."
            : "Hello! 👋 Which vehicle details do you have for me? Brand, model, year, and engine help the most.";
    }
    if (needsPartData) {
        return lang === "de"
            ? "Hey! 👋 Um Ihnen das richtige Teil zu finden, sagen Sie mir bitte, um welches Teil es geht und vorne/hinten, links/rechts."
            : "Hey! 👋 To find the right part, tell me which part you need and whether it’s front/rear, left/right.";
    }
    return lang === "de"
        ? "Hallo! 👋 Wie kann ich Ihnen helfen? Suchen Sie ein Ersatzteil? Dann schicken Sie mir Marke/Modell/Baujahr oder ein Foto vom Fahrzeugschein."
        : "Hi! 👋 How can I help? Looking for a part? Share the car brand/model/year or send a photo of the registration.";
}
/**
 * Simpler Heuristik-Check, ob der Kunde sagt, dass er keinen Fahrzeugschein hat.
 */
function detectNoVehicleDocument(text) {
    if (!text)
        return false;
    const t = text.toLowerCase();
    const patterns = [
        "kein fahrzeugschein", "keinen fahrzeugschein",
        "brief nicht da", "brief habe ich nicht",
        "hab den schein nicht", "hab kein schein", "hab keinen schein",
        "keine papiere", "papiere nicht da",
        "no registration", "no vehicle document", "lost my papers"
    ];
    return patterns.some(p => t.includes(p));
}
/**
 * Ermittelt, ob die Teilinfos vollständig genug sind, um OEM zu starten.
 */
function hasSufficientPartInfo(parsed, orderData) {
    // 1) Haben wir ein Teil?
    const normalizedPartName = parsed.normalizedPartName || orderData?.requestedPart || orderData?.partText || null;
    if (!normalizedPartName) {
        return { ok: false, missing: ["part_name"] };
    }
    // 2) Braucht dieses Teil eine Position?
    const category = parsed.partCategory || orderData?.partCategory || null;
    // Aus der NLU-Kategorie ableiten, ob eine Position typischerweise nötig ist
    const positionNeededFromCategory = category === "brake_component" || category === "suspension_component" || category === "body_component";
    const positionNeeded = parsed.positionNeeded === true || positionNeededFromCategory;
    // 3) Wenn Position nötig, aber (noch) keine vorhanden → nachfragen
    if (positionNeeded) {
        const position = parsed.position || orderData?.partPosition || null;
        if (!position) {
            return { ok: false, missing: ["position"] };
        }
    }
    return { ok: true, missing: [] };
}
/**
 * Baut eine Rückfrage für fehlende Fahrzeug-Felder.
 */
function buildVehicleFollowUpQuestion(missingFields, lang) {
    if (!missingFields || missingFields.length === 0)
        return null;
    const qDe = {
        make: "Welche Automarke ist es?",
        model: "Welches Modell genau?",
        year: "Welches Baujahr hat Ihr Fahrzeug?",
        engine: "Welche Motorisierung ist verbaut (kW oder Motorkennbuchstabe)?",
        vin: "Haben Sie die Fahrgestellnummer (VIN) für mich?",
        hsn: "Haben Sie die HSN (Feld 2.1 im Fahrzeugschein)?",
        tsn: "Haben Sie die TSN (Feld 2.2 im Fahrzeugschein)?",
        vin_or_hsn_tsn_or_engine: "Haben Sie VIN oder HSN/TSN oder die Motorisierung (kW/MKB)?"
    };
    const qEn = {
        make: "What is the brand of your car?",
        model: "What is the exact model?",
        year: "What is the model year of your car?",
        engine: "Which engine is installed (kW or engine code)?",
        vin: "Do you have the VIN (vehicle identification number)?",
        hsn: "Do you have the HSN (field 2.1 on the registration)?",
        tsn: "Do you have the TSN (field 2.2 on the registration)?",
        vin_or_hsn_tsn_or_engine: "Do you have VIN or HSN/TSN or at least the engine (kW/engine code)?"
    };
    const key = missingFields[0];
    const map = lang === "de" ? qDe : qEn;
    return map[key] || null;
}
/**
 * Baut eine Rückfrage für fehlende Teil-Felder.
 */
function buildPartFollowUpQuestion(missingFields, lang) {
    if (!missingFields || missingFields.length === 0)
        return null;
    const field = missingFields[0];
    if (field === "part_name") {
        return (0, botResponses_1.t)('collect_part', lang);
    }
    if (field === "position") {
        return (0, botResponses_1.t)('collect_part_position', lang);
    }
    return null;
}
/**
 * Merges newly parsed part info into the existing part info stored in order_data.
 * Fields are only overwritten when new values are provided.
 */
function mergePartInfo(existing, parsed) {
    const merged = {
        ...existing,
        partDetails: { ...(existing?.partDetails || {}) }
    };
    // Kategorie übernehmen (z.B. brake_component, ignition_component ...)
    if (parsed.partCategory) {
        merged.partCategory = parsed.partCategory;
    }
    // Position (front / rear / front_left / ...)
    if (parsed.position) {
        merged.partPosition = parsed.position;
    }
    // Alte Detail-Felder bleiben für Bremsscheiben/Fahrwerk (falls du sie später wieder nutzt)
    if (parsed.partDetails?.discDiameter !== undefined && parsed.partDetails?.discDiameter !== null) {
        merged.partDetails.discDiameter = parsed.partDetails.discDiameter;
    }
    if (parsed.partDetails?.suspensionType) {
        merged.partDetails.suspensionType = parsed.partDetails.suspensionType;
    }
    // NEU: Part-Text aus normalizedPartName / userPartText / (legacy) parsed.part
    const candidatePartTexts = [
        parsed.normalizedPartName,
        parsed.userPartText,
        parsed.part
    ];
    for (const candidate of candidatePartTexts) {
        if (candidate && candidate.trim()) {
            merged.partText = merged.partText ? `${merged.partText}\n${candidate.trim()}` : candidate.trim();
            break;
        }
    }
    return merged;
}
async function runOemLookupAndScraping(orderId, language, parsed, orderData, partDescription, 
// Optional override vehicle (e.g. OCR result) — used when DB upsert failed but OCR provided enough data
vehicleOverride) {
    // P0 #1: Zwischennachricht — Tell user we're searching (eliminates dead silence)
    // We return a search-indicator as a "pre-reply" that the caller can send immediately
    // while the actual OEM resolution runs. For the current architecture, we log it as
    // a hint. The actual pre-reply is sent by the botWorker via sendTwilioReply.
    logger_1.logger.info('[OEMLookup] Starting OEM resolution', { orderId, language });
    const vehicle = vehicleOverride ?? (await (0, supabaseService_1.getVehicleForOrder)(orderId));
    const engineVal = vehicle?.engineCode ?? vehicle?.engine ?? undefined;
    const vehicleForOem = {
        make: vehicle?.make ?? undefined,
        model: vehicle?.model ?? undefined,
        year: vehicle?.year ?? undefined,
        engine: engineVal,
        engineKw: vehicle?.engineKw ?? undefined,
        vin: vehicle?.vin ?? undefined,
        hsn: vehicle?.hsn ?? undefined,
        tsn: vehicle?.tsn ?? undefined
    };
    const missingVehicleFields = (0, oemRequiredFieldsService_1.determineRequiredFields)(vehicleForOem);
    if (missingVehicleFields.length > 0) {
        const q = buildVehicleFollowUpQuestion(missingVehicleFields, language ?? "de");
        return {
            replyText: q ||
                (language === "en"
                    ? "I need a bit more vehicle info."
                    : "Ich brauche noch ein paar Fahrzeugdaten."),
            nextStatus: "collect_vehicle"
        };
    }
    const partText = parsed.part ||
        orderData?.requestedPart ||
        orderData?.partText ||
        partDescription ||
        (language === "en" ? "the part you mentioned" : "das genannte Teil");
    try {
        // Prefer the modern `resolveOEMForOrder` if provided by the module.
        // Some tests/mock setups stub `resolveOEM` only, so fall back to that shape.
        let oemResult;
        if (typeof oemService.resolveOEMForOrder === "function") {
            oemResult = await oemService.resolveOEMForOrder(orderId, {
                make: vehicleForOem.make ?? null,
                model: vehicleForOem.model ?? null,
                year: vehicleForOem.year ?? null,
                engine: vehicleForOem.engine ?? null,
                engineKw: vehicle?.engineKw ?? null,
                vin: vehicleForOem.vin ?? null,
                hsn: vehicleForOem.hsn ?? null,
                tsn: vehicleForOem.tsn ?? null
            }, partText);
        }
        else if (typeof oemService.resolveOEM === "function") {
            // legacy adapter: resolveOEM(order, part) -> OemResolutionResult
            try {
                const legacy = await oemService.resolveOEM({
                    make: vehicleForOem.make ?? undefined,
                    model: vehicleForOem.model ?? undefined,
                    year: vehicleForOem.year ?? undefined,
                    engine: vehicleForOem.engine ?? undefined,
                    engineKw: vehicle?.engineKw ?? undefined,
                    vin: vehicleForOem.vin ?? undefined,
                    hsn: vehicleForOem.hsn ?? undefined,
                    tsn: vehicleForOem.tsn ?? undefined
                }, partText);
                oemResult = {
                    primaryOEM: legacy.oemNumber ?? (legacy.oem ?? undefined),
                    overallConfidence: legacy.success ? 0.85 : 0,
                    candidates: legacy.oemData?.candidates ?? [],
                    notes: legacy.message ?? undefined,
                    tecdocPartsouqResult: undefined
                };
            }
            catch (err) {
                logger_1.logger.warn("Legacy resolveOEM adapter failed", { orderId, error: err?.message });
                oemResult = { primaryOEM: undefined, overallConfidence: 0, candidates: [], notes: undefined };
            }
        }
        else {
            logger_1.logger.warn("No OEM resolver available", { orderId });
            oemResult = { primaryOEM: undefined, overallConfidence: 0, candidates: [], notes: undefined };
        }
        try {
            await (0, supabaseService_1.updateOrderData)(orderId, {
                oemNumber: oemResult.primaryOEM ?? null,
                oemConfidence: oemResult.overallConfidence ?? null,
                oemNotes: oemResult.notes ?? null,
                oemCandidates: oemResult.candidates ?? [],
                oemTecdocPartsouq: oemResult.tecdocPartsouqResult ?? null
            });
            try {
                await (0, supabaseService_1.updateOrderOEM)(orderId, {
                    oemStatus: oemResult.primaryOEM ? "resolved" : "not_found",
                    oemError: oemResult.primaryOEM ? null : oemResult.notes ?? null,
                    oemData: oemResult,
                    oemNumber: oemResult.primaryOEM ?? null
                });
            }
            catch (err) {
                logger_1.logger.warn("Failed to persist OEM fields", { orderId, error: err?.message });
            }
        }
        catch (err) {
            logger_1.logger.warn("Failed to persist OEM resolver output", { orderId, error: err?.message });
        }
        if (oemResult.primaryOEM && oemResult.overallConfidence >= 0.7) {
            const cautious = oemResult.overallConfidence < 0.9;
            try {
                const scrapeResult = await (0, scrapingService_1.scrapeOffersForOrder)(orderId, oemResult.primaryOEM);
                if (scrapeResult && scrapeResult.jobId) {
                    try {
                        if (typeof supabaseService_1.persistScrapeResult === "function") {
                            await (0, supabaseService_1.persistScrapeResult)(orderId, {
                                scrapeTaskId: scrapeResult.jobId,
                                scrapeStatus: "started",
                                scrapeResult: scrapeResult
                            });
                        }
                        else if (typeof supabaseService_1.updateOrderScrapeTask === "function") {
                            await (0, supabaseService_1.updateOrderScrapeTask)(orderId, {
                                scrapeTaskId: scrapeResult.jobId,
                                scrapeStatus: "started",
                                scrapeResult: scrapeResult
                            });
                        }
                    }
                    catch (uErr) {
                        logger_1.logger.warn("Failed to persist scrape job id", { orderId, error: uErr?.message ?? uErr });
                    }
                }
                else {
                    try {
                        if (typeof supabaseService_1.persistScrapeResult === "function") {
                            await (0, supabaseService_1.persistScrapeResult)(orderId, {
                                scrapeStatus: (scrapeResult && scrapeResult.ok) ? "done" : "unknown",
                                scrapeResult: scrapeResult ?? null
                            });
                        }
                        else if (typeof supabaseService_1.updateOrderScrapeTask === "function") {
                            await (0, supabaseService_1.updateOrderScrapeTask)(orderId, {
                                scrapeStatus: (scrapeResult && scrapeResult.ok) ? "done" : "unknown",
                                scrapeResult: scrapeResult ?? null
                            });
                        }
                    }
                    catch (uErr) {
                        logger_1.logger.warn("Failed to persist scrape result", { orderId, error: uErr?.message ?? uErr });
                    }
                }
                const cautionNote = cautious && language === "de"
                    ? " (bitte kurz prüfen)"
                    : cautious && language === "en"
                        ? " (please double-check)"
                        : "";
                const reply = language === "en"
                    ? `I found a suitable product and am checking offers now.${cautionNote}`
                    : `Ich habe ein passendes Produkt gefunden und prüfe Angebote.${cautionNote}`;
                return {
                    replyText: reply,
                    nextStatus: "show_offers"
                };
            }
            catch (err) {
                logger_1.logger.error("Scrape after OEM failed", { error: err?.message, orderId });
                return {
                    replyText: language === "en"
                        ? "I found a product match but fetching offers failed. I’ll ask a colleague."
                        : "Ich habe ein passendes Produkt, aber die Angebotssuche ist fehlgeschlagen. Ich gebe das an einen Kollegen weiter.",
                    nextStatus: "collect_part"
                };
            }
        }
        return {
            replyText: language === "en"
                ? "I’m not fully confident about the product yet. I’ll hand this to a colleague."
                : "Ich bin mir beim Produkt nicht sicher. Ich gebe das an einen Kollegen weiter.",
            nextStatus: "collect_part"
        };
    }
    catch (err) {
        logger_1.logger.error("resolveOEM failed", { error: err?.message, orderId });
        return {
            replyText: language === "en"
                ? "A technical error occurred while finding the right part. Please send more vehicle info."
                : "Beim Finden des passenden Teils ist ein technischer Fehler aufgetreten. Bitte geben Sie mir noch ein paar Fahrzeugdaten.",
            nextStatus: "collect_vehicle"
        };
    }
}
async function downloadImageBuffer(url) {
    const resp = await (0, node_fetch_1.default)(url);
    if (!resp.ok) {
        throw new Error(`Failed to download image: ${resp.status} ${resp.statusText}`);
    }
    const arrayBuffer = await resp.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
async function downloadFromTwilio(mediaUrl) {
    // Allow local dev/test without Twilio by accepting data: and file: URLs
    if (mediaUrl.startsWith("data:")) {
        const base64 = mediaUrl.substring(mediaUrl.indexOf(",") + 1);
        return Buffer.from(base64, "base64");
    }
    if (mediaUrl.startsWith("file:")) {
        const filePath = mediaUrl.replace("file://", "");
        return fs.readFile(filePath);
    }
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
        throw new Error("Missing Twilio credentials (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)");
    }
    const authHeader = "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
    const res = await (0, httpClient_1.fetchWithTimeoutAndRetry)(mediaUrl, {
        headers: {
            Authorization: authHeader
        },
        timeoutMs: Number(process.env.MEDIA_DOWNLOAD_TIMEOUT_MS || 10000),
        retry: Number(process.env.MEDIA_DOWNLOAD_RETRY_COUNT || 2)
    });
    if (!res.ok) {
        throw new Error(`Failed to download image: ${res.status} ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}
async function extractVehicleDataFromImage(imageBuffer) {
    const base64 = imageBuffer.toString("base64");
    const imageUrl = `data:image/jpeg;base64,${base64}`;
    const systemPrompt = "You are an expert OCR and data extractor for German vehicle registration documents (Zulassungsbescheinigung Teil I, old Fahrzeugschein). " +
        "Be robust to rotated, blurred, dark, skewed, partially occluded images. Always return strict JSON for the requested fields.";
    const userPrompt = `
Lies dieses Bild (deutscher Fahrzeugschein, Zulassungsbescheinigung Teil I oder altes Fahrzeugschein-Formular).
Berücksichtige:
- Bild kann gedreht (90/180°), perspektivisch verzerrt, unscharf, dunkel oder teilweise verdeckt sein.
- Erkenne Ausrichtung selbst, lies so viel Text wie möglich.
Felder, die du extrahieren sollst (wenn unsicher → null):
- make (Hersteller, Feld D.1 oder Klartext, z.B. "BMW" / "BAYER. MOT. WERKE")
- model (Typ/Handelsbezeichnung, Feld D.2/D.3, z.B. "316ti")
- vin (Fahrgestellnummer, Feld E)
- hsn (Herstellerschlüsselnummer, Feld "zu 2.1")
- tsn (Typschlüsselnummer, Feld "zu 2.2")
- year (Erstzulassung/Herstellungsjahr, Feld B, als Zahl, z.B. 2002)
- engineKw (Leistung in kW, Feld P.2)
- fuelType (Kraftstoff, Feld P.3, z.B. "Benzin", "Diesel")
- emissionClass (z.B. "EURO 4")
Gib als Ergebnis NUR folgendes JSON (ohne zusätzlichen Text) zurück:
{
  "make": "...",
  "model": "...",
  "vin": "...",
  "hsn": "...",
  "tsn": "...",
  "year": 2002,
  "engineKw": 85,
  "fuelType": "...",
  "emissionClass": "...",
  "rawText": "Vollständiger erkannter Text"
}
Fülle unbekannte Felder mit null. rawText soll den gesamten erkannten Text enthalten (oder "" falls nichts erkannt).
`;
    try {
        const fullPrompt = systemPrompt + "\n\n" + userPrompt;
        const content = await (0, geminiService_1.generateVisionCompletion)({
            prompt: fullPrompt,
            imageBase64: base64,
            mimeType: "image/jpeg",
            temperature: 0
        });
        const parsed = safeParseVehicleJson(content);
        return parsed;
    }
    catch (err) {
        logger_1.logger.error("Gemini Vision OCR failed", { error: err?.message });
        return {
            make: null,
            model: null,
            vin: null,
            hsn: null,
            tsn: null,
            year: null,
            engineKw: null,
            fuelType: null,
            emissionClass: null,
            rawText: ""
        };
    }
}
function safeParseVehicleJson(text) {
    const empty = {
        make: null,
        model: null,
        vin: null,
        hsn: null,
        tsn: null,
        year: null,
        engineKw: null,
        fuelType: null,
        emissionClass: null,
        rawText: ""
    };
    if (!text)
        return empty;
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const jsonString = start !== -1 && end !== -1 && end > start ? text.slice(start, end + 1) : text;
    try {
        const obj = JSON.parse(jsonString);
        return {
            make: obj.make ?? null,
            model: obj.model ?? null,
            vin: obj.vin ?? null,
            hsn: obj.hsn ?? null,
            tsn: obj.tsn ?? null,
            year: obj.year ?? null,
            engineKw: obj.engineKw ?? null,
            fuelType: obj.fuelType ?? null,
            emissionClass: obj.emissionClass ?? null,
            rawText: obj.rawText ?? ""
        };
    }
    catch {
        return empty;
    }
}
async function understandUserText(text, currentVehicle, currentOrder) {
    const system = `
Du bist ein Assistent für einen Autoteile-WhatsApp-Bot.
Aufgaben:
- Intention erkennen: ASK_PART (Nutzer fragt nach Teil), GIVE_VEHICLE_DATA (Nutzer gibt Fahrzeugdaten), SMALLTALK, OTHER.
- Fahrzeugdaten aus dem Text extrahieren (make, model, year, vin, hsn, tsn, engineKw, fuelType). Nur setzen, wenn sicher erkennbar oder explizit korrigiert.
- requestedPart füllen, falls ein Teil erwähnt wird (inkl. Positionshinweisen wie vorne/hinten/links/rechts).
- Falls unklar, clarificationQuestion setzen, sonst null.
Gib NUR eine JSON-Antwort im Format:
{
  "intent": "ASK_PART" | "GIVE_VEHICLE_DATA" | "SMALLTALK" | "OTHER",
  "requestedPart": string | null,
  "vehiclePatch": { "make": string, "model": string, "year": number, "vin": string, "hsn": string, "tsn": string, "engineKw": number, "fuelType": string },
  "clarificationQuestion": string | null
}
Fehlende/unsichere Felder: weglassen oder null. Keine freien Texte außerhalb des JSON.`;
    const user = `
Aktuelle Nachricht: """${text}"""
Bereits bekanntes Fahrzeug: ${JSON.stringify(currentVehicle)}
Bereits angefragtes Teil: ${currentOrder?.requestedPart ?? null}
Extrahiere neue Infos aus der Nachricht. Überschreibe bekannte Felder nur, wenn der Nutzer sie explizit korrigiert.`;
    try {
        const content = await (0, geminiService_1.generateChatCompletion)({
            messages: [
                { role: "system", content: system },
                { role: "user", content: user }
            ],
            responseFormat: "json_object",
            temperature: 0
        });
        return safeParseNlpJson(content);
    }
    catch (err) {
        logger_1.logger.error("Gemini text understanding failed", { error: err?.message });
        return {
            intent: "OTHER",
            requestedPart: null,
            vehiclePatch: {},
            clarificationQuestion: null
        };
    }
}
function safeParseNlpJson(text) {
    const empty = {
        intent: "OTHER",
        requestedPart: null,
        vehiclePatch: {},
        clarificationQuestion: null
    };
    if (!text)
        return empty;
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const jsonString = start !== -1 && end !== -1 && end > start ? text.slice(start, end + 1) : text;
    try {
        const obj = JSON.parse(jsonString);
        return {
            intent: obj.intent ?? "OTHER",
            requestedPart: obj.requestedPart ?? null,
            vehiclePatch: obj.vehiclePatch ?? {},
            clarificationQuestion: obj.clarificationQuestion ?? null
        };
    }
    catch {
        return empty;
    }
}
function determineMissingVehicleFields(vehicle) {
    const missing = [];
    if (!vehicle?.make)
        missing.push("make");
    if (!vehicle?.model)
        missing.push("model");
    if (!vehicle?.year)
        missing.push("year");
    const hasVin = !!vehicle?.vin;
    const hasHsnTsn = !!vehicle?.hsn && !!vehicle?.tsn;
    const hasPower = !!vehicle?.engine || !!vehicle?.engineKw;
    if (!hasVin && !hasHsnTsn && !hasPower) {
        missing.push("vin_or_hsn_tsn_or_engine");
    }
    return missing;
}
function isVehicleSufficientForOem(vehicle) {
    if (!vehicle)
        return false;
    const hasBasics = !!vehicle.make && !!vehicle.model && !!vehicle.year;
    const hasId = !!vehicle.vin || (!!vehicle.hsn && !!vehicle.tsn);
    const hasPower = vehicle.engine || vehicle.engineKw;
    return hasBasics && (hasId || hasPower);
}
// ------------------------------
// Schritt 1: Nutzertext analysieren (NLU via OpenAI)
// ------------------------------
async function parseUserMessage(text) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not set");
        }
        const sanitized = sanitizeText(text);
        const rawText = await (0, geminiService_1.generateChatCompletion)({
            messages: [
                { role: "system", content: textNluPrompt_1.TEXT_NLU_PROMPT },
                { role: "user", content: sanitized }
            ],
            responseFormat: "json_object",
            temperature: 0
        });
        const start = rawText.indexOf("{");
        const end = rawText.lastIndexOf("}");
        const jsonString = start !== -1 && end !== -1 && end > start ? rawText.slice(start, end + 1) : rawText;
        const raw = JSON.parse(jsonString);
        // Merge regex-preparsed VIN/HSN/TSN if NLU missed them
        const regexVehicle = extractVinHsnTsn(sanitized);
        if (regexVehicle.vin && !raw.vin)
            raw.vin = regexVehicle.vin;
        if (regexVehicle.hsn && !raw.hsn)
            raw.hsn = regexVehicle.hsn;
        if (regexVehicle.tsn && !raw.tsn)
            raw.tsn = regexVehicle.tsn;
        const intent = raw.intent === "greeting" ||
            raw.intent === "send_vehicle_doc" ||
            raw.intent === "request_part" ||
            raw.intent === "describe_symptoms" ||
            raw.intent === "other"
            ? raw.intent
            : "unknown";
        const result = {
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
            smalltalkReply: raw.smalltalkReply ?? null
        };
        return result;
    }
    catch (error) {
        logger_1.logger.error("parseUserMessage failed", { error: error?.message, text });
        // Fallback: Intent unknown
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
            smalltalkReply: null
        };
    }
}
// Distributed locking: use lockService instead of in-memory Map
// Supports Redis in production, in-memory for development
const lockService_1 = require("./lockService");
// Helper: detect explicit language choice in the language selection step
function pickLanguageFromChoice(text) {
    const t = text.toLowerCase();
    if (t.includes("1") || t.includes("deutsch"))
        return "de";
    if (t.includes("2") || t.includes("english"))
        return "en";
    if (t.includes("3") || t.includes("türk"))
        return "tr";
    if (t.includes("4") || t.includes("kurdi"))
        return "ku";
    if (t.includes("5") || t.includes("polsk"))
        return "pl";
    return null;
}
function extractVinHsnTsn(text) {
    const vinRegex = /\b([A-HJ-NPR-Z0-9]{17})\b/i; // VIN excludes I,O,Q
    const hsnRegex = /\b([0-9]{4})\b/;
    const tsnRegex = /\b([A-Z0-9]{3,4})\b/i;
    const vinMatch = text.match(vinRegex);
    const hsnMatch = text.match(hsnRegex);
    const tsnMatch = text.match(tsnRegex);
    const vin = vinMatch ? vinMatch[1].toUpperCase() : undefined;
    const hsn = hsnMatch ? hsnMatch[1] : undefined;
    const tsn = tsnMatch ? tsnMatch[1].toUpperCase() : undefined;
    return { vin, hsn, tsn };
}
// Helper: detect if user text contains vehicle hints (brand/model/year)
function hasVehicleHints(text) {
    const t = text.toLowerCase();
    const brands = ["bmw", "audi", "vw", "volkswagen", "mercedes", "benz", "ford", "opel", "skoda", "seat", "toyota", "honda", "hyundai", "kia"];
    const yearPattern = /\b(19|20)\d{2}\b/;
    return brands.some((b) => t.includes(b)) || yearPattern.test(t);
}
// Sanitizes free text to avoid control chars and overly long inputs.
function sanitizeText(input, maxLen = 500) {
    if (!input)
        return "";
    const trimmed = input.trim().slice(0, maxLen);
    return trimmed.replace(/[\u0000-\u001F\u007F]/g, " ");
}
function detectIntent(text, hasVehicleImage) {
    if (hasVehicleImage)
        return "new_order";
    const t = text.toLowerCase();
    // Abort/cancel detection - user wants to stop current order
    const abortKeywords = [
        "abbrechen", "stornieren", "cancel", "nein doch nicht", "vergiss es",
        "stopp", "halt", "aufhören", "nicht mehr", "egal", "lassen wir"
    ];
    if (abortKeywords.some((k) => t.includes(k)))
        return "abort_order";
    // Continue with same vehicle for different part
    const continueKeywords = [
        "noch was", "auch noch", "außerdem", "zusätzlich", "dazu", "weiteres teil",
        "gleiches auto", "selbes fahrzeug", "same car", "another part"
    ];
    if (continueKeywords.some((k) => t.includes(k)))
        return "continue_order";
    // New order with different vehicle
    const newOrderKeywords = [
        "anderes auto", "anderen wagen", "neues fahrzeug", "zweites auto",
        "other car", "different vehicle", "mein anderes"
    ];
    if (newOrderKeywords.some((k) => t.includes(k)))
        return "new_order";
    const statusKeywords = [
        "liefer", "zustellung", "wann", "abholung", "abholen", "zahlen", "zahlung",
        "vorkasse", "status", "wo bleibt", "retoure", "liefertermin", "tracking", "order", "bestellung"
    ];
    if (statusKeywords.some((k) => t.includes(k)))
        return "status_question";
    // P1 #7: OEM Direct Input Detection — pro users send OEM numbers directly
    // VAG (1K0615301AC), BMW (34116792219), Mercedes (A0044206920), generic
    const oemPatterns = [
        /\b[0-9]{1,2}[A-Z][0-9]{3,6}[A-Z]{0,3}\b/i, // VAG: 1K0615301AC
        /\b[0-9]{11}\b/, // BMW: 34116792219
        /\bA[0-9]{10,12}\b/i, // Mercedes: A0044206920
        /\b[A-Z]{1,3}[-\s]?[0-9]{3,8}[-\s]?[A-Z0-9]{0,4}\b/i, // Generic: XX-12345-AB
    ];
    const stripped = text.replace(/\s+/g, '');
    if (stripped.length >= 7 && stripped.length <= 15 && oemPatterns.some(p => p.test(text))) {
        return "new_order"; // Treat as part request with known OEM
    }
    return "unknown";
}
function shortOrderLabel(o) {
    const idShort = o.id.slice(0, 8);
    const vehicle = o.vehicle_description || o.part_description || "Anfrage";
    return `${idShort} (${vehicle.slice(0, 40)})`;
}
// ------------------------------
// Hauptlogik – zustandsbasierter Flow
// ------------------------------
async function handleIncomingBotMessage(payload) {
    return (0, lockService_1.withConversationLock)(payload.from, async () => {
        const userText = sanitizeText(payload.text || "", 1000);
        const hasVehicleImage = Array.isArray(payload.mediaUrls) && payload.mediaUrls.length > 0;
        const vehicleImageNote = hasVehicleImage && payload.mediaUrls
            ? payload.mediaUrls.map((url, idx) => `[REGISTRATION_IMAGE_${idx + 1}]: ${url}`).join("\n")
            : null;
        // Intent + mögliche offene Orders vor dem Erstellen ermitteln
        const intent = detectIntent(userText, hasVehicleImage);
        let activeOrders = [];
        if (typeof supabaseService_1.listActiveOrdersByContact === "function") {
            try {
                activeOrders = await (0, supabaseService_1.listActiveOrdersByContact)(payload.from);
            }
            catch (err) {
                activeOrders = [];
            }
        }
        else {
            activeOrders = [];
        }
        // Falls Frage und mehrere offene Tickets → Auswahl erfragen
        if (intent === "status_question" && activeOrders.length > 1 && !payload.orderId) {
            const options = activeOrders.slice(0, 3).map(shortOrderLabel).join(" | ");
            return {
                reply: "Zu welcher Anfrage hast du die Frage? Bitte nenn die Ticket-ID.\nOptionen: " +
                    options,
                orderId: activeOrders[0].id
            };
        }
        // NEW: Handle abort_order intent - user wants to cancel current order
        if (intent === "abort_order" && activeOrders.length > 0) {
            const orderToCancel = activeOrders[0];
            try {
                await (0, supabaseService_1.updateOrder)(orderToCancel.id, { status: "cancelled" });
                logger_1.logger.info("Order cancelled by user request", { orderId: orderToCancel.id });
            }
            catch (err) {
                logger_1.logger.error("Failed to cancel order", { orderId: orderToCancel.id, error: err?.message });
            }
            const lang = orderToCancel.language || "de";
            return {
                reply: lang === "en"
                    ? "No problem! I've cancelled your request. If you need anything else, just write me."
                    : "Kein Problem! Deine Anfrage wurde abgebrochen. Wenn du etwas anderes brauchst, schreib mir einfach.",
                orderId: orderToCancel.id
            };
        }
        // NEW: Handle continue_order intent - user wants another part for same vehicle
        if (intent === "continue_order" && activeOrders.length > 0) {
            const lastOrder = activeOrders[0];
            if (lastOrder.vehicle_description || lastOrder.order_data?.vehicle) {
                // Create new order but copy vehicle data
                const newOrder = await getSupa().findOrCreateOrder(payload.from, null, { forceNew: true });
                try {
                    await (0, supabaseService_1.updateOrder)(newOrder.id, {
                        vehicle_description: lastOrder.vehicle_description,
                        status: "collect_part",
                        language: lastOrder.language
                    });
                    // Copy vehicle data if exists
                    if (lastOrder.order_data?.vehicle) {
                        await getSupa().updateOrderData(newOrder.id, { vehicle: lastOrder.order_data.vehicle });
                    }
                }
                catch (err) {
                    logger_1.logger.error("Failed to copy vehicle for continue_order", { error: err?.message });
                }
                const lang = lastOrder.language || "de";
                return {
                    reply: lang === "en"
                        ? "Great! I'm using the same vehicle. What other part do you need?"
                        : "Super! Ich nutze das gleiche Fahrzeug. Welches andere Teil benötigen Sie?",
                    orderId: newOrder.id
                };
            }
        }
        // Ziel-Order bestimmen
        let forceNewOrder = false;
        if (intent === "new_order") {
            // neue Bestellung erzwingen, wenn Bild oder klar neuer Kontext
            forceNewOrder = hasVehicleImage || !activeOrders.length;
        }
        // Wenn wir bewusst neu anlegen wollen, nicht automatisch die letzte offene Order wählen
        let orderForFlowId = payload.orderId ?? (forceNewOrder ? undefined : activeOrders[0]?.id);
        // Order laden oder erstellen
        const order = await getSupa().findOrCreateOrder(payload.from, orderForFlowId ?? null, { forceNew: forceNewOrder });
        // Multi-tenant: Get merchant for this phone number
        const merchantMapping = await (0, phoneMerchantMapper_1.getMerchantByPhone)(payload.from);
        const merchantId = merchantMapping?.merchantId || process.env.DEFAULT_MERCHANT_ID || 'admin';
        const merchantSettings = await getSupa().getMerchantSettings(merchantId);
        const supportedLangs = merchantSettings?.supportedLanguages || ["de", "en"];
        let language = order.language ?? null;
        let languageChanged = false;
        // Only accept explicit language choice (1 / 2 / de / en). Do NOT auto-persist language based on free text
        // to avoid incorrect auto-detections that break the flow.
        if (!language) {
            const detectedLang = detectLanguageSelection(userText); // explicit choices only
            if (detectedLang) {
                language = detectedLang;
                languageChanged = true;
                try {
                    await (0, supabaseService_1.updateOrder)(order.id, { language });
                    logger_1.logger.info("Language detected and stored", { orderId: order.id, language });
                }
                catch (err) {
                    logger_1.logger.error("Failed to persist detected language", { error: err?.message, orderId: order.id });
                }
            }
        }
        let nextStatus = order.status || "choose_language";
        let vehicleDescription = order.vehicle_description;
        let partDescription = order.part_description;
        // Lade vorhandenes order_data, um kumulativ zu arbeiten
        let orderData = {};
        try {
            const fullOrder = await (0, supabaseService_1.getOrderById)(order.id);
            orderData = fullOrder?.orderData || {};
        }
        catch (err) {
            logger_1.logger.error("Failed to fetch order_data", { error: err?.message, orderId: order.id });
        }
        // Nachricht loggen (best effort)
        try {
            // Compatibility adjustment for InvenTreeAdapter which expects (waId, content, direction)
            const msgDir = "IN";
            await supabaseService_1.insertMessage(payload.from, userText, msgDir);
        }
        catch (err) {
            logger_1.logger.error("Failed to log incoming message", { error: err?.message, orderId: order.id });
        }
        // Early abuse detection: if the message is insulting, short-circuit and don't advance the flow.
        try {
            if (detectAbusive(userText)) {
                const reply = language
                    ? language === "de"
                        ? "Bitte benutze keine Beleidigungen. Ich helfe dir gern weiter, wenn du sachlich bleibst."
                        : "Please refrain from insults. I can help if you ask politely."
                    : "Bitte benutze keine Beleidigungen. / Please refrain from insults.";
                // Do not change order state. Just respond.
                return { reply, orderId: order.id };
            }
        }
        catch (e) {
            // If abuse check fails for any reason, continue normally.
            logger_1.logger.warn("Abuse detection failed", { error: e?.message });
        }
        // If user sent an image, try OCR first so orchestrator can use it
        let ocrResult = null;
        let ocrFailed = false;
        if (hasVehicleImage && Array.isArray(payload.mediaUrls) && payload.mediaUrls.length > 0) {
            try {
                const buf = await downloadFromTwilio(payload.mediaUrls[0]);
                ocrResult = await extractVehicleDataFromImage(buf);
                logger_1.logger.info("Pre-OCR result for orchestrator", { orderId: order.id, ocr: ocrResult });
                // M1 FIX: Check if OCR actually extracted anything useful
                const hasData = ocrResult && (ocrResult.make || ocrResult.model || ocrResult.vin || ocrResult.hsn);
                if (!hasData) {
                    ocrFailed = true;
                    logger_1.logger.warn("OCR returned empty result", { orderId: order.id });
                }
            }
            catch (err) {
                logger_1.logger.warn("Pre-OCR failed", { error: err?.message, orderId: order.id });
                ocrResult = null;
                ocrFailed = true;
            }
            // M1 FIX: Tell the user when OCR can't read their photo
            if (ocrFailed) {
                const ocrErrorMsg = (0, botResponses_1.t)('ocr_failed', language);
                // Don't return yet — let orchestrator continue, but prepend the message
                // so user knows why we're asking for manual input
                if (!ocrResult?.make && !ocrResult?.vin) {
                    return { reply: ocrErrorMsg, orderId: order.id };
                }
            }
        }
        // Call AI orchestrator as primary decision maker. If it fails, fallback to legacy NLU.
        let parsed = { intent: "unknown" };
        const statesForOrchestrator = ["choose_language", "collect_vehicle", "collect_part"];
        if (statesForOrchestrator.includes(order.status)) {
            try {
                // Fix: Load lastBotMessage from orderData instead of null
                const lastBotMsg = orderData?.lastBotMessage || orderData?.last_bot_reply || null;
                // P1 #11: Load chat history for orchestrator context
                let chatHistory = [];
                try {
                    chatHistory = await (0, supabaseService_1.getRecentMessages)(order.id, 5);
                }
                catch (histErr) {
                    logger_1.logger.warn('[BotLogic] Failed to load chat history', { error: histErr?.message });
                }
                const orchestratorPayload = {
                    sender: payload.from,
                    orderId: order.id,
                    conversation: {
                        status: order.status,
                        language: order.language,
                        orderData: orderData,
                        lastBotMessage: lastBotMsg,
                        recentMessages: chatHistory,
                    },
                    latestMessage: userText,
                    ocr: ocrResult
                };
                const orch = await callOrchestrator(orchestratorPayload);
                if (orch) {
                    // Handle simple orchestrator actions directly
                    if (orch.action === "abusive") {
                        const reply = orch.reply || (order.language === "de" ? "Bitte benutze keine Beleidigungen." : "Please refrain from insults.");
                        return { reply, orderId: order.id };
                    }
                    if (orch.action === "smalltalk") {
                        // do not change state, just reply
                        let reply = orch.reply || "";
                        if (needsVehicleDocumentHint(order)) {
                            const docHint = order.language === "en"
                                ? "The best way is to send me a photo of your vehicle registration document. Alternatively: brand, model, year and VIN or HSN/TSN."
                                : "Schicken Sie mir am besten zuerst ein Foto Ihres Fahrzeugscheins. Falls nicht möglich: Marke, Modell, Baujahr und VIN oder HSN/TSN.";
                            reply = reply ? `${reply} ${docHint}` : docHint;
                        }
                        return { reply, orderId: order.id };
                    }
                    // Merge offered slots into order_data
                    const slotsToStore = {};
                    for (const [k, v] of Object.entries(orch.slots || {})) {
                        if (v !== undefined && v !== null && v !== "")
                            slotsToStore[k] = v;
                    }
                    if (Object.keys(slotsToStore).length > 0) {
                        try {
                            await (0, supabaseService_1.updateOrderData)(order.id, slotsToStore);
                            orderData = { ...orderData, ...slotsToStore };
                            // Also sync vehicle record if vehicle slots are present
                            if (slotsToStore.make || slotsToStore.model || slotsToStore.vin || slotsToStore.hsn) {
                                await getSupa().upsertVehicleForOrderFromPartial(order.id, {
                                    make: slotsToStore.make ?? null,
                                    model: slotsToStore.model ?? null,
                                    year: slotsToStore.year ? Number(slotsToStore.year) : null,
                                    vin: slotsToStore.vin ?? null,
                                    hsn: slotsToStore.hsn ?? null,
                                    tsn: slotsToStore.tsn ?? null,
                                    engine: slotsToStore.engine ?? slotsToStore.engineCode ?? null,
                                    engineKw: slotsToStore.engineKw ? Number(slotsToStore.engineKw) : null
                                });
                            }
                        }
                        catch (err) {
                            logger_1.logger.warn("Failed to persist orchestrator slots", { error: err?.message, orderId: order.id });
                        }
                    }
                    const vehicleCandidate = {
                        make: orch.slots.make ?? ocrResult?.make ?? orderData?.make ?? null,
                        model: orch.slots.model ?? ocrResult?.model ?? orderData?.model ?? null,
                        year: orch.slots.year ?? ocrResult?.year ?? orderData?.year ?? null,
                        engine: orch.slots.engine ?? orch.slots.engineCode ?? ocrResult?.engine ?? null,
                        engineKw: orch.slots.engineKw ?? ocrResult?.engineKw ?? null,
                        vin: orch.slots.vin ?? ocrResult?.vin ?? null,
                        hsn: orch.slots.hsn ?? ocrResult?.hsn ?? null,
                        tsn: orch.slots.tsn ?? ocrResult?.tsn ?? null
                    };
                    const partCandidate = orch.slots.requestedPart ??
                        orch.slots.part ??
                        orderData?.requestedPart ??
                        orderData?.partText ??
                        (userText && userText.length > 0 ? userText : null);
                    if (statesForOrchestrator.includes(order.status) && isVehicleSufficientForOem(vehicleCandidate) && partCandidate) {
                        if (!orderData?.vehicleConfirmed) {
                            const summary = `${vehicleCandidate.make} ${vehicleCandidate.model} (${vehicleCandidate.year})`;
                            const reply = language === "en"
                                ? `I've identified your vehicle as ${summary}. Is this correct?`
                                : `Ich habe Ihr Fahrzeug als ${summary} identifiziert. Ist das korrekt?`;
                            await (0, supabaseService_1.updateOrder)(order.id, { status: "confirm_vehicle" });
                            return { reply, orderId: order.id, nextStatus: "confirm_vehicle" };
                        }
                    }
                    if (orch.action === "ask_slot") {
                        if (isVehicleSufficientForOem(vehicleCandidate) && partCandidate) {
                            // 🧠 CONVERSATION INTELLIGENCE: Check if we should actually run scraping
                            const intelligenceContext = {
                                userMessage: userText,
                                lastBotMessage: orderData?.lastBotMessage || null,
                                orderData: {
                                    make: vehicleCandidate.make,
                                    model: vehicleCandidate.model,
                                    year: vehicleCandidate.year,
                                    requestedPart: partCandidate,
                                    oem: orderData?.oem || null,
                                    scrapeStatus: orderData?.scrapeStatus || 'idle',
                                    offersCount: orderData?.offersCount || 0
                                }
                            };
                            const decision = await (0, conversationIntelligence_1.getConversationDecision)(intelligenceContext);
                            logger_1.logger.info("[BotLogic] Conversation intelligence decision", {
                                decision: decision.decision,
                                reason: decision.reason,
                                confidence: decision.confidence,
                                orderId: order.id
                            });
                            // Handle different decisions
                            if (decision.decision === 'skip') {
                                // User confirmed, asked question, or waiting — no scraping
                                const reply = orch.reply || decision.suggestedReply ||
                                    (language === "de" ? "Alles klar! Wie kann ich weiterhelfen?" : "Got it! How can I help further?");
                                return { reply, orderId: order.id };
                            }
                            if (decision.decision === 'reset') {
                                // User wants different part or different vehicle
                                await (0, supabaseService_1.updateOrderData)(order.id, { requestedPart: null, oem: null, scrapeStatus: null });
                                const reply = decision.suggestedReply ||
                                    (language === "de" ? "Natürlich! Was suchst du als Nächstes?" : "Of course! What are you looking for next?");
                                return { reply, orderId: order.id };
                            }
                            if (decision.decision === 'escalate') {
                                await (0, supabaseService_1.updateOrder)(order.id, { status: "needs_human" });
                                const reply = language === "de"
                                    ? "Ich verbinde dich mit einem Mitarbeiter. Jemand meldet sich in Kürze bei dir!"
                                    : "I'm connecting you with a team member. Someone will reach out shortly!";
                                return { reply, orderId: order.id };
                            }
                            // decision === 'proceed' - actually run OEM lookup
                            const oemFlow = await runOemLookupAndScraping(order.id, language ?? "de", {
                                intent: "request_part",
                                normalizedPartName: partCandidate,
                                userPartText: partCandidate,
                                isAutoPart: true
                            }, orderData, partCandidate, vehicleCandidate);
                            return { reply: oemFlow.replyText, orderId: order.id };
                        }
                        return { reply: orch.reply || "", orderId: order.id };
                    }
                    if (orch.action === "oem_lookup") {
                        // S2 FIX: Removed duplicate getConversationDecision() call.
                        // The orchestrator already determined action=oem_lookup, so we proceed directly.
                        // This saves ~300ms latency and ~50% AI costs per message.
                        // Proceed with actual OEM lookup
                        const vehicleOverride = {
                            make: orch.slots.make ?? orch.slots.brand ?? undefined,
                            model: orch.slots.model ?? undefined,
                            year: orch.slots.year ?? undefined,
                            engine: orch.slots.engine ?? undefined,
                            vin: orch.slots.vin ?? undefined,
                            hsn: orch.slots.hsn ?? undefined,
                            tsn: orch.slots.tsn ?? undefined
                        };
                        // M3 FIX: Vehicle Guard — check completeness before blind scraping
                        const guardResult = (0, vehicleGuard_1.checkVehicleCompleteness)({
                            make: vehicleOverride.make,
                            model: vehicleOverride.model,
                            year: vehicleOverride.year,
                            engine: vehicleOverride.engine,
                            vin: vehicleOverride.vin,
                            hsn: vehicleOverride.hsn,
                            tsn: vehicleOverride.tsn,
                        });
                        if (!guardResult.isComplete && guardResult.followUpQuestion) {
                            logger_1.logger.info('[BotLogic] Vehicle guard: incomplete vehicle data', {
                                missingFields: guardResult.missingFields,
                                confidence: guardResult.confidence,
                                orderId: order.id
                            });
                            return { reply: guardResult.followUpQuestion, orderId: order.id };
                        }
                        const minimalParsed = {
                            intent: "request_part",
                            normalizedPartName: orch.slots.requestedPart ?? orch.slots.part ?? null,
                            userPartText: orch.slots.requestedPart ?? orch.slots.part ?? null,
                            isAutoPart: true,
                            partCategory: orch.slots.partCategory ?? null,
                            position: orch.slots.position ?? null,
                            positionNeeded: Boolean(orch.slots.position)
                        };
                        // P0 #1: Send Zwischennachricht BEFORE starting OEM resolution
                        // This eliminates the "dead silence" where users see nothing for 5-22s
                        const searchingMsg = (0, botResponses_1.t)('oem_searching', order.language);
                        // M2 FIX: 30s timeout for entire OEM resolution
                        const OEM_TIMEOUT_MS = 30000;
                        try {
                            const oemFlow = await Promise.race([
                                runOemLookupAndScraping(order.id, order.language ?? "de", minimalParsed, orderData, orch.slots.requestedPart ?? null, vehicleOverride),
                                new Promise((_, reject) => setTimeout(() => reject(new Error('OEM_TIMEOUT')), OEM_TIMEOUT_MS))
                            ]);
                            return { reply: oemFlow.replyText, orderId: order.id, preReply: searchingMsg };
                        }
                        catch (err) {
                            if (err.message === 'OEM_TIMEOUT') {
                                logger_1.logger.warn('[BotLogic] OEM resolution timed out after 30s', { orderId: order.id });
                                return { reply: (0, botResponses_1.t)('oem_timeout', order.language), orderId: order.id, preReply: searchingMsg };
                            }
                            throw err;
                        }
                    }
                    // orch.action === confirm / noop => set parsed from slots and continue legacy flow
                    if (orch.slots && Object.keys(orch.slots).length > 0) {
                        parsed = {
                            intent: "request_part",
                            normalizedPartName: orch.slots.requestedPart ?? orch.slots.part ?? null,
                            userPartText: orch.slots.requestedPart ?? orch.slots.part ?? null,
                            isAutoPart: true,
                            partCategory: orch.slots.partCategory ?? null,
                            position: orch.slots.position ?? null,
                            positionNeeded: Boolean(orch.slots.position)
                        };
                    }
                }
            }
            catch (err) {
                logger_1.logger.error("Orchestrator flow failed, falling back to legacy NLU", { error: err?.message });
                try {
                    parsed = await parseUserMessage(userText);
                }
                catch (err2) {
                    logger_1.logger.error("parseUserMessage failed in fallback", { error: err2?.message });
                }
            }
        }
        else {
            // For confirm_vehicle and other non-orchestrated states, use simple legacy parsing
            try {
                parsed = await parseUserMessage(userText);
            }
            catch (e) { }
        }
        // requestedPart aus Usertext merken und persistieren
        const requestedPart = parsed.part?.trim();
        if (requestedPart) {
            try {
                await (0, supabaseService_1.updateOrderData)(order.id, { requestedPart });
                orderData = { ...orderData, requestedPart };
            }
            catch (err) {
                logger_1.logger.error("Failed to persist requestedPart", { error: err?.message, orderId: order.id });
            }
            partDescription = partDescription ? `${partDescription}\n${requestedPart}` : requestedPart;
        }
        // Status-Fragen (Lieferung, Wo bleibt mein Paket?)
        if (intent === "status_question") {
            const status = order.status;
            const odata = order.order_data || {};
            const delivery = odata.selectedOfferSummary?.deliveryTimeDays ?? "n/a";
            let statusReply = "";
            if (language === "en") {
                statusReply = `I've checked your order ${order.id}. Current status: ${status}. `;
                if (status === "done")
                    statusReply += "It should be on its way or ready for pickup!";
                else if (status === "ready")
                    statusReply += `It is currently being processed. Estimated delivery: ${delivery} days.`;
                else
                    statusReply += "We are currently looking for the best price for you.";
            }
            else {
                statusReply = `Ich habe nachgesehen (Ticket ${order.id}). Status: ${status}. `;
                if (status === "done")
                    statusReply += "Ihre Bestellung ist abgeschlossen und sollte bald bei Ihnen sein!";
                else if (status === "ready")
                    statusReply += `Wir bearbeiten Ihre Bestellung. Geschätzte Lieferzeit: ${delivery} Tage.`;
                else
                    statusReply += "Wir suchen gerade noch nach dem besten Angebot für dich.";
            }
            return { reply: statusReply, orderId: order.id };
        }
        // Allgemeine Fragen (General QA)
        if (parsed.intent === "general_question") {
            const currentVehicle = await (0, supabaseService_1.getVehicleForOrder)(order.id);
            const knownVehicleSummary = JSON.stringify(currentVehicle ?? {});
            const lang = language ?? "de";
            const reply = await answerGeneralQuestion({
                userText,
                language: lang,
                missingVehicleInfo: parsed.missingVehicleInfo ?? [],
                knownVehicleSummary
            });
            return { reply, orderId: order.id };
        }
        // Note: smalltalk is handled by the AI orchestrator. We no longer use the legacy smalltalk
        // branch here to avoid duplicate/conflicting replies. If the orchestrator is unavailable,
        // the legacy NLU may still produce a smalltalk intent as a fallback, but we choose to
        // respond with the generic fallback below instead of special-casing smalltalk here.
        let replyText = "";
        // 🚀 STATE MACHINE INTEGRATION (Feature Flag controlled)
        // When enabled, use new state machine handlers instead of legacy switch
        const stateMachineStates = ['choose_language', 'collect_vehicle', 'collect_part'];
        if ((0, featureFlags_1.isEnabled)(featureFlags_1.FF.USE_STATE_MACHINE, { userId: payload.from }) && stateMachineStates.includes(nextStatus)) {
            try {
                // Dynamic import to avoid circular dependencies
                const { executeState, getHandler } = await Promise.resolve().then(() => __importStar(require('./stateMachine')));
                await Promise.resolve().then(() => __importStar(require('./stateMachine/index'))); // Ensure handlers are registered
                const handler = getHandler(nextStatus);
                if (handler) {
                    const stateCtx = {
                        orderId: order.id,
                        order,
                        orderData,
                        language: (language || 'de'),
                        userText,
                        parsed,
                        mediaUrls: payload.mediaUrls,
                        currentStatus: nextStatus
                    };
                    const stateResult = await executeState(nextStatus, stateCtx);
                    if (stateResult.updatedOrderData) {
                        await (0, supabaseService_1.updateOrderData)(order.id, stateResult.updatedOrderData);
                        orderData = { ...orderData, ...stateResult.updatedOrderData };
                    }
                    replyText = stateResult.reply;
                    nextStatus = stateResult.nextStatus;
                    logger_1.logger.info("State machine handled request", {
                        orderId: order.id,
                        handler: handler.name,
                        nextStatus,
                        replyLength: replyText.length
                    });
                    // Skip legacy switch if state machine handled it
                    // We'll jump to the persist section
                }
                else {
                    logger_1.logger.debug("No state machine handler for status, falling back to legacy", { status: nextStatus });
                }
            }
            catch (smError) {
                logger_1.logger.warn("State machine failed, falling back to legacy switch", {
                    error: smError?.message,
                    status: nextStatus,
                    orderId: order.id
                });
                // Fall through to legacy switch
            }
        }
        // Legacy switch (will be removed after 100% rollout)
        if (!replyText) {
            switch (nextStatus) {
                case "choose_language": {
                    // Wenn bereits Sprache gesetzt ist, nicht erneut fragen
                    if (language && supportedLangs.includes(language)) {
                        nextStatus = "collect_vehicle";
                        // We will generate the greeting below
                        break;
                    }
                    const chosen = pickLanguageFromChoice(userText); // require explicit choice
                    if (chosen) {
                        language = chosen;
                        languageChanged = true;
                        try {
                            await (0, supabaseService_1.updateOrder)(order.id, { language });
                        }
                        catch (err) {
                            logger_1.logger.error("Failed to persist chosen language", { error: err?.message, orderId: order.id });
                        }
                        nextStatus = "collect_vehicle";
                        // Generate greeting after language selection
                        replyText = (0, botResponses_1.t)('greeting_after_language', language);
                    }
                    else {
                        replyText =
                            "Hallo! Bitte wähle deine Sprache:\n" +
                                "1. Deutsch 🇩🇪\n" +
                                "2. English 🇬🇧\n" +
                                "3. Türkçe 🇹🇷\n" +
                                "4. Kurdî ☀️\n" +
                                "5. Polski 🇵🇱\n\n" +
                                "Antworte einfach mit der Nummer (1, 2, 3, 4 oder 5).";
                    }
                    break;
                }
                case "collect_vehicle": {
                    // Bild zählt als Fahrzeugschein
                    if (hasVehicleImage) {
                        const note = vehicleImageNote || "";
                        vehicleDescription = vehicleDescription ? `${vehicleDescription}\n${note}` : note;
                        let anyBufferDownloaded = false;
                        let ocrSucceeded = false;
                        try {
                            const buffers = [];
                            for (const url of payload.mediaUrls ?? []) {
                                try {
                                    const buf = await downloadFromTwilio(url);
                                    buffers.push(buf);
                                    anyBufferDownloaded = true;
                                }
                                catch (err) {
                                    logger_1.logger.error("Failed to download vehicle image", { error: err?.message, orderId: order.id });
                                }
                            }
                            if (buffers.length > 0) {
                                const ocr = await extractVehicleDataFromImage(buffers[0]);
                                logger_1.logger.info("Vehicle OCR result", { orderId: order.id, ocr });
                                ocrSucceeded = true;
                                // Read current DB vehicle so we can continue even if upsert fails
                                let dbVehicle = null;
                                try {
                                    dbVehicle = await getSupa().getVehicleForOrder(order.id);
                                }
                                catch (err) {
                                    logger_1.logger.warn("Failed to read existing vehicle before upsert", { error: err?.message, orderId: order.id });
                                }
                                try {
                                    await getSupa().upsertVehicleForOrderFromPartial(order.id, {
                                        make: ocr.make ?? null,
                                        model: ocr.model ?? null,
                                        year: ocr.year ?? null,
                                        engineCode: null,
                                        engineKw: ocr.engineKw ?? null,
                                        fuelType: ocr.fuelType ?? null,
                                        emissionClass: ocr.emissionClass ?? null,
                                        vin: ocr.vin ?? null,
                                        hsn: ocr.hsn ?? null,
                                        tsn: ocr.tsn ?? null
                                    });
                                }
                                catch (upsertErr) {
                                    // If DB schema doesn't contain some columns, don't fail the whole flow — we'll continue using OCR result
                                    logger_1.logger.error("Vehicle OCR failed to persist (but will continue using OCR data)", {
                                        error: upsertErr?.message,
                                        orderId: order.id
                                    });
                                }
                                try {
                                    await (0, supabaseService_1.updateOrderData)(order.id, {
                                        vehicleOcrRawText: ocr.rawText ?? "",
                                        vehicleEngineKw: ocr.engineKw ?? null,
                                        vehicleFuelType: ocr.fuelType ?? null,
                                        vehicleEmissionClass: ocr.emissionClass ?? null
                                    });
                                }
                                catch (err) {
                                    logger_1.logger.error("Failed to store vehicle OCR raw text", { error: err?.message, orderId: order.id });
                                }
                                // Build a combined vehicle from DB + OCR so we can proceed even if DB upsert failed
                                const combinedVehicle = {
                                    make: ocr.make ?? dbVehicle?.make ?? null,
                                    model: ocr.model ?? dbVehicle?.model ?? null,
                                    year: ocr.year ?? dbVehicle?.year ?? null,
                                    engineCode: null,
                                    vin: ocr.vin ?? dbVehicle?.vin ?? null,
                                    hsn: ocr.hsn ?? dbVehicle?.hsn ?? null,
                                    tsn: ocr.tsn ?? dbVehicle?.tsn ?? null
                                };
                                // After OCR prüfen, ob genug Daten für OEM vorhanden sind
                                const missingFieldsAfterOcr = determineMissingVehicleFields(combinedVehicle);
                                const partTextFromOrderAfterOcr = orderData?.partText || orderData?.requestedPart || partDescription || parsed.part || null;
                                if (missingFieldsAfterOcr.length === 0 && partTextFromOrderAfterOcr) {
                                    const oemFlow = await runOemLookupAndScraping(order.id, language ?? "de", { ...parsed, part: partTextFromOrderAfterOcr }, orderData, partDescription ?? null, 
                                    // pass combined vehicle so resolveOEM can continue even if DB was not updated
                                    combinedVehicle);
                                    replyText = oemFlow.replyText;
                                    nextStatus = oemFlow.nextStatus;
                                    // Persist immediate state change and return early so the response uses OCR-driven decision
                                    try {
                                        await (0, supabaseService_1.updateOrder)(order.id, {
                                            status: nextStatus,
                                            language,
                                            vehicle_description: vehicleDescription || null,
                                            part_description: partDescription ?? null
                                        });
                                    }
                                    catch (uErr) {
                                        logger_1.logger.warn("Failed to persist order state after OCR-driven OEM flow", {
                                            orderId: order.id,
                                            error: uErr?.message ?? uErr
                                        });
                                    }
                                    return { reply: replyText, orderId: order.id };
                                }
                                else if (missingFieldsAfterOcr.length === 0) {
                                    nextStatus = "collect_part";
                                    replyText =
                                        language === "en"
                                            ? "Got the vehicle document. Which part do you need? Please include position (front/rear, left/right) and any symptoms."
                                            : (0, botResponses_1.t)('ocr_success', language);
                                }
                                else {
                                    // gezielte Rückfrage
                                    const field = missingFieldsAfterOcr[0];
                                    if (field === "vin_or_hsn_tsn") {
                                        replyText =
                                            language === "en"
                                                ? "I couldn’t read VIN or HSN/TSN. Please send those numbers or a clearer photo."
                                                : "Ich konnte VIN oder HSN/TSN nicht sicher erkennen. Bitte schicken Sie mir die Nummern oder ein schärferes Foto.";
                                    }
                                    else if (field === "make") {
                                        replyText = language === "en" ? "Which car brand is it?" : "Welche Automarke ist es?";
                                    }
                                    else if (field === "model") {
                                        replyText = language === "en" ? "Which exact model is it?" : "Welches Modell genau?";
                                    }
                                    else {
                                        replyText =
                                            language === "en"
                                                ? "Please share VIN or HSN/TSN, or at least make/model/year, so I can identify your car."
                                                : (0, botResponses_1.t)('collect_vehicle_manual', language);
                                    }
                                    nextStatus = "collect_vehicle";
                                }
                            }
                        }
                        catch (err) {
                            logger_1.logger.error("Vehicle OCR failed", { error: err?.message, orderId: order.id });
                        }
                        if (!anyBufferDownloaded) {
                            replyText =
                                language === "en"
                                    ? "I couldn’t load your registration photo. Please type your make, model, year, and VIN/HSN/TSN."
                                    : "Ich konnte Ihr Fahrzeugschein-Foto nicht laden. Bitte schreiben Sie mir Marke, Modell, Baujahr und VIN/HSN/TSN.";
                            nextStatus = "collect_vehicle";
                            break;
                        }
                        // Nach OCR prüfen, ob genug Daten für OEM vorhanden sind
                        const vehicle = await (0, supabaseService_1.getVehicleForOrder)(order.id);
                        const missingFields = determineMissingVehicleFields(vehicle);
                        const partTextFromOrder = orderData?.partText ||
                            orderData?.requestedPart ||
                            partDescription ||
                            parsed.part ||
                            null;
                        if (missingFields.length === 0 && partTextFromOrder) {
                            const oemFlow = await runOemLookupAndScraping(order.id, language ?? "de", { ...parsed, part: partTextFromOrder }, orderData, partDescription ?? null);
                            replyText = oemFlow.replyText;
                            nextStatus = oemFlow.nextStatus;
                        }
                        else if (missingFields.length === 0) {
                            nextStatus = "collect_part";
                            replyText =
                                language === "en"
                                    ? "Got the vehicle document. Which part do you need? Please include position (front/rear, left/right) and any symptoms."
                                    : (0, botResponses_1.t)('ocr_success', language);
                        }
                        else {
                            // gezielte Rückfrage
                            const field = missingFields[0];
                            if (field === "vin_or_hsn_tsn") {
                                replyText =
                                    language === "en"
                                        ? "I couldn’t read VIN or HSN/TSN. Please send those numbers or a clearer photo."
                                        : "Ich konnte VIN oder HSN/TSN nicht sicher erkennen. Bitte schicken Sie mir die Nummern oder ein schärferes Foto.";
                            }
                            else if (field === "make") {
                                replyText = language === "en" ? "Which car brand is it?" : "Welche Automarke ist es?";
                            }
                            else if (field === "model") {
                                replyText = language === "en" ? "Which exact model is it?" : "Welches Modell genau?";
                            }
                            else {
                                replyText =
                                    language === "en"
                                        ? "Please share VIN or HSN/TSN, or at least make/model/year, so I can identify your car."
                                        : (0, botResponses_1.t)('collect_vehicle_manual', language);
                            }
                            nextStatus = "collect_vehicle";
                        }
                        break;
                    }
                    // Fahrzeugdaten speichern (kumulativ)
                    logger_1.logger.info("Vehicle partial from parsed message", {
                        orderId: order.id,
                        partial: {
                            make: parsed.make ?? null,
                            model: parsed.model ?? null,
                            year: parsed.year ?? null,
                            engineCode: parsed.engine ?? null,
                            vin: parsed.vin ?? null,
                            hsn: parsed.hsn ?? null,
                            tsn: parsed.tsn ?? null
                        }
                    });
                    await getSupa().upsertVehicleForOrderFromPartial(order.id, {
                        make: parsed.make ?? null,
                        model: parsed.model ?? null,
                        year: parsed.year ?? null,
                        engineCode: parsed.engine ?? null,
                        engineKw: parsed.engineKw ?? null,
                        fuelType: parsed.fuelType ?? null,
                        emissionClass: parsed.emissionClass ?? null,
                        vin: parsed.vin ?? null,
                        hsn: parsed.hsn ?? null,
                        tsn: parsed.tsn ?? null
                    });
                    // Kumuliertes Fahrzeug aus DB holen und Pflichtfelder prüfen
                    const vehicle = await (0, supabaseService_1.getVehicleForOrder)(order.id);
                    logger_1.logger.info("Vehicle after upsert", { orderId: order.id, vehicle });
                    const missingVehicleFields = (0, oemRequiredFieldsService_1.determineRequiredFields)({
                        make: vehicle?.make,
                        model: vehicle?.model,
                        year: vehicle?.year,
                        engine: vehicle?.engineCode ?? vehicle?.engine ?? vehicle?.engineKw,
                        vin: vehicle?.vin,
                        hsn: vehicle?.hsn,
                        tsn: vehicle?.tsn
                    });
                    if (missingVehicleFields.length > 0) {
                        const q = buildVehicleFollowUpQuestion(missingVehicleFields, language ?? "de");
                        replyText =
                            q ||
                                (language === "en"
                                    ? "Please share VIN or HSN/TSN, or at least make/model/year, so I can identify your car."
                                    : (0, botResponses_1.t)('collect_vehicle_manual', language));
                        nextStatus = "collect_vehicle";
                    }
                    else {
                        const summary = `${vehicle?.make} ${vehicle?.model} (${vehicle?.year})`;
                        replyText = language === "en"
                            ? `I've identified your vehicle as ${summary}. Is this correct?`
                            : `Ich habe Ihr Fahrzeug als ${summary} identifiziert. Ist das korrekt?`;
                        nextStatus = "confirm_vehicle";
                    }
                    break;
                }
                case "confirm_vehicle": {
                    const isYes = userText.toLowerCase().match(/^(ja|yes|jo|jup|correct|korrekt|stimmt|y)$/);
                    if (isYes) {
                        try {
                            await (0, supabaseService_1.updateOrderData)(order.id, { vehicleConfirmed: true });
                            orderData = { ...orderData, vehicleConfirmed: true };
                        }
                        catch (err) {
                            logger_1.logger.error("Failed to store vehicle confirmation", { orderId: order.id });
                        }
                        const partName = orderData?.requestedPart || orderData?.partText;
                        if (partName) {
                            const vehicleForBrain = await (0, supabaseService_1.getVehicleForOrder)(order.id);
                            const oemFlow = await runOemLookupAndScraping(order.id, language ?? "de", { intent: "request_part", normalizedPartName: partName, userPartText: partName }, orderData, partName, vehicleForBrain);
                            replyText = oemFlow.replyText;
                            nextStatus = oemFlow.nextStatus;
                        }
                        else {
                            replyText = language === "en"
                                ? "Great! Which part do you need? Please include position and symptoms."
                                : (0, botResponses_1.t)('collect_part', language);
                            nextStatus = "collect_part";
                        }
                    }
                    else {
                        // User says no or provided different info
                        replyText = language === "en"
                            ? "Oh, I'm sorry. Please send me a photo of your registration or the correct VIN so I can identify the right car."
                            : "Oh, das tut mir leid. Bitte schicken Sie mir ein Foto vom Fahrzeugschein oder die korrekte VIN, damit ich das richtige Fahrzeug finden kann.";
                        nextStatus = "collect_vehicle";
                        // Option: Clear vehicle data? User might just want to correct it.
                    }
                    break;
                }
                case "collect_part": {
                    // Teileinfos kumulativ aus order_data + neuer Nachricht mergen
                    const existingPartInfo = {
                        partCategory: orderData?.partCategory ?? null,
                        partPosition: orderData?.partPosition ?? null,
                        partDetails: orderData?.partDetails ?? {},
                        partText: orderData?.partText ?? null
                    };
                    const mergedPartInfo = mergePartInfo(existingPartInfo, parsed);
                    partDescription = partDescription ? `${partDescription}\n${userText}` : userText;
                    // persistierte order_data aktualisieren
                    try {
                        await (0, supabaseService_1.updateOrderData)(order.id, {
                            partCategory: mergedPartInfo.partCategory ?? null,
                            partPosition: mergedPartInfo.partPosition ?? null,
                            partDetails: mergedPartInfo.partDetails ?? {},
                            partText: mergedPartInfo.partText ?? null,
                            requestedPart: mergedPartInfo.partText ?? orderData?.requestedPart ?? null
                        });
                        orderData = { ...orderData, ...mergedPartInfo };
                    }
                    catch (err) {
                        logger_1.logger.error("Failed to update order_data with part info", { error: err?.message, orderId: order.id });
                    }
                    const vehicleForBrain = await (0, supabaseService_1.getVehicleForOrder)(order.id);
                    const brain = await runCollectPartBrain({
                        userText,
                        parsed,
                        order,
                        orderData: { ...orderData, vehicle: vehicleForBrain ?? undefined },
                        language: language ?? "de",
                        lastQuestionType: orderData?.lastQuestionType ?? null
                    });
                    replyText = brain.replyText;
                    nextStatus = brain.nextStatus;
                    // track last question type for simple repeat-avoidance
                    let lastQuestionType = null;
                    if (brain.slotsToAsk?.includes("part_name"))
                        lastQuestionType = "ask_part_name";
                    else if (brain.slotsToAsk?.includes("position"))
                        lastQuestionType = "ask_position";
                    else
                        lastQuestionType = null;
                    try {
                        await (0, supabaseService_1.updateOrderData)(order.id, {
                            lastQuestionType
                        });
                        orderData = { ...orderData, lastQuestionType };
                    }
                    catch (err) {
                        logger_1.logger.error("Failed to store lastQuestionType", { error: err?.message, orderId: order.id });
                    }
                    // Wenn wir genug haben, OEM-Flow starten
                    if (brain.nextStatus === "oem_lookup") {
                        const partText = parsed.normalizedPartName ||
                            mergedPartInfo.partText ||
                            orderData?.requestedPart ||
                            (partDescription || "").trim() ||
                            (language === "en" ? "the part you mentioned" : "das genannte Teil");
                        logger_1.logger.info("Conversation state", {
                            orderId: order.id,
                            prevStatus: order.status,
                            nextStatus: "oem_lookup",
                            language
                        });
                        const oemFlow = await runOemLookupAndScraping(order.id, language ?? "de", { ...parsed, part: partText }, orderData, partDescription ?? null);
                        replyText = oemFlow.replyText;
                        nextStatus = oemFlow.nextStatus;
                    }
                    break;
                }
                case "oem_lookup": {
                    const oemFlow = await runOemLookupAndScraping(order.id, language ?? "de", parsed, orderData, partDescription ?? null);
                    replyText = oemFlow.replyText;
                    nextStatus = oemFlow.nextStatus;
                    break;
                }
                case "show_offers": {
                    try {
                        const offers = await (0, supabaseService_1.listShopOffersByOrderId)(order.id);
                        const sorted = (offers ?? []).slice().sort((a, b) => {
                            const pa = a.price ?? Number.POSITIVE_INFINITY;
                            const pb = b.price ?? Number.POSITIVE_INFINITY;
                            return pa - pb;
                        });
                        logger_1.logger.info("Show offers", { orderId: order.id, offersCount: sorted.length });
                        if (!sorted || sorted.length === 0) {
                            replyText =
                                language === "en"
                                    ? "I’m still collecting offers for you. You’ll get a selection shortly."
                                    : "Ich suche noch passende Angebote. Du bekommst gleich eine Auswahl.";
                            nextStatus = "show_offers";
                            break;
                        }
                        if (sorted.length === 1) {
                            const offer = sorted[0];
                            const endPrice = calculateEndPrice(offer.price);
                            const delivery = offer.deliveryTimeDays ?? (language === "en" ? "n/a" : "k.A.");
                            const bindingNote = language === "en"
                                ? "\n\n⚠️ NOTE: This offer is a binding purchase agreement."
                                : "\n\n⚠️ HINWEIS: Mit deiner Bestätigung gibst du ein verbindliches Kaufangebot bei deinem Händler ab.";
                            // Beautiful offer formatting for WhatsApp (NO LINK, NO SHOP NAME for customer)
                            const isInStock = offer.shopName === "Händler-Lager" || offer.shopName === "Eigener Bestand";
                            const stockInfo = isInStock
                                ? (language === "en" ? "📦 *Available for immediate pickup!*" : "📦 *Sofort abholbereit!*")
                                : (language === "en" ? `🚚 *Delivery:* ${delivery} days` : `🚚 *Lieferzeit:* ${delivery} Tage`);
                            replyText =
                                language === "en"
                                    ? `✅ *Perfect Match Found!*\n\n` +
                                        `🏷️ *Brand:* ${offer.brand ?? "n/a"}\n` +
                                        `💰 *Price:* ${endPrice} ${offer.currency}\n` +
                                        `${stockInfo}\n` +
                                        `${offer.availability && !isInStock ? `📦 *Stock:* ${offer.availability}\n` : ''}` +
                                        `${bindingNote}\n\n` +
                                        `Do you want to order this now?`
                                    : `✅ *Perfektes Angebot gefunden!*\n\n` +
                                        `🏷️ *Marke:* ${offer.brand ?? "unbekannt"}\n` +
                                        `💰 *Preis:* ${endPrice} ${offer.currency}\n` +
                                        `${stockInfo}\n` +
                                        `${offer.availability && !isInStock ? `📦 *Verfügbarkeit:* ${offer.availability}\n` : ''}` +
                                        `${bindingNote}\n\n` +
                                        `Jetzt verbindlich bestellen?`;
                            try {
                                await (0, supabaseService_1.updateOrderData)(order.id, {
                                    selectedOfferCandidateId: offer.id
                                });
                                orderData = { ...orderData, selectedOfferCandidateId: offer.id };
                            }
                            catch (err) {
                                logger_1.logger.error("Failed to store selectedOfferCandidateId", { error: err?.message, orderId: order.id });
                            }
                            nextStatus = "await_offer_confirmation";
                            return {
                                reply: replyText,
                                orderId: order.id,
                                mediaUrl: offer.imageUrl ?? undefined, // Product image for customer
                                buttons: language === "en" ? ["Yes, order now", "No, show others"] : ["Ja, jetzt bestellen", "Nein, andere suchen"]
                            };
                        }
                        const top = sorted.slice(0, 3);
                        const lines = language === "en"
                            ? top.map((o, idx) => {
                                const isInStock = o.shopName === "Händler-Lager" || o.shopName === "Eigener Bestand";
                                const deliveryInfo = isInStock ? "📦 Sofort" : `🚚 ${o.deliveryTimeDays ?? "n/a"} days`;
                                return `*${idx + 1}.* 🏷️ ${o.brand ?? "n/a"}\n` +
                                    `   💰 ${calculateEndPrice(o.price)} ${o.currency} | ${deliveryInfo}`;
                            })
                            : top.map((o, idx) => {
                                const isInStock = o.shopName === "Händler-Lager" || o.shopName === "Eigener Bestand";
                                const deliveryInfo = isInStock ? "📦 Sofort" : `🚚 ${o.deliveryTimeDays ?? "k.A."} Tage`;
                                return `*${idx + 1}.* 🏷️ ${o.brand ?? "k.A."}\n` +
                                    `   💰 ${calculateEndPrice(o.price)} ${o.currency} | ${deliveryInfo}`;
                            });
                        const multiBindingNote = language === "en"
                            ? "\n\n⚠️ Selecting an option constitutes a binding purchase agreement."
                            : "\n\n⚠️ Die Auswahl einer Option gilt als verbindliches Kaufangebot.";
                        replyText =
                            language === "en"
                                ? "✅ *I found multiple offers!*\n\nPlease choose one:\n\n" +
                                    lines.join("\n\n") +
                                    multiBindingNote +
                                    "\n\n👉 Reply with *1*, *2* or *3*."
                                : "✅ *Ich habe mehrere Angebote gefunden!*\n\nBitte wähle eines:\n\n" +
                                    lines.join("\n\n") +
                                    multiBindingNote +
                                    "\n\n👉 Antworte mit *1*, *2* oder *3*.";
                        try {
                            await (0, supabaseService_1.updateOrderData)(order.id, {
                                offerChoiceIds: top.map((o) => o.id)
                            });
                            orderData = { ...orderData, offerChoiceIds: top.map((o) => o.id) };
                        }
                        catch (err) {
                            logger_1.logger.error("Failed to store offerChoiceIds", { error: err?.message, orderId: order.id });
                        }
                        nextStatus = "await_offer_choice";
                        return {
                            reply: replyText,
                            orderId: order.id,
                            mediaUrl: top[0]?.imageUrl ?? undefined
                        };
                    }
                    catch (err) {
                        logger_1.logger.error("Fetching offers failed", { error: err?.message, orderId: order.id });
                        replyText =
                            language === "en"
                                ? "I couldn't retrieve offers right now. I'll update you soon."
                                : "Ich konnte gerade keine Angebote abrufen. Ich melde mich bald erneut.";
                        nextStatus = "show_offers";
                        return { reply: replyText, orderId: order.id };
                    }
                    break;
                }
                case "await_offer_choice": {
                    const t = (userText || "").trim().toLowerCase();
                    let choiceIndex = null;
                    if (t.includes("1"))
                        choiceIndex = 0;
                    else if (t.includes("2"))
                        choiceIndex = 1;
                    else if (t.includes("3"))
                        choiceIndex = 2;
                    logger_1.logger.info("User offer choice message", { orderId: order.id, text: userText });
                    const choiceIds = orderData?.offerChoiceIds;
                    if (choiceIndex === null || !choiceIds || choiceIndex < 0 || choiceIndex >= choiceIds.length) {
                        replyText =
                            language === "en"
                                ? 'Please reply with 1, 2 or 3 to pick one of the offers.'
                                : 'Bitte antworte mit 1, 2 oder 3, um ein Angebot auszuwählen.';
                        nextStatus = "await_offer_choice";
                        break;
                    }
                    const chosenOfferId = choiceIds[choiceIndex];
                    const offers = await (0, supabaseService_1.listShopOffersByOrderId)(order.id);
                    const chosen = offers.find((o) => o.id === chosenOfferId);
                    if (!chosen) {
                        replyText =
                            language === "en"
                                ? "I couldn’t match your choice. I’ll show the offers again."
                                : "Ich konnte deine Auswahl nicht zuordnen. Ich zeige dir die Angebote gleich erneut.";
                        nextStatus = "show_offers";
                        break;
                    }
                    try {
                        await (0, supabaseService_1.updateOrderData)(order.id, {
                            selectedOfferId: chosen.id,
                            selectedOfferSummary: {
                                shopName: chosen.shopName,
                                brand: chosen.brand,
                                price: calculateEndPrice(chosen.price),
                                currency: chosen.currency,
                                deliveryTimeDays: chosen.deliveryTimeDays
                            }
                        });
                        await (0, supabaseService_1.updateOrderStatus)(order.id, "ready");
                    }
                    catch (err) {
                        logger_1.logger.error("Failed to store selected offer", { error: err?.message, orderId: order.id, chosenOfferId });
                    }
                    logger_1.logger.info("User selected offer", {
                        orderId: order.id,
                        choiceIndex,
                        chosenOfferId: chosen.id,
                        chosenShop: chosen.shopName,
                        price: chosen.price
                    });
                    replyText =
                        language === "en"
                            ? `Thank you! Your order (${order.id}) has been saved with the offer from ${chosen.shopName} (${chosen.brand ?? "n/a"}, ${calculateEndPrice(chosen.price)} ${chosen.currency}). This is now a binding agreement. Your dealer will contact you soon.`
                            : `Vielen Dank! Ihre Bestellung (${order.id}) wurde mit dem Angebot von ${chosen.shopName} (${chosen.brand ?? "k.A."}, ${calculateEndPrice(chosen.price)} ${chosen.currency}) gespeichert. Dies ist nun eine verbindliche Bestellung. Ihr Händler wird Sie bald kontaktieren.`;
                    nextStatus = "done";
                    break;
                }
                case "await_offer_confirmation": {
                    const t = (userText || "").trim().toLowerCase();
                    const isYes = ["ja", "okay", "ok", "passt", "yes", "yep", "okey"].some((w) => t.includes(w));
                    const isNo = ["nein", "no", "nicht", "anders"].some((w) => t.includes(w));
                    const candidateId = orderData?.selectedOfferCandidateId;
                    logger_1.logger.info("User offer confirmation", {
                        orderId: order.id,
                        text: userText,
                        isYes,
                        isNo,
                        candidateOfferId: candidateId
                    });
                    if (!isYes && !isNo) {
                        replyText =
                            language === "en"
                                ? 'If this offer works for you, please reply with "Yes" or "OK". If not, tell me what matters most (price, brand, delivery time).'
                                : 'Wenn das Angebot für Sie passt, antworten Sie bitte mit "Ja" oder "OK". Wenn nicht, sagen Sie mir kurz, was Ihnen wichtig ist (z.B. Preis, Marke oder Lieferzeit).';
                        nextStatus = "await_offer_confirmation";
                        break;
                    }
                    if (isNo) {
                        replyText =
                            language === "en"
                                ? "Got it, I’ll see if I can find alternative offers. Tell me what matters most: price, brand or delivery time."
                                : "Alles klar, ich schaue, ob ich Ihnen noch andere Angebote finden kann. Sagen Sie mir gerne, was Ihnen wichtiger ist: Preis, Marke oder Lieferzeit.";
                        nextStatus = "show_offers";
                        break;
                    }
                    if (!candidateId) {
                        replyText =
                            language === "en"
                                ? "I lost track of the offer. I’ll fetch the options again."
                                : "Ich habe das Angebot nicht mehr parat. Ich hole die Optionen nochmal.";
                        nextStatus = "show_offers";
                        break;
                    }
                    const offers = await (0, supabaseService_1.listShopOffersByOrderId)(order.id);
                    const chosen = offers.find((o) => o.id === candidateId);
                    if (!chosen) {
                        replyText =
                            language === "en"
                                ? "I couldn’t find that offer anymore. I’ll show available offers again."
                                : "Ich konnte dieses Angebot nicht mehr finden. Ich zeige dir die verfügbaren Angebote erneut.";
                        nextStatus = "show_offers";
                        break;
                    }
                    try {
                        await (0, supabaseService_1.updateOrderData)(order.id, {
                            selectedOfferId: chosen.id,
                            selectedOfferSummary: {
                                shopName: chosen.shopName,
                                brand: chosen.brand,
                                price: calculateEndPrice(chosen.price, merchantSettings?.marginPercent),
                                currency: chosen.currency,
                                deliveryTimeDays: chosen.deliveryTimeDays
                            }
                        });
                        await (0, supabaseService_1.updateOrderStatus)(order.id, "ready");
                        if (merchantSettings?.allowDirectDelivery) {
                            replyText = language === "en"
                                ? "Great! Do you want the part delivered to your home (D) or do you want to pick it up at the dealer (P)?"
                                : "Super! Möchtest du das Teil nach Hause geliefert bekommen (D) oder holst du es beim Händler ab (P)?";
                            nextStatus = "collect_delivery_preference";
                        }
                        else {
                            const dealerLoc = merchantSettings?.dealerAddress || "unseren Standort";
                            replyText = language === "en"
                                ? `Perfect! I've reserved the part. You can pick it up at: ${dealerLoc}.`
                                : `Perfekt! Ich habe das Teil reserviert. Du kannst es hier abholen: ${dealerLoc}.`;
                            nextStatus = "done";
                        }
                    }
                    catch (err) {
                        logger_1.logger.error("Failed to store confirmed offer", { error: err?.message, orderId: order.id, candidateId });
                    }
                    logger_1.logger.info("Offer selection stored", {
                        orderId: order.id,
                        selectedOfferId: chosen.id,
                        statusUpdatedTo: "ready"
                    });
                    replyText =
                        language === "en"
                            ? `Perfect, I’ve saved this offer for you. Your order (${order.id}) is now binding. Your dealer will contact you soon.`
                            : `Perfekt, ich habe dieses Angebot für Sie gespeichert. Ihre Bestellung (${order.id}) ist nun verbindlich. Ihr Händler wird Sie bald kontaktieren.`;
                    nextStatus = "done";
                    break;
                }
                case "collect_delivery_preference": {
                    const choice = userText.toLowerCase();
                    if (choice.includes("d") || choice.includes("liefer")) {
                        replyText = language === "en"
                            ? "Excellent choice. Please send me your full delivery address."
                            : "Sehr gute Wahl. Bitte sende mir nun deine vollständige Lieferadresse.";
                        nextStatus = "collect_address";
                    }
                    else if (choice.includes("p") || choice.includes("abhol")) {
                        const dealerLoc = merchantSettings?.dealerAddress || "unseren Standort";
                        replyText = language === "en"
                            ? `Perfect! You can pick up the part at: ${dealerLoc}. See you soon!`
                            : `Perfekt! Du kannst das Teil hier abholen: ${dealerLoc}. Bis bald!`;
                        nextStatus = "done";
                    }
                    else {
                        replyText = language === "en"
                            ? "Please decide: Delivery (D) or Pickup (P)?"
                            : "Bitte entscheide dich: Lieferung (D) oder Abholung (P)?";
                        nextStatus = "collect_delivery_preference";
                    }
                    break;
                }
                case "collect_address": {
                    if (userText.length > 10) {
                        try {
                            await getSupa().saveDeliveryAddress(order.id, userText);
                        }
                        catch (err) {
                            logger_1.logger.error("Failed to save delivery address", { orderId: order.id, error: err });
                        }
                        replyText = language === "en"
                            ? "Thank you! Your delivery address has been saved. We will ship the part shortly."
                            : "Vielen Dank! Deine Lieferadresse wurde gespeichert. Wir versenden das Teil in Kürze.";
                        nextStatus = "done";
                    }
                    else {
                        replyText = language === "en"
                            ? "Please provide a valid delivery address."
                            : "Bitte gib eine gültige Lieferadresse an.";
                        nextStatus = "collect_address";
                    }
                    break;
                }
                case "done": {
                    // Context-aware handling: detect what user wants to do next
                    const t = userText.toLowerCase();
                    // Check if user wants another part for the same vehicle
                    const newPartKeywords = ["brauche auch", "noch ein", "außerdem", "dazu noch", "zusätzlich",
                        "another", "also need", "bremsbeläge", "scheiben", "filter", "zündkerzen", "kupplung"];
                    const wantsNewPart = newPartKeywords.some(k => t.includes(k)) ||
                        (t.length > 5 && !t.includes("?") && !t.includes("danke") && !t.includes("thanks"));
                    // Check if user wants to start completely fresh
                    const freshStartKeywords = ["neues auto", "anderes auto", "new car", "different vehicle", "von vorn"];
                    const wantsFreshStart = freshStartKeywords.some(k => t.includes(k));
                    // Check if it's just a thank you / goodbye
                    const goodbyeKeywords = ["danke", "thanks", "tschüss", "bye", "super", "perfekt", "ok"];
                    const isGoodbye = goodbyeKeywords.some(k => t.includes(k));
                    if (wantsFreshStart) {
                        // User wants different vehicle
                        nextStatus = "collect_vehicle";
                        replyText = language === "en"
                            ? "Sure! Send me a photo of the vehicle registration document for the new car."
                            : "Klar! Schicken Sie mir ein Foto vom Fahrzeugschein des neuen Fahrzeugs.";
                    }
                    else if (wantsNewPart && order.vehicle_description) {
                        // User wants another part for same vehicle - create new order with copied vehicle
                        try {
                            const newOrder = await getSupa().findOrCreateOrder(payload.from, null, { forceNew: true });
                            await (0, supabaseService_1.updateOrder)(newOrder.id, {
                                vehicle_description: order.vehicle_description,
                                status: "collect_part",
                                language
                            });
                            if (orderData?.vehicle) {
                                await getSupa().updateOrderData(newOrder.id, { vehicle: orderData.vehicle });
                            }
                            replyText = language === "en"
                                ? `Great! I'm using your ${orderData?.vehicle?.make || ""} ${orderData?.vehicle?.model || "vehicle"}. What part do you need?`
                                : `Super! Ich nutze Ihr ${orderData?.vehicle?.make || ""} ${orderData?.vehicle?.model || "Fahrzeug"}. Welches Teil benötigen Sie?`;
                            return { reply: replyText, orderId: newOrder.id };
                        }
                        catch (err) {
                            logger_1.logger.error("Failed to create follow-up order", { error: err?.message });
                            replyText = language === "en"
                                ? "What part do you need for your vehicle?"
                                : "Welches Teil benötigen Sie für Ihr Fahrzeug?";
                            nextStatus = "collect_part";
                        }
                    }
                    else if (isGoodbye) {
                        // User is saying goodbye
                        replyText = language === "en"
                            ? "Thank you! If you need anything else, just write me anytime. 👋"
                            : "Vielen Dank! Wenn du noch etwas brauchst, schreib mir jederzeit. 👋";
                    }
                    else {
                        // Default: order complete message
                        replyText = language === "en"
                            ? "Your order is complete. If you have further questions, just ask!"
                            : "Ihre Bestellung ist abgeschlossen. Wenn Sie weitere Fragen haben, fragen Sie einfach!";
                    }
                    // Only use Content API for actual goodbye, not for follow-up parts
                    if (isGoodbye) {
                        return {
                            reply: replyText,
                            orderId: order.id,
                            contentSid: 'HXb5b62575e6e4ff6129ad7c8efe1f983e',
                            contentVariables: JSON.stringify({ "1": order.id, "2": "Bestellung abgeschlossen" })
                        };
                    }
                    break;
                }
                default: {
                    // Unerwarteter Zustand: sauber neustarten
                    nextStatus = "choose_language";
                    language = null;
                    replyText =
                        "Es ist ein interner Fehler im Status aufgetreten. Lass uns neu starten: Bitte wähle deine Sprache (1-5).\nThere was an internal state error. Let’s restart: please choose your language (1-5).";
                }
            } // END switch
        } // END if (!replyText) - state machine fallback wrapper
        // Fallback, falls keine Antwort gesetzt wurde
        if (!replyText) {
            replyText =
                (language ?? "de") === "en"
                    ? "I'm working on your request. I'll update you soon."
                    : "Ich arbeite an deiner Anfrage und melde mich gleich.";
        }
        const vehicleDescToSave = hasVehicleImage
            ? vehicleDescription
                ? `${vehicleDescription}\n${vehicleImageNote ?? ""}`
                : vehicleImageNote ?? ""
            : vehicleDescription || "";
        // State + Daten speichern
        try {
            await (0, supabaseService_1.updateOrder)(order.id, {
                status: nextStatus,
                language,
                vehicle_description: vehicleDescToSave || null,
                part_description: partDescription ?? null
            });
        }
        catch (err) {
            logger_1.logger.error("Failed to update order in handleIncomingBotMessage", {
                error: err?.message,
                orderId: order.id
            });
        }
        return { reply: replyText, orderId: order.id };
    });
}
// End of file: ensure top-level block is closed
