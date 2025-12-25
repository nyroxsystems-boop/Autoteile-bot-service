import OpenAI from "openai";
import fetch from "node-fetch";
import {
  insertMessage,
  findOrCreateOrder,
  updateOrder,
  updateOrderData,
  ConversationStatus,
  upsertVehicleForOrderFromPartial,
  getVehicleForOrder,
  persistOemMetadata,
  updateOrderOEM,
  listShopOffersByOrderId,
  getOrderById,
  updateOrderStatus,
  persistScrapeResult,
  updateOrderScrapeTask,
  listActiveOrdersByContact
} from "./supabaseService";
import { determineRequiredFields } from "./oemRequiredFieldsService";
import * as oemService from "./oemService";
import { logger } from "../utils/logger";
import { scrapeOffersForOrder } from "./scrapingService";
import { GENERAL_QA_SYSTEM_PROMPT } from "../prompts/generalQaPrompt";
import { TEXT_NLU_PROMPT } from "../prompts/textNluPrompt";
import { COLLECT_PART_BRAIN_PROMPT } from "../prompts/collectPartBrainPrompt";
import { fetchWithTimeoutAndRetry } from "../utils/httpClient";
import { ORCHESTRATOR_PROMPT } from "../prompts/orchestratorPrompt";
import { generateChatCompletion } from "./openAiService";
import * as fs from "fs/promises";

// Lazy accessor so tests can mock `./supabaseService` after this module was loaded.
function getSupa() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("./supabaseService");
}

/**
 * Berechnet den Endpreis für den Kunden inkl. Händler-Marge.
 */
function calculateEndPrice(buyingPrice: number, margin?: number): number {
  const m = margin ? (1 + margin / 100) : (Number(process.env.DEALER_MARGIN) || 1.25);
  return Math.round(buyingPrice * m * 100) / 100;
}

function calculateEstimatedDeliveryRange(days: number): string {
  const today = new Date();
  const min = new Date();
  min.setDate(today.getDate() + days);
  const max = new Date();
  max.setDate(today.getDate() + days + 2);

  const fmt = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `${fmt(min)} - ${fmt(max)}`;
}

// KI-Client für NLU
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ""
});

async function answerGeneralQuestion(params: {
  userText: string;
  language: string;
  missingVehicleInfo: string[];
  knownVehicleSummary: string;
}): Promise<string> {
  const { userText, language, missingVehicleInfo, knownVehicleSummary } = params;

  let missingInfoSentence = "";
  if (missingVehicleInfo.length > 0) {
    if (language === "de") {
      missingInfoSentence =
        "\n\nDamit ich passende Teile finden kann, brauche ich noch: " + missingVehicleInfo.join(", ") + ".";
    } else {
      missingInfoSentence =
        "\n\nTo find the correct parts, I still need: " + missingVehicleInfo.join(", ") + ".";
    }
  }
  const userPrompt =
    (language === "de"
      ? `Nutzerfrage: "${userText}"\n\nBereits bekannte Fahrzeugdaten: ${knownVehicleSummary}\nNoch fehlende Infos: ${missingVehicleInfo.join(", ") || "keine"
      }`
      : `User question: "${userText}"\n\nKnown vehicle data: ${knownVehicleSummary}\nMissing info: ${missingVehicleInfo.join(", ") || "none"
      }`) + "\n\nBitte beantworte die Frage oben.";

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: GENERAL_QA_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2
    });

    let text = response.choices[0]?.message?.content?.trim() || "";

    text += missingInfoSentence;

    return text;
  } catch (err: any) {
    console.error("General QA failed:", err?.message);
    return language === "de"
      ? "Gute Frage! Leider kann ich sie gerade nicht beantworten. Versuch es bitte später erneut."
      : "Good question! I can’t answer it right now, please try again later.";
  }
}

async function runCollectPartBrain(params: {
  userText: string;
  parsed: ParsedUserMessage;
  order: any;
  orderData: any;
  language: string;
  lastQuestionType: string | null;
}): Promise<CollectPartBrainResult> {
  const payload = {
    userText: sanitizeText(params.userText, 1000),
    parsed: params.parsed,
    orderData: params.orderData || {},
    language: params.language,
    currentStatus: "collect_part",
    lastQuestionType: params.lastQuestionType
  };

  try {
    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: COLLECT_PART_BRAIN_PROMPT },
        { role: "user", content: JSON.stringify(payload) }
      ],
      temperature: 0.2
    });

    const rawText = resp.choices[0]?.message?.content ?? "";
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
  } catch (error: any) {
    logger.error("runCollectPartBrain failed", { error: error?.message });
    return {
      replyText:
        params.language === "en"
          ? "Please tell me which exact part you need and, if relevant, for which side/axle."
          : "Bitte sag mir genau, welches Teil du brauchst und falls relevant, für welche Achse/Seite.",
      nextStatus: "collect_part",
      slotsToAsk: [],
      shouldApologize: false,
      detectedFrustration: false
    };
  }
}

// ------------------------------
// Parsing Interface
// ------------------------------
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

  // Fahrzeuginfos
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

  // Teileinfos
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

  // Smalltalk (optional, legacy)
  smalltalkType?: SmalltalkType | null;
  smalltalkReply?: string | null;
}

// Pflichtfelder pro Teilkategorie (Minimalanforderungen für OEM-Ermittlung)
const partRequiredFields: Record<string, string[]> = {
  brake_caliper: ["position"],
  brake_disc: ["position", "disc_diameter"],
  brake_pad: ["position"],
  shock_absorber: ["position"]
};

type SmalltalkType = "greeting" | "thanks" | "bot_question";

// ------------------------------
// Hilfsfunktionen
// ------------------------------
function detectLanguageSelection(text: string): "de" | "en" | null {
  if (!text) return null;
  const t = text.trim().toLowerCase();

  if (["1", "de", "deutsch", "german", "ger"].includes(t)) return "de";
  if (["2", "en", "english", "englisch", "eng"].includes(t)) return "en";

  return null;
}

function detectLanguageFromText(text: string): "de" | "en" | null {
  const t = text?.toLowerCase() ?? "";
  const germanHints = ["hallo", "moin", "servus", "grüß", "danke", "tschau", "bitte"];
  const englishHints = ["hello", "hi", "hey", "thanks", "thank you", "cheers"];

  if (germanHints.some((w) => t.includes(w))) return "de";
  if (englishHints.some((w) => t.includes(w))) return "en";
  return null;
}

function needsVehicleDocumentHint(order: any): boolean {
  return order?.status === "choose_language" || order?.status === "collect_vehicle";
}

function detectSmalltalk(text: string): SmalltalkType | null {
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

async function verifyOemWithAi(params: {
  vehicle: any;
  part: string;
  oem: string;
  language: string;
}): Promise<boolean> {
  if (!process.env.OPENAI_API_KEY) return true;
  try {
    const prompt =
      "Prüfe, ob die OEM-Nummer zum Fahrzeug und Teil plausibel ist. Antworte NUR mit JSON: {\"ok\":true|false,\"reason\":\"...\"}.\n" +
      `Fahrzeug: ${JSON.stringify(params.vehicle)}\nTeil: ${params.part}\nOEM: ${params.oem}\n` +
      "Setze ok=false nur wenn OEM offensichtlich nicht zum Fahrzeug/Teil passen kann.";

    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    });
    const raw = resp.choices[0]?.message?.content ?? "";
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

/**
 * Detects obviously abusive or insulting messages with a simple word list.
 * Returns true when the message should be treated as abuse (and not advance the flow).
 */
function detectAbusive(text: string): boolean {
  if (!text) return false;
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

type OrchestratorAction = "ask_slot" | "confirm" | "oem_lookup" | "smalltalk" | "abusive" | "noop";

interface CollectPartBrainResult {
  replyText: string;
  nextStatus: ConversationStatus;
  slotsToAsk: string[];
  shouldApologize: boolean;
  detectedFrustration: boolean;
}

interface OrchestratorResult {
  action: OrchestratorAction;
  reply: string;
  slots: Record<string, any>;
  required_slots?: string[];
  confidence?: number;
}

async function callOrchestrator(payload: any): Promise<OrchestratorResult | null> {
  try {
    const userContent = JSON.stringify(payload);
    // Use dynamic require so tests that mock `./openAiService` after this module
    // was loaded (compiled dist tests) still influence the invoked function.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const gen = require("./openAiService").generateChatCompletion;
    const raw = await gen({
      messages: [
        { role: "system", content: ORCHESTRATOR_PROMPT },
        { role: "user", content: userContent }
      ],
      model: "gpt-4.1-mini"
    });

    // Debug: log raw orchestrator response to aid test diagnostics
    logger.debug?.("Orchestrator raw response", { raw, short: (typeof raw === 'string' ? raw.slice(0, 200) : raw) });

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const jsonString = start !== -1 && end !== -1 && end > start ? raw.slice(start, end + 1) : raw;
    const parsed = JSON.parse(jsonString);
    return {
      action: parsed.action as OrchestratorAction,
      reply: parsed.reply ?? "",
      slots: parsed.slots ?? {},
      required_slots: Array.isArray(parsed.required_slots) ? parsed.required_slots : [],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 1
    };
  } catch (err: any) {
    logger.warn("Orchestrator call failed or returned invalid JSON", { error: err?.message });
    return null;
  }
}

function buildSmalltalkReply(kind: SmalltalkType, lang: "de" | "en", stage: string | null): string {
  const needsVehicleDoc = stage === "awaiting_vehicle_document";
  const needsVehicleData = stage === "collecting_vehicle_data";
  const needsPartData = stage === "collecting_part_data";

  if (kind === "thanks") {
    return lang === "de"
      ? "Gern geschehen! Sag mir einfach, wenn du noch ein Teil oder mehr Infos brauchst."
      : "You’re welcome! Let me know if you need a part or any other help.";
  }

  if (kind === "bot_question") {
    return lang === "de"
      ? "Ich bin dein Teile-Assistent und helfe dir, das richtige Ersatzteil zu finden. Schick mir Marke/Modell/Baujahr oder ein Foto vom Fahrzeugschein."
      : "I’m your parts assistant and can help you find the right part. Send me the car brand/model/year or a photo of the registration document.";
  }

  // greeting
  if (needsVehicleDoc) {
    return lang === "de"
      ? "Hi! 👋 Schick mir am besten zuerst ein Foto deines Fahrzeugscheins. Wenn du keins hast, nenn mir bitte Marke, Modell, Baujahr und falls möglich Motor/HSN/TSN."
      : "Hi there! 👋 Please send a photo of your vehicle registration first. If you don’t have one, tell me brand, model, year and, if possible, engine/HSN/TSN.";
  }
  if (needsVehicleData) {
    return lang === "de"
      ? "Hallo! 👋 Welche Fahrzeugdaten hast du für mich? Marke, Modell, Baujahr und Motor helfen mir am meisten."
      : "Hello! 👋 Which vehicle details do you have for me? Brand, model, year, and engine help the most.";
  }
  if (needsPartData) {
    return lang === "de"
      ? "Hey! 👋 Um dir das richtige Teil zu finden, sag mir bitte um welches Teil es geht und vorne/hinten, links/rechts."
      : "Hey! 👋 To find the right part, tell me which part you need and whether it’s front/rear, left/right.";
  }

  return lang === "de"
    ? "Hallo! 👋 Wie kann ich dir helfen? Suchst du ein Ersatzteil? Dann schick mir Marke/Modell/Baujahr oder ein Foto vom Fahrzeugschein."
    : "Hi! 👋 How can I help? Looking for a part? Share the car brand/model/year or send a photo of the registration.";
}

/**
 * Simpler Heuristik-Check, ob der Kunde sagt, dass er keinen Fahrzeugschein hat.
 */
function detectNoVehicleDocument(text: string): boolean {
  if (!text) return false;
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
function hasSufficientPartInfo(parsed: ParsedUserMessage, orderData: any): { ok: boolean; missing: string[] } {
  // 1) Haben wir ein Teil?
  const normalizedPartName = parsed.normalizedPartName || orderData?.requestedPart || orderData?.partText || null;

  if (!normalizedPartName) {
    return { ok: false, missing: ["part_name"] };
  }

  // 2) Braucht dieses Teil eine Position?
  const category = parsed.partCategory || orderData?.partCategory || null;

  // Aus der NLU-Kategorie ableiten, ob eine Position typischerweise nötig ist
  const positionNeededFromCategory =
    category === "brake_component" || category === "suspension_component" || category === "body_component";

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
function buildVehicleFollowUpQuestion(missingFields: string[], lang: string): string | null {
  if (!missingFields || missingFields.length === 0) return null;

  const qDe: Record<string, string> = {
    make: "Welche Automarke ist es?",
    model: "Welches Modell genau?",
    year: "Welches Baujahr hat dein Fahrzeug?",
    engine: "Welche Motorisierung ist verbaut (kW oder Motorkennbuchstabe)?",
    vin: "Hast du die Fahrgestellnummer (VIN) für mich?",
    hsn: "Hast du die HSN (Feld 2.1 im Fahrzeugschein)?",
    tsn: "Hast du die TSN (Feld 2.2 im Fahrzeugschein)?",
    vin_or_hsn_tsn_or_engine: "Hast du VIN oder HSN/TSN oder die Motorisierung (kW/MKB)?"
  };

  const qEn: Record<string, string> = {
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
function buildPartFollowUpQuestion(missingFields: string[], lang: "de" | "en"): string | null {
  if (!missingFields || missingFields.length === 0) return null;

  const field = missingFields[0];

  if (lang === "de") {
    if (field === "part_name") {
      return "Welches Teil brauchst du genau? Zum Beispiel: Zündkerzen, Bremsscheiben vorne, Stoßdämpfer hinten, Querlenker…";
    }
    if (field === "position") {
      return "Für welche Seite/Achse brauchst du das Teil genau? Zum Beispiel: vorne links, vorne rechts, hinten links, hinten rechts.";
    }
  } else {
    if (field === "part_name") {
      return "Which part do you need exactly? For example: spark plugs, front brake discs, rear shock absorber, control arm…";
    }
    if (field === "position") {
      return "For which side/axle do you need the part exactly? For example: front left, front right, rear left, rear right.";
    }
  }

  return null;
}

/**
 * Merges newly parsed part info into the existing part info stored in order_data.
 * Fields are only overwritten when new values are provided.
 */
function mergePartInfo(existing: any, parsed: ParsedUserMessage) {
  const merged: any = {
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
  const candidatePartTexts: (string | null | undefined)[] = [
    parsed.normalizedPartName,
    parsed.userPartText,
    (parsed as any).part
  ];

  for (const candidate of candidatePartTexts) {
    if (candidate && candidate.trim()) {
      merged.partText = merged.partText ? `${merged.partText}\n${candidate.trim()}` : candidate.trim();
      break;
    }
  }

  return merged;
}

async function runOemLookupAndScraping(
  orderId: string,
  language: string | null,
  parsed: ParsedUserMessage,
  orderData: any,
  partDescription: string | null,
  // Optional override vehicle (e.g. OCR result) — used when DB upsert failed but OCR provided enough data
  vehicleOverride?: {
    make?: string;
    model?: string;
    year?: number;
    engine?: string;
    engineKw?: number;
    vin?: string;
    hsn?: string;
    tsn?: string;
    fuelType?: string;
    emissionClass?: string;
  }
): Promise<{ replyText: string; nextStatus: ConversationStatus }> {
  const vehicle = vehicleOverride ?? (await getVehicleForOrder(orderId));
  const engineVal = (vehicle as any)?.engineCode ?? (vehicle as any)?.engine ?? undefined;
  const vehicleForOem = {
    make: (vehicle as any)?.make ?? undefined,
    model: (vehicle as any)?.model ?? undefined,
    year: (vehicle as any)?.year ?? undefined,
    engine: engineVal,
    engineKw: (vehicle as any)?.engineKw ?? undefined,
    vin: (vehicle as any)?.vin ?? undefined,
    hsn: (vehicle as any)?.hsn ?? undefined,
    tsn: (vehicle as any)?.tsn ?? undefined
  };

  const missingVehicleFields = determineRequiredFields(vehicleForOem);
  if (missingVehicleFields.length > 0) {
    const q = buildVehicleFollowUpQuestion(missingVehicleFields, language ?? "de");
    return {
      replyText:
        q ||
        (language === "en"
          ? "I need a bit more vehicle info."
          : "Ich brauche noch ein paar Fahrzeugdaten."),
      nextStatus: "collect_vehicle"
    };
  }

  const partText =
    parsed.part ||
    orderData?.requestedPart ||
    orderData?.partText ||
    partDescription ||
    (language === "en" ? "the part you mentioned" : "das genannte Teil");

  try {
    // Prefer the modern `resolveOEMForOrder` if provided by the module.
    // Some tests/mock setups stub `resolveOEM` only, so fall back to that shape.
    let oemResult: any;
    if (typeof (oemService as any).resolveOEMForOrder === "function") {
      oemResult = await (oemService as any).resolveOEMForOrder(
        orderId,
        {
          make: vehicleForOem.make ?? null,
          model: vehicleForOem.model ?? null,
          year: vehicleForOem.year ?? null,
          engine: vehicleForOem.engine ?? null,
          engineKw: (vehicle as any)?.engineKw ?? null,
          vin: vehicleForOem.vin ?? null,
          hsn: vehicleForOem.hsn ?? null,
          tsn: vehicleForOem.tsn ?? null
        },
        partText
      );
    } else if (typeof (oemService as any).resolveOEM === "function") {
      // legacy adapter: resolveOEM(order, part) -> OemResolutionResult
      try {
        const legacy = await (oemService as any).resolveOEM(
          {
            make: vehicleForOem.make ?? undefined,
            model: vehicleForOem.model ?? undefined,
            year: vehicleForOem.year ?? undefined,
            engine: vehicleForOem.engine ?? undefined,
            engineKw: (vehicle as any)?.engineKw ?? undefined,
            vin: vehicleForOem.vin ?? undefined,
            hsn: vehicleForOem.hsn ?? undefined,
            tsn: vehicleForOem.tsn ?? undefined
          },
          partText
        );
        oemResult = {
          primaryOEM: legacy.oemNumber ?? (legacy.oem ?? undefined),
          overallConfidence: legacy.success ? 0.85 : 0,
          candidates: legacy.oemData?.candidates ?? [],
          notes: legacy.message ?? undefined,
          tecdocPartsouqResult: undefined
        };
      } catch (err: any) {
        logger.warn("Legacy resolveOEM adapter failed", { orderId, error: err?.message });
        oemResult = { primaryOEM: undefined, overallConfidence: 0, candidates: [], notes: undefined };
      }
    } else {
      logger.warn("No OEM resolver available", { orderId });
      oemResult = { primaryOEM: undefined, overallConfidence: 0, candidates: [], notes: undefined };
    }

    try {
      await updateOrderData(orderId, {
        oemNumber: oemResult.primaryOEM ?? null,
        oemConfidence: oemResult.overallConfidence ?? null,
        oemNotes: oemResult.notes ?? null,
        oemCandidates: oemResult.candidates ?? [],
        oemTecdocPartsouq: oemResult.tecdocPartsouqResult ?? null
      });
      try {
        await updateOrderOEM(orderId, {
          oemStatus: oemResult.primaryOEM ? "resolved" : "not_found",
          oemError: oemResult.primaryOEM ? null : oemResult.notes ?? null,
          oemData: oemResult,
          oemNumber: oemResult.primaryOEM ?? null
        });
      } catch (err: any) {
        logger.warn("Failed to persist OEM fields", { orderId, error: err?.message });
      }
    } catch (err: any) {
      logger.warn("Failed to persist OEM resolver output", { orderId, error: err?.message });
    }

    if (oemResult.primaryOEM && oemResult.overallConfidence >= 0.7) {
      const cautious = oemResult.overallConfidence < 0.9;
      try {
        const scrapeResult = await scrapeOffersForOrder(orderId, oemResult.primaryOEM);
        if (scrapeResult && (scrapeResult as any).jobId) {
          try {
            if (typeof persistScrapeResult === "function") {
              await persistScrapeResult(orderId, {
                scrapeTaskId: (scrapeResult as any).jobId,
                scrapeStatus: "started",
                scrapeResult: scrapeResult
              });
            } else if (typeof updateOrderScrapeTask === "function") {
              await updateOrderScrapeTask(orderId, {
                scrapeTaskId: (scrapeResult as any).jobId,
                scrapeStatus: "started",
                scrapeResult: scrapeResult
              });
            }
          } catch (uErr: any) {
            logger.warn("Failed to persist scrape job id", { orderId, error: uErr?.message ?? uErr });
          }
        } else {
          try {
            if (typeof persistScrapeResult === "function") {
              await persistScrapeResult(orderId, {
                scrapeStatus: (scrapeResult && (scrapeResult as any).ok) ? "done" : "unknown",
                scrapeResult: scrapeResult ?? null
              });
            } else if (typeof updateOrderScrapeTask === "function") {
              await updateOrderScrapeTask(orderId, {
                scrapeStatus: (scrapeResult && (scrapeResult as any).ok) ? "done" : "unknown",
                scrapeResult: scrapeResult ?? null
              });
            }
          } catch (uErr: any) {
            logger.warn("Failed to persist scrape result", { orderId, error: uErr?.message ?? uErr });
          }
        }

        const cautionNote =
          cautious && language === "de"
            ? " (bitte kurz prüfen)"
            : cautious && language === "en"
              ? " (please double-check)"
              : "";

        const reply =
          language === "en"
            ? `I found a suitable product and am checking offers now.${cautionNote}`
            : `Ich habe ein passendes Produkt gefunden und prüfe Angebote.${cautionNote}`;
        return {
          replyText: reply,
          nextStatus: "show_offers"
        };
      } catch (err: any) {
        logger.error("Scrape after OEM failed", { error: err?.message, orderId });
        return {
          replyText:
            language === "en"
              ? "I found a product match but fetching offers failed. I’ll ask a colleague."
              : "Ich habe ein passendes Produkt, aber die Angebotssuche ist fehlgeschlagen. Ich gebe das an einen Kollegen weiter.",
          nextStatus: "collect_part"
        };
      }
    }

    return {
      replyText:
        language === "en"
          ? "I’m not fully confident about the product yet. I’ll hand this to a colleague."
          : "Ich bin mir beim Produkt nicht sicher. Ich gebe das an einen Kollegen weiter.",
      nextStatus: "collect_part"
    };
  } catch (err: any) {
    logger.error("resolveOEM failed", { error: err?.message, orderId });
    return {
      replyText:
        language === "en"
          ? "A technical error occurred while finding the right part. Please send more vehicle info."
          : "Beim Finden des passenden Teils ist ein technischer Fehler aufgetreten. Bitte schick mir noch ein paar Fahrzeugdaten.",
      nextStatus: "collect_vehicle"
    };
  }
}

async function downloadImageBuffer(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to download image: ${resp.status} ${resp.statusText}`);
  }
  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

async function downloadFromTwilio(mediaUrl: string): Promise<Buffer> {
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
  const authHeader =
    "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

  const res = await fetchWithTimeoutAndRetry(mediaUrl, {
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

// Export helpers for testing
export { downloadFromTwilio };

export interface VehicleOcrResult {
  make: string | null;
  model: string | null;
  vin: string | null;
  hsn: string | null;
  tsn: string | null;
  year: number | null;
  engineKw: number | null;
  fuelType: string | null;
  emissionClass: string | null;
  rawText: string;
}

async function extractVehicleDataFromImage(imageBuffer: Buffer): Promise<VehicleOcrResult> {
  const base64 = imageBuffer.toString("base64");
  const imageUrl = `data:image/jpeg;base64,${base64}`;

  const systemPrompt =
    "You are an expert OCR and data extractor for German vehicle registration documents (Zulassungsbescheinigung Teil I, old Fahrzeugschein). " +
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
    const resp = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      temperature: 0
    });

    const content = resp.choices[0]?.message?.content ?? "";
    const parsed = safeParseVehicleJson(content);
    return parsed;
  } catch (err: any) {
    logger.error("OpenAI Vision OCR failed", { error: err?.message });
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

// Export OCR extractor for unit tests to mock behavior
export { extractVehicleDataFromImage };

function safeParseVehicleJson(text: string): VehicleOcrResult {
  const empty: VehicleOcrResult = {
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

  if (!text) return empty;

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
  } catch {
    return empty;
  }
}

export interface VehicleInfoPatch {
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  hsn?: string;
  tsn?: string;
  engineKw?: number;
  fuelType?: string;
}

export type Intent = "ASK_PART" | "GIVE_VEHICLE_DATA" | "SMALLTALK" | "OTHER";

export interface NlpResult {
  intent: Intent;
  requestedPart: string | null;
  vehiclePatch: VehicleInfoPatch;
  clarificationQuestion: string | null;
}

export async function understandUserText(
  text: string,
  currentVehicle: VehicleOcrResult,
  currentOrder: { requestedPart?: string | null }
): Promise<NlpResult> {
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
    const resp = await client.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0
    });
    const content = resp.choices[0]?.message?.content ?? "";
    return safeParseNlpJson(content);
  } catch (err: any) {
    logger.error("OpenAI text understanding failed", { error: err?.message });
    return {
      intent: "OTHER",
      requestedPart: null,
      vehiclePatch: {},
      clarificationQuestion: null
    };
  }
}

function safeParseNlpJson(text: string): NlpResult {
  const empty: NlpResult = {
    intent: "OTHER",
    requestedPart: null,
    vehiclePatch: {},
    clarificationQuestion: null
  };
  if (!text) return empty;
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
  } catch {
    return empty;
  }
}

function determineMissingVehicleFields(vehicle: any): string[] {
  const missing: string[] = [];
  if (!vehicle?.make) missing.push("make");
  if (!vehicle?.model) missing.push("model");
  if (!vehicle?.year) missing.push("year");
  const hasVin = !!vehicle?.vin;
  const hasHsnTsn = !!vehicle?.hsn && !!vehicle?.tsn;
  const hasPower = !!vehicle?.engine || !!vehicle?.engineKw;
  if (!hasVin && !hasHsnTsn && !hasPower) {
    missing.push("vin_or_hsn_tsn_or_engine");
  }
  return missing;
}

function isVehicleSufficientForOem(vehicle: any): boolean {
  if (!vehicle) return false;
  const hasBasics = !!vehicle.make && !!vehicle.model && !!vehicle.year;
  const hasId = !!vehicle.vin || (!!vehicle.hsn && !!vehicle.tsn);
  const hasPower = vehicle.engine || vehicle.engineKw;
  return hasBasics && (hasId || hasPower);
}

// ------------------------------
// Schritt 1: Nutzertext analysieren (NLU via OpenAI)
// ------------------------------
export async function parseUserMessage(text: string): Promise<ParsedUserMessage> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    const sanitized = sanitizeText(text);
    const resp = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: TEXT_NLU_PROMPT },
        { role: "user", content: sanitized }
      ],
      temperature: 0
    });

    const rawText = resp.choices[0]?.message?.content ?? "";
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

    const result: ParsedUserMessage = {
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
  } catch (error: any) {
    logger.error("parseUserMessage failed", { error: error?.message, text });

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

// ------------------------------
// Hauptlogik – zustandsbasierter Flow
// ------------------------------
export interface BotMessagePayload {
  from: string;
  text: string;
  orderId?: string | null;
  mediaUrls?: string[];
}

// In-memory per-sender lock to reduce race conditions on concurrent messages.
const conversationLocks = new Map<string, Promise<void>>();

async function withConversationLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = conversationLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((res) => {
    release = res;
  });
  conversationLocks.set(key, prev.then(() => current));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (conversationLocks.get(key) === current) {
      conversationLocks.delete(key);
    }
  }
}

// Helper: detect explicit language choice in the language selection step
function pickLanguageFromChoice(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes("1") || t.includes("deutsch")) return "de";
  if (t.includes("2") || t.includes("english")) return "en";
  if (t.includes("3") || t.includes("türk")) return "tr";
  if (t.includes("4") || t.includes("kurdi")) return "ku";
  if (t.includes("5") || t.includes("polsk")) return "pl";
  return null;
}

function extractVinHsnTsn(text: string): { vin?: string; hsn?: string; tsn?: string } {
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
function hasVehicleHints(text: string): boolean {
  const t = text.toLowerCase();
  const brands = ["bmw", "audi", "vw", "volkswagen", "mercedes", "benz", "ford", "opel", "skoda", "seat", "toyota", "honda", "hyundai", "kia"];
  const yearPattern = /\b(19|20)\d{2}\b/;
  return brands.some((b) => t.includes(b)) || yearPattern.test(t);
}

// Sanitizes free text to avoid control chars and overly long inputs.
function sanitizeText(input: string, maxLen = 500): string {
  if (!input) return "";
  const trimmed = input.trim().slice(0, maxLen);
  return trimmed.replace(/[\u0000-\u001F\u007F]/g, " ");
}

type MessageIntent = "new_order" | "status_question" | "unknown";
function detectIntent(text: string, hasVehicleImage: boolean): MessageIntent {
  if (hasVehicleImage) return "new_order";
  const t = text.toLowerCase();
  const statusKeywords = [
    "liefer", "zustellung", "wann", "abholung", "abholen", "zahlen", "zahlung",
    "vorkasse", "status", "wo bleibt", "retoure", "liefertermin", "tracking", "order", "bestellung"
  ];
  if (statusKeywords.some((k) => t.includes(k))) return "status_question";
  return "unknown";
}

function shortOrderLabel(o: { id: string; vehicle_description?: string | null; part_description?: string | null }) {
  const idShort = o.id.slice(0, 8);
  const vehicle = o.vehicle_description || o.part_description || "Anfrage";
  return `${idShort} (${vehicle.slice(0, 40)})`;
}

// ------------------------------
// Hauptlogik – zustandsbasierter Flow
// ------------------------------
export async function handleIncomingBotMessage(
  payload: BotMessagePayload
): Promise<{
  reply: string;
  orderId: string;
  mediaUrl?: string;
  buttons?: string[];
  contentSid?: string;
  contentVariables?: string;
}> {
  return withConversationLock(payload.from, async () => {
    const userText = sanitizeText(payload.text || "", 1000);
    const hasVehicleImage = Array.isArray(payload.mediaUrls) && payload.mediaUrls.length > 0;
    const vehicleImageNote =
      hasVehicleImage && payload.mediaUrls
        ? payload.mediaUrls.map((url, idx) => `[REGISTRATION_IMAGE_${idx + 1}]: ${url}`).join("\n")
        : null;

    // Intent + mögliche offene Orders vor dem Erstellen ermitteln
    const intent: MessageIntent = detectIntent(userText, hasVehicleImage);
    let activeOrders: any[] = [];
    if (typeof listActiveOrdersByContact === "function") {
      try {
        activeOrders = await listActiveOrdersByContact(payload.from);
      } catch (err) {
        activeOrders = [];
      }
    } else {
      activeOrders = [];
    }

    // Falls Frage und mehrere offene Tickets → Auswahl erfragen
    if (intent === "status_question" && activeOrders.length > 1 && !payload.orderId) {
      const options = activeOrders.slice(0, 3).map(shortOrderLabel).join(" | ");
      return {
        reply:
          "Zu welcher Anfrage hast du die Frage? Bitte nenn die Ticket-ID.\nOptionen: " +
          options,
        orderId: activeOrders[0].id
      };
    }

    // Ziel-Order bestimmen
    let forceNewOrder = false;
    if (intent === "new_order") {
      // neue Bestellung erzwingen, wenn Bild oder klar neuer Kontext
      forceNewOrder = hasVehicleImage || !activeOrders.length;
    }

    // Wenn wir bewusst neu anlegen wollen, nicht automatisch die letzte offene Order wählen
    let orderForFlowId: string | undefined = payload.orderId ?? (forceNewOrder ? undefined : activeOrders[0]?.id);

    // Order laden oder erstellen
    const order = await getSupa().findOrCreateOrder(payload.from, orderForFlowId ?? null, { forceNew: forceNewOrder });
    // Load Merchant Settings
    const merchantId = process.env.MERCHANT_ID || "merchant-1";
    const merchantSettings = await getSupa().getMerchantSettings(merchantId);
    const supportedLangs = merchantSettings?.supportedLanguages || ["de", "en"];

    let language: string | null = order.language ?? null;
    let languageChanged = false;

    // Only accept explicit language choice (1 / 2 / de / en). Do NOT auto-persist language based on free text
    // to avoid incorrect auto-detections that break the flow.
    if (!language) {
      const detectedLang = detectLanguageSelection(userText); // explicit choices only
      if (detectedLang) {
        language = detectedLang;
        languageChanged = true;
        try {
          await updateOrder(order.id, { language });
          logger.info("Language detected and stored", { orderId: order.id, language });
        } catch (err: any) {
          logger.error("Failed to persist detected language", { error: err?.message, orderId: order.id });
        }
      }
    }
    let nextStatus: ConversationStatus = order.status || "choose_language";
    let vehicleDescription = order.vehicle_description;
    let partDescription = order.part_description;
    // Lade vorhandenes order_data, um kumulativ zu arbeiten
    let orderData: any = {};
    try {
      const fullOrder = await getOrderById(order.id);
      orderData = fullOrder?.orderData || {};
    } catch (err: any) {
      logger.error("Failed to fetch order_data", { error: err?.message, orderId: order.id });
    }

    // Nachricht loggen (best effort)
    try {
      // Compatibility adjustment for InvenTreeAdapter which expects (waId, content, direction)
      const msgDir = "IN";
      await (insertMessage as any)(payload.from, userText, msgDir);
    } catch (err: any) {
      logger.error("Failed to log incoming message", { error: err?.message, orderId: order.id });
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
    } catch (e) {
      // If abuse check fails for any reason, continue normally.
      logger.warn("Abuse detection failed", { error: (e as any)?.message });
    }

    // If user sent an image, try OCR first so orchestrator can use it
    let ocrResult: any = null;
    if (hasVehicleImage && Array.isArray(payload.mediaUrls) && payload.mediaUrls.length > 0) {
      try {
        const buf = await downloadFromTwilio(payload.mediaUrls[0]);
        ocrResult = await extractVehicleDataFromImage(buf);
        logger.info("Pre-OCR result for orchestrator", { orderId: order.id, ocr: ocrResult });
      } catch (err: any) {
        logger.warn("Pre-OCR failed (orchestrator will continue without OCR)", { error: err?.message, orderId: order.id });
        ocrResult = null;
      }
    }

    // Call AI orchestrator as primary decision maker. If it fails, fallback to legacy NLU.
    let parsed: ParsedUserMessage = { intent: "unknown" };
    const statesForOrchestrator: ConversationStatus[] = ["choose_language", "collect_vehicle", "collect_part"];
    if (statesForOrchestrator.includes(order.status as any)) {
      try {
        const orchestratorPayload = {
          sender: payload.from,
          orderId: order.id,
          conversation: {
            status: order.status,
            language: order.language,
            orderData: orderData,
            lastBotMessage: null
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
              const docHint =
                order.language === "en"
                  ? "The best way is to send me a photo of your vehicle registration document. Alternatively: brand, model, year and VIN or HSN/TSN."
                  : "Schick mir am besten zuerst ein Foto deines Fahrzeugscheins. Falls nicht möglich: Marke, Modell, Baujahr und VIN oder HSN/TSN.";
              reply = reply ? `${reply} ${docHint}` : docHint;
            }
            return { reply, orderId: order.id };
          }

          // Merge offered slots into order_data
          const slotsToStore: Record<string, any> = {};
          for (const [k, v] of Object.entries(orch.slots || {})) {
            if (v !== undefined && v !== null && v !== "") slotsToStore[k] = v;
          }
          if (Object.keys(slotsToStore).length > 0) {
            try {
              await updateOrderData(order.id, slotsToStore);
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
            } catch (err: any) {
              logger.warn("Failed to persist orchestrator slots", { error: err?.message, orderId: order.id });
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

          const partCandidate =
            orch.slots.requestedPart ??
            orch.slots.part ??
            orderData?.requestedPart ??
            orderData?.partText ??
            (userText && userText.length > 0 ? userText : null);

          if (statesForOrchestrator.includes(order.status as any) && isVehicleSufficientForOem(vehicleCandidate) && partCandidate) {
            if (!orderData?.vehicleConfirmed) {
              const summary = `${vehicleCandidate.make} ${vehicleCandidate.model} (${vehicleCandidate.year})`;
              const reply = language === "en"
                ? `I've identified your vehicle as ${summary}. Is this correct?`
                : `Ich habe dein Fahrzeug als ${summary} identifiziert. Ist das korrekt?`;
              await updateOrder(order.id, { status: "confirm_vehicle" });
              return { reply, orderId: order.id, nextStatus: "confirm_vehicle" };
            }
          }

          if (orch.action === "ask_slot") {
            if (isVehicleSufficientForOem(vehicleCandidate) && partCandidate) {
              const oemFlow = await runOemLookupAndScraping(
                order.id,
                language ?? "de",
                {
                  intent: "request_part",
                  normalizedPartName: partCandidate,
                  userPartText: partCandidate,
                  isAutoPart: true
                } as ParsedUserMessage,
                orderData,
                partCandidate,
                vehicleCandidate
              );
              return { reply: oemFlow.replyText, orderId: order.id };
            }

            return { reply: orch.reply || "", orderId: order.id };
          }

          if (orch.action === "oem_lookup") {
            // build parsed minimal object and vehicleOverride
            const vehicleOverride = {
              make: orch.slots.make ?? orch.slots.brand ?? undefined,
              model: orch.slots.model ?? undefined,
              year: orch.slots.year ?? undefined,
              engine: orch.slots.engine ?? undefined,
              vin: orch.slots.vin ?? undefined,
              hsn: orch.slots.hsn ?? undefined,
              tsn: orch.slots.tsn ?? undefined
            };

            const minimalParsed: ParsedUserMessage = {
              intent: "request_part",
              normalizedPartName: orch.slots.requestedPart ?? orch.slots.part ?? null,
              userPartText: orch.slots.requestedPart ?? orch.slots.part ?? null,
              isAutoPart: true,
              partCategory: orch.slots.partCategory ?? null,
              position: orch.slots.position ?? null,
              positionNeeded: Boolean(orch.slots.position)
            };

            const oemFlow = await runOemLookupAndScraping(
              order.id,
              order.language ?? "de",
              minimalParsed,
              orderData,
              orch.slots.requestedPart ?? null,
              vehicleOverride
            );

            return { reply: oemFlow.replyText, orderId: order.id };
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
            } as ParsedUserMessage;
          }
        }
      } catch (err: any) {
        logger.error("Orchestrator flow failed, falling back to legacy NLU", { error: err?.message });
        try {
          parsed = await parseUserMessage(userText);
        } catch (err2: any) {
          logger.error("parseUserMessage failed in fallback", { error: err2?.message });
        }
      }
    } else {
      // For confirm_vehicle and other non-orchestrated states, use simple legacy parsing
      try {
        parsed = await parseUserMessage(userText);
      } catch (e) { }
    }

    // requestedPart aus Usertext merken und persistieren
    const requestedPart = parsed.part?.trim();
    if (requestedPart) {
      try {
        await updateOrderData(order.id, { requestedPart });
        orderData = { ...orderData, requestedPart };
      } catch (err: any) {
        logger.error("Failed to persist requestedPart", { error: err?.message, orderId: order.id });
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
        if (status === "done") statusReply += "It should be on its way or ready for pickup!";
        else if (status === "ready") statusReply += `It is currently being processed. Estimated delivery: ${delivery} days.`;
        else statusReply += "We are currently looking for the best price for you.";
      } else {
        statusReply = `Ich habe nachgesehen (Ticket ${order.id}). Status: ${status}. `;
        if (status === "done") statusReply += "Deine Bestellung ist abgeschlossen und sollte bald bei dir sein!";
        else if (status === "ready") statusReply += `Wir bearbeiten deine Bestellung. Geschätzte Lieferzeit: ${delivery} Tage.`;
        else statusReply += "Wir suchen gerade noch nach dem besten Angebot für dich.";
      }
      return { reply: statusReply, orderId: order.id };
    }

    // Allgemeine Fragen (General QA)
    if (parsed.intent === "general_question") {
      const currentVehicle = await getVehicleForOrder(order.id);
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
            await updateOrder(order.id, { language });
          } catch (err: any) {
            logger.error("Failed to persist chosen language", { error: err?.message, orderId: order.id });
          }
          nextStatus = "collect_vehicle";
          // We will generate the reply below
        } else {
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
            const buffers: Buffer[] = [];
            for (const url of payload.mediaUrls ?? []) {
              try {
                const buf = await downloadFromTwilio(url);
                buffers.push(buf);
                anyBufferDownloaded = true;
              } catch (err: any) {
                logger.error("Failed to download vehicle image", { error: err?.message, orderId: order.id });
              }
            }

            if (buffers.length > 0) {
              const ocr = await extractVehicleDataFromImage(buffers[0]);
              logger.info("Vehicle OCR result", { orderId: order.id, ocr });
              ocrSucceeded = true;

              // Read current DB vehicle so we can continue even if upsert fails
              let dbVehicle: any = null;
              try {
                dbVehicle = await getSupa().getVehicleForOrder(order.id);
              } catch (err: any) {
                logger.warn("Failed to read existing vehicle before upsert", { error: err?.message, orderId: order.id });
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
              } catch (upsertErr: any) {
                // If DB schema doesn't contain some columns, don't fail the whole flow — we'll continue using OCR result
                logger.error("Vehicle OCR failed to persist (but will continue using OCR data)", {
                  error: upsertErr?.message,
                  orderId: order.id
                });
              }

              try {
                await updateOrderData(order.id, {
                  vehicleOcrRawText: ocr.rawText ?? "",
                  vehicleEngineKw: ocr.engineKw ?? null,
                  vehicleFuelType: ocr.fuelType ?? null,
                  vehicleEmissionClass: ocr.emissionClass ?? null
                });
              } catch (err: any) {
                logger.error("Failed to store vehicle OCR raw text", { error: err?.message, orderId: order.id });
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
              const partTextFromOrderAfterOcr =
                orderData?.partText || orderData?.requestedPart || partDescription || parsed.part || null;

              if (missingFieldsAfterOcr.length === 0 && partTextFromOrderAfterOcr) {
                const oemFlow = await runOemLookupAndScraping(
                  order.id,
                  language ?? "de",
                  { ...parsed, part: partTextFromOrderAfterOcr },
                  orderData,
                  partDescription ?? null,
                  // pass combined vehicle so resolveOEM can continue even if DB was not updated
                  combinedVehicle
                );
                replyText = oemFlow.replyText;
                nextStatus = oemFlow.nextStatus;

                // Persist immediate state change and return early so the response uses OCR-driven decision
                try {
                  await updateOrder(order.id, {
                    status: nextStatus,
                    language,
                    vehicle_description: vehicleDescription || null,
                    part_description: partDescription ?? null
                  });
                } catch (uErr: any) {
                  logger.warn("Failed to persist order state after OCR-driven OEM flow", {
                    orderId: order.id,
                    error: uErr?.message ?? uErr
                  });
                }

                return { reply: replyText, orderId: order.id };
              } else if (missingFieldsAfterOcr.length === 0) {
                nextStatus = "collect_part";
                replyText =
                  language === "en"
                    ? "Got the vehicle document. Which part do you need? Please include position (front/rear, left/right) and any symptoms."
                    : "Fahrzeugschein verarbeitet. Welches Teil brauchst du? Bitte Position (vorne/hinten, links/rechts) und Symptome nennen.";
              } else {
                // gezielte Rückfrage
                const field = missingFieldsAfterOcr[0];
                if (field === "vin_or_hsn_tsn") {
                  replyText =
                    language === "en"
                      ? "I couldn’t read VIN or HSN/TSN. Please send those numbers or a clearer photo."
                      : "Ich konnte VIN oder HSN/TSN nicht sicher erkennen. Bitte schick mir die Nummern oder ein schärferes Foto.";
                } else if (field === "make") {
                  replyText = language === "en" ? "Which car brand is it?" : "Welche Automarke ist es?";
                } else if (field === "model") {
                  replyText = language === "en" ? "Which exact model is it?" : "Welches Modell genau?";
                } else {
                  replyText =
                    language === "en"
                      ? "Please share VIN or HSN/TSN, or at least make/model/year, so I can identify your car."
                      : "Bitte nenne mir VIN oder HSN/TSN oder mindestens Marke/Modell/Baujahr, damit ich dein Auto identifizieren kann.";
                }
                nextStatus = "collect_vehicle";
              }
            }
          } catch (err: any) {
            logger.error("Vehicle OCR failed", { error: err?.message, orderId: order.id });
          }

          if (!anyBufferDownloaded) {
            replyText =
              language === "en"
                ? "I couldn’t load your registration photo. Please type your make, model, year, and VIN/HSN/TSN."
                : "Ich konnte dein Fahrzeugschein-Foto nicht laden. Bitte schreib mir Marke, Modell, Baujahr und VIN/HSN/TSN.";
            nextStatus = "collect_vehicle";
            break;
          }

          // Nach OCR prüfen, ob genug Daten für OEM vorhanden sind
          const vehicle = await getVehicleForOrder(order.id);
          const missingFields = determineMissingVehicleFields(vehicle);
          const partTextFromOrder =
            orderData?.partText ||
            orderData?.requestedPart ||
            partDescription ||
            parsed.part ||
            null;

          if (missingFields.length === 0 && partTextFromOrder) {
            const oemFlow = await runOemLookupAndScraping(
              order.id,
              language ?? "de",
              { ...parsed, part: partTextFromOrder },
              orderData,
              partDescription ?? null
            );
            replyText = oemFlow.replyText;
            nextStatus = oemFlow.nextStatus;
          } else if (missingFields.length === 0) {
            nextStatus = "collect_part";
            replyText =
              language === "en"
                ? "Got the vehicle document. Which part do you need? Please include position (front/rear, left/right) and any symptoms."
                : "Fahrzeugschein verarbeitet. Welches Teil brauchst du? Bitte Position (vorne/hinten, links/rechts) und Symptome nennen.";
          } else {
            // gezielte Rückfrage
            const field = missingFields[0];
            if (field === "vin_or_hsn_tsn") {
              replyText =
                language === "en"
                  ? "I couldn’t read VIN or HSN/TSN. Please send those numbers or a clearer photo."
                  : "Ich konnte VIN oder HSN/TSN nicht sicher erkennen. Bitte schick mir die Nummern oder ein schärferes Foto.";
            } else if (field === "make") {
              replyText = language === "en" ? "Which car brand is it?" : "Welche Automarke ist es?";
            } else if (field === "model") {
              replyText = language === "en" ? "Which exact model is it?" : "Welches Modell genau?";
            } else {
              replyText =
                language === "en"
                  ? "Please share VIN or HSN/TSN, or at least make/model/year, so I can identify your car."
                  : "Bitte nenne mir VIN oder HSN/TSN oder mindestens Marke/Modell/Baujahr, damit ich dein Auto identifizieren kann.";
            }
            nextStatus = "collect_vehicle";
          }

          break;
        }

        // Fahrzeugdaten speichern (kumulativ)
        logger.info("Vehicle partial from parsed message", {
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
        const vehicle = await getVehicleForOrder(order.id);
        logger.info("Vehicle after upsert", { orderId: order.id, vehicle });
        const missingVehicleFields = determineRequiredFields({
          make: vehicle?.make,
          model: vehicle?.model,
          year: vehicle?.year,
          engine: (vehicle as any)?.engineCode ?? (vehicle as any)?.engine ?? (vehicle as any)?.engineKw,
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
              : "Bitte nenne mir VIN oder HSN/TSN oder mindestens Marke/Modell/Baujahr, damit ich dein Auto identifizieren kann.");
          nextStatus = "collect_vehicle";
        } else {
          const summary = `${vehicle?.make} ${vehicle?.model} (${vehicle?.year})`;
          replyText = language === "en"
            ? `I've identified your vehicle as ${summary}. Is this correct?`
            : `Ich habe dein Fahrzeug als ${summary} identifiziert. Ist das korrekt?`;
          nextStatus = "confirm_vehicle";
        }
        break;
      }

      case "confirm_vehicle": {
        const isYes = userText.toLowerCase().match(/^(ja|yes|jo|jup|correct|korrekt|stimmt|y)$/);
        if (isYes) {
          try {
            await updateOrderData(order.id, { vehicleConfirmed: true });
            orderData = { ...orderData, vehicleConfirmed: true };
          } catch (err) {
            logger.error("Failed to store vehicle confirmation", { orderId: order.id });
          }

          const partName = orderData?.requestedPart || orderData?.partText;
          if (partName) {
            const vehicleForBrain = await getVehicleForOrder(order.id);
            const oemFlow = await runOemLookupAndScraping(
              order.id,
              language ?? "de",
              { intent: "request_part", normalizedPartName: partName, userPartText: partName } as any,
              orderData,
              partName,
              vehicleForBrain
            );
            replyText = oemFlow.replyText;
            nextStatus = oemFlow.nextStatus;
          } else {
            replyText = language === "en"
              ? "Great! Which part do you need? Please include position and symptoms."
              : "Super! Welches Teil brauchst du? Bitte nenne mir auch die Position und eventuelle Symptome.";
            nextStatus = "collect_part";
          }
        } else {
          // User says no or provided different info
          replyText = language === "en"
            ? "Oh, I'm sorry. Please send me a photo of your registration or the correct VIN so I can identify the right car."
            : "Oh, das tut mir leid. Bitte schick mir ein Foto vom Fahrzeugschein oder die korrekte VIN, damit ich das richtige Auto finde.";
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
          await updateOrderData(order.id, {
            partCategory: mergedPartInfo.partCategory ?? null,
            partPosition: mergedPartInfo.partPosition ?? null,
            partDetails: mergedPartInfo.partDetails ?? {},
            partText: mergedPartInfo.partText ?? null,
            requestedPart: mergedPartInfo.partText ?? orderData?.requestedPart ?? null
          });
          orderData = { ...orderData, ...mergedPartInfo };
        } catch (err: any) {
          logger.error("Failed to update order_data with part info", { error: err?.message, orderId: order.id });
        }

        const vehicleForBrain = await getVehicleForOrder(order.id);
        const brain = await runCollectPartBrain({
          userText,
          parsed,
          order,
          orderData: { ...orderData, vehicle: vehicleForBrain ?? undefined },
          language: language ?? "de",
          lastQuestionType: orderData?.lastQuestionType ?? null
        });

        replyText = brain.replyText;
        nextStatus = brain.nextStatus as ConversationStatus;

        // track last question type for simple repeat-avoidance
        let lastQuestionType: string | null = null;
        if (brain.slotsToAsk?.includes("part_name")) lastQuestionType = "ask_part_name";
        else if (brain.slotsToAsk?.includes("position")) lastQuestionType = "ask_position";
        else lastQuestionType = null;

        try {
          await updateOrderData(order.id, {
            lastQuestionType
          });
          orderData = { ...orderData, lastQuestionType };
        } catch (err: any) {
          logger.error("Failed to store lastQuestionType", { error: err?.message, orderId: order.id });
        }

        // Wenn wir genug haben, OEM-Flow starten
        if (brain.nextStatus === "oem_lookup") {
          const partText =
            parsed.normalizedPartName ||
            mergedPartInfo.partText ||
            orderData?.requestedPart ||
            (partDescription || "").trim() ||
            (language === "en" ? "the part you mentioned" : "das genannte Teil");

          logger.info("Conversation state", {
            orderId: order.id,
            prevStatus: order.status,
            nextStatus: "oem_lookup",
            language
          });
          const oemFlow = await runOemLookupAndScraping(
            order.id,
            language ?? "de",
            { ...parsed, part: partText },
            orderData,
            partDescription ?? null
          );
          replyText = oemFlow.replyText;
          nextStatus = oemFlow.nextStatus;
        }
        break;
      }

      case "oem_lookup": {
        const oemFlow = await runOemLookupAndScraping(
          order.id,
          language ?? "de",
          parsed,
          orderData,
          partDescription ?? null
        );
        replyText = oemFlow.replyText;
        nextStatus = oemFlow.nextStatus;
        break;
      }

      case "show_offers": {
        try {
          const offers = await listShopOffersByOrderId(order.id);
          const sorted = (offers ?? []).slice().sort((a: any, b: any) => {
            const pa = a.price ?? Number.POSITIVE_INFINITY;
            const pb = b.price ?? Number.POSITIVE_INFINITY;
            return pa - pb;
          });

          logger.info("Show offers", { orderId: order.id, offersCount: sorted.length });
          if (!sorted || sorted.length === 0) {
            replyText =
              language === "en"
                ? "I’m still collecting offers for you. You’ll get a selection shortly."
                : "Ich suche noch passende Angebote. Du bekommst gleich eine Auswahl.";
            nextStatus = "show_offers";
            break;
          }

          if (sorted.length === 1) {
            const offer = sorted[0] as any;
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
              await updateOrderData(order.id, {
                selectedOfferCandidateId: offer.id
              });
              orderData = { ...orderData, selectedOfferCandidateId: offer.id };
            } catch (err: any) {
              logger.error("Failed to store selectedOfferCandidateId", { error: err?.message, orderId: order.id });
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
          const lines =
            language === "en"
              ? top.map(
                (o: any, idx: number) => {
                  const isInStock = o.shopName === "Händler-Lager" || o.shopName === "Eigener Bestand";
                  const deliveryInfo = isInStock ? "📦 Sofort" : `🚚 ${o.deliveryTimeDays ?? "n/a"} days`;
                  return `*${idx + 1}.* 🏷️ ${o.brand ?? "n/a"}\n` +
                    `   💰 ${calculateEndPrice(o.price)} ${o.currency} | ${deliveryInfo}`;
                }
              )
              : top.map(
                (o: any, idx: number) => {
                  const isInStock = o.shopName === "Händler-Lager" || o.shopName === "Eigener Bestand";
                  const deliveryInfo = isInStock ? "📦 Sofort" : `🚚 ${o.deliveryTimeDays ?? "k.A."} Tage`;
                  return `*${idx + 1}.* 🏷️ ${o.brand ?? "k.A."}\n` +
                    `   💰 ${calculateEndPrice(o.price)} ${o.currency} | ${deliveryInfo}`;
                }
              );

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
            await updateOrderData(order.id, {
              offerChoiceIds: top.map((o: any) => o.id)
            });
            orderData = { ...orderData, offerChoiceIds: top.map((o: any) => o.id) };
          } catch (err: any) {
            logger.error("Failed to store offerChoiceIds", { error: err?.message, orderId: order.id });
          }

          nextStatus = "await_offer_choice";
          return {
            reply: replyText,
            orderId: order.id,
            mediaUrl: top[0]?.imageUrl ?? undefined
          };
        } catch (err: any) {
          logger.error("Fetching offers failed", { error: err?.message, orderId: order.id });
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
        let choiceIndex: number | null = null;
        if (t.includes("1")) choiceIndex = 0;
        else if (t.includes("2")) choiceIndex = 1;
        else if (t.includes("3")) choiceIndex = 2;
        logger.info("User offer choice message", { orderId: order.id, text: userText });

        const choiceIds: string[] | undefined = orderData?.offerChoiceIds;
        if (choiceIndex === null || !choiceIds || choiceIndex < 0 || choiceIndex >= choiceIds.length) {
          replyText =
            language === "en"
              ? 'Please reply with 1, 2 or 3 to pick one of the offers.'
              : 'Bitte antworte mit 1, 2 oder 3, um ein Angebot auszuwählen.';
          nextStatus = "await_offer_choice";
          break;
        }

        const chosenOfferId = choiceIds[choiceIndex];
        const offers = await listShopOffersByOrderId(order.id);
        const chosen = offers.find((o: any) => o.id === chosenOfferId);
        if (!chosen) {
          replyText =
            language === "en"
              ? "I couldn’t match your choice. I’ll show the offers again."
              : "Ich konnte deine Auswahl nicht zuordnen. Ich zeige dir die Angebote gleich erneut.";
          nextStatus = "show_offers";
          break;
        }

        try {
          await updateOrderData(order.id, {
            selectedOfferId: chosen.id,
            selectedOfferSummary: {
              shopName: chosen.shopName,
              brand: chosen.brand,
              price: calculateEndPrice(chosen.price),
              currency: chosen.currency,
              deliveryTimeDays: chosen.deliveryTimeDays
            }
          });
          await updateOrderStatus(order.id, "ready");
        } catch (err: any) {
          logger.error("Failed to store selected offer", { error: err?.message, orderId: order.id, chosenOfferId });
        }

        logger.info("User selected offer", {
          orderId: order.id,
          choiceIndex,
          chosenOfferId: chosen.id,
          chosenShop: chosen.shopName,
          price: chosen.price
        });
        replyText =
          language === "en"
            ? `Thank you! Your order (${order.id}) has been saved with the offer from ${chosen.shopName} (${chosen.brand ?? "n/a"}, ${calculateEndPrice(chosen.price)} ${chosen.currency}). This is now a binding agreement. Your dealer will contact you soon.`
            : `Vielen Dank! Deine Bestellung (${order.id}) wurde mit dem Angebot von ${chosen.shopName} (${chosen.brand ?? "k.A."}, ${calculateEndPrice(chosen.price)} ${chosen.currency}) gespeichert. Dies ist nun eine verbindliche Bestellung. Dein Händler wird dich bald kontaktieren.`;
        nextStatus = "done";
        break;
      }

      case "await_offer_confirmation": {
        const t = (userText || "").trim().toLowerCase();
        const isYes = ["ja", "okay", "ok", "passt", "yes", "yep", "okey"].some((w) => t.includes(w));
        const isNo = ["nein", "no", "nicht", "anders"].some((w) => t.includes(w));
        const candidateId = orderData?.selectedOfferCandidateId as string | undefined;
        logger.info("User offer confirmation", {
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
              : 'Wenn das Angebot für dich passt, antworte bitte mit "Ja" oder "OK". Wenn nicht, sag mir kurz, was dir wichtig ist (z.B. Preis, Marke oder Lieferzeit).';
          nextStatus = "await_offer_confirmation";
          break;
        }

        if (isNo) {
          replyText =
            language === "en"
              ? "Got it, I’ll see if I can find alternative offers. Tell me what matters most: price, brand or delivery time."
              : "Alles klar, ich schaue, ob ich dir noch andere Angebote finden kann. Sag mir gerne, was dir wichtiger ist: Preis, Marke oder Lieferzeit.";
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

        const offers = await listShopOffersByOrderId(order.id);
        const chosen = offers.find((o: any) => o.id === candidateId);
        if (!chosen) {
          replyText =
            language === "en"
              ? "I couldn’t find that offer anymore. I’ll show available offers again."
              : "Ich konnte dieses Angebot nicht mehr finden. Ich zeige dir die verfügbaren Angebote erneut.";
          nextStatus = "show_offers";
          break;
        }

        try {
          await updateOrderData(order.id, {
            selectedOfferId: chosen.id,
            selectedOfferSummary: {
              shopName: chosen.shopName,
              brand: chosen.brand,
              price: calculateEndPrice(chosen.price, merchantSettings?.marginPercent),
              currency: chosen.currency,
              deliveryTimeDays: chosen.deliveryTimeDays
            }
          });
          await updateOrderStatus(order.id, "ready");

          if (merchantSettings?.allowDirectDelivery) {
            replyText = language === "en"
              ? "Great! Do you want the part delivered to your home (D) or do you want to pick it up at the dealer (P)?"
              : "Super! Möchtest du das Teil nach Hause geliefert bekommen (D) oder holst du es beim Händler ab (P)?";
            nextStatus = "collect_delivery_preference";
          } else {
            const dealerLoc = merchantSettings?.dealerAddress || "unseren Standort";
            replyText = language === "en"
              ? `Perfect! I've reserved the part. You can pick it up at: ${dealerLoc}.`
              : `Perfekt! Ich habe das Teil reserviert. Du kannst es hier abholen: ${dealerLoc}.`;
            nextStatus = "done";
          }
        } catch (err: any) {
          logger.error("Failed to store confirmed offer", { error: err?.message, orderId: order.id, candidateId });
        }

        logger.info("Offer selection stored", {
          orderId: order.id,
          selectedOfferId: chosen.id,
          statusUpdatedTo: "ready"
        });
        replyText =
          language === "en"
            ? `Perfect, I’ve saved this offer for you. Your order (${order.id}) is now binding. Your dealer will contact you soon.`
            : `Perfekt, ich habe dieses Angebot für dich gespeichert. Deine Bestellung (${order.id}) ist nun verbindlich. Dein Händler wird dich bald kontaktieren.`;
        nextStatus = "done";
        break;
      }

      case "done": {
        replyText =
          language === "en"
            ? "Do you want to start a new request for another vehicle or part?"
            : "Möchtest du eine neue Anfrage für ein weiteres Fahrzeug oder Teil starten?";
        nextStatus = "choose_language";
        language = null;
        break;
      }

      case "collect_delivery_preference": {
        const choice = userText.toLowerCase();
        if (choice.includes("d") || choice.includes("liefer")) {
          replyText = language === "en"
            ? "Excellent choice. Please send me your full delivery address."
            : "Sehr gute Wahl. Bitte sende mir nun deine vollständige Lieferadresse.";
          nextStatus = "collect_address";
        } else if (choice.includes("p") || choice.includes("abhol")) {
          const dealerLoc = merchantSettings?.dealerAddress || "unseren Standort";
          replyText = language === "en"
            ? `Perfect! You can pick up the part at: ${dealerLoc}. See you soon!`
            : `Perfekt! Du kannst das Teil hier abholen: ${dealerLoc}. Bis bald!`;
          nextStatus = "done";
        } else {
          replyText = language === "en"
            ? "Please decide: Delivery (D) or Pickup (P)?"
            : "Bitte entscheide dich: Lieferung (D) oder Abholung (P)?";
        }
        break;
      }

      case "collect_address": {
        if (userText.length > 10) {
          try {
            await getSupa().saveDeliveryAddress(order.id, userText);
          } catch (err) {
            logger.error("Failed to save delivery address", { orderId: order.id, error: err });
          }
          replyText = language === "en"
            ? "Thank you! Your delivery address has been saved. We will ship the part shortly."
            : "Vielen Dank! Deine Lieferadresse wurde gespeichert. Wir versenden das Teil in Kürze.";
          nextStatus = "done";
        } else {
          replyText = language === "en"
            ? "Please provide a valid delivery address."
            : "Bitte gib eine gültige Lieferadresse an.";
        }
        break;
      }

      case "done": {
        // Fallback for when the user keeps writing after completion
        replyText = language === "en"
          ? "Your order is complete. If you have further questions, just ask!"
          : "Deine Bestellung ist abgeschlossen. Wenn du weitere Fragen hast, frag einfach!";

        // Premium: Use Content API for success message if we have a SID
        return {
          reply: replyText,
          orderId: order.id,
          contentSid: 'HXb5b62575e6e4ff6129ad7c8efe1f983e', // Example Provided by User
          contentVariables: JSON.stringify({ "1": order.id, "2": "Bestellung abgeschlossen" })
        };
      }

      default: {
        // Unerwarteter Zustand: sauber neustarten
        nextStatus = "choose_language";
        language = null;
        replyText =
          "Es ist ein interner Fehler im Status aufgetreten. Lass uns neu starten: Bitte wähle deine Sprache (1-5).\nThere was an internal state error. Let’s restart: please choose your language (1-5).";
      }
    }

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
      await updateOrder(order.id, {
        status: nextStatus,
        language,
        vehicle_description: vehicleDescToSave || null,
        part_description: partDescription ?? null
      });
    } catch (err: any) {
      logger.error("Failed to update order in handleIncomingBotMessage", {
        error: err?.message,
        orderId: order.id
      });
    }


    return { reply: replyText, orderId: order.id };
  });
}

// End of file: ensure top-level block is closed



