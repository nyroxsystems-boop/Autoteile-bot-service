"use strict";
// =================================================================
// Bot Logic Service — Main orchestrator for the WhatsApp Bot.
// Helper functions are in: nluService.ts, vehicleOcrService.ts, botHelpers.ts
// =================================================================
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOemWithAi = exports.shortOrderLabel = exports.runCollectPartBrain = exports.answerGeneralQuestion = exports.calculateEstimatedDeliveryRange = exports.calculateEndPrice = exports.mergePartInfo = exports.hasSufficientPartInfo = exports.detectNoVehicleDocument = exports.partRequiredFields = exports.buildPartFollowUpQuestion = exports.buildVehicleFollowUpQuestion = exports.needsVehicleDocumentHint = exports.buildSmalltalkReply = exports.callOrchestrator = exports.isVehicleSufficientForOem = exports.determineMissingVehicleFields = exports.understandUserText = exports.safeParseVehicleJson = exports.extractVehicleDataFromImage = exports.downloadFromTwilio = exports.downloadImageBuffer = exports.pickLanguageFromChoice = exports.parseUserMessage = exports.detectIntent = exports.hasVehicleHints = exports.extractVinHsnTsn = exports.sanitizeText = exports.detectAbusive = exports.detectSmalltalk = exports.detectLanguageFromText = exports.detectLanguageSelection = void 0;
exports.handleIncomingBotMessage = handleIncomingBotMessage;
const supabaseService_1 = require("@adapters/supabaseService");
const oemRequiredFieldsService_1 = require("../intelligence/oemRequiredFieldsService");
const oemService = __importStar(require("@intelligence/oemService"));
const logger_1 = require("@utils/logger");
const scrapingService_1 = require("../scraping/scrapingService");
const geminiService_1 = require("../intelligence/geminiService");
const vehicleGuard_1 = require("../intelligence/vehicleGuard");
const botResponses_1 = require("./botResponses");
const featureFlags_1 = require("./featureFlags");
const phoneMerchantMapper_1 = require("../adapters/phoneMerchantMapper");
const lockService_1 = require("./lockService");
// Lazy accessor so tests can mock `supabaseService` after this module was loaded.
function getSupa() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("../adapters/supabaseService");
}
// =================================================================
// RE-EXPORTS from extracted modules (backwards compatibility)
// =================================================================
var nluService_1 = require("./nluService");
Object.defineProperty(exports, "detectLanguageSelection", { enumerable: true, get: function () { return nluService_1.detectLanguageSelection; } });
Object.defineProperty(exports, "detectLanguageFromText", { enumerable: true, get: function () { return nluService_1.detectLanguageFromText; } });
Object.defineProperty(exports, "detectSmalltalk", { enumerable: true, get: function () { return nluService_1.detectSmalltalk; } });
Object.defineProperty(exports, "detectAbusive", { enumerable: true, get: function () { return nluService_1.detectAbusive; } });
Object.defineProperty(exports, "sanitizeText", { enumerable: true, get: function () { return nluService_1.sanitizeText; } });
Object.defineProperty(exports, "extractVinHsnTsn", { enumerable: true, get: function () { return nluService_1.extractVinHsnTsn; } });
Object.defineProperty(exports, "hasVehicleHints", { enumerable: true, get: function () { return nluService_1.hasVehicleHints; } });
Object.defineProperty(exports, "detectIntent", { enumerable: true, get: function () { return nluService_1.detectIntent; } });
Object.defineProperty(exports, "parseUserMessage", { enumerable: true, get: function () { return nluService_1.parseUserMessage; } });
Object.defineProperty(exports, "pickLanguageFromChoice", { enumerable: true, get: function () { return nluService_1.pickLanguageFromChoice; } });
var vehicleOcrService_1 = require("./vehicleOcrService");
Object.defineProperty(exports, "downloadImageBuffer", { enumerable: true, get: function () { return vehicleOcrService_1.downloadImageBuffer; } });
Object.defineProperty(exports, "downloadFromTwilio", { enumerable: true, get: function () { return vehicleOcrService_1.downloadFromTwilio; } });
Object.defineProperty(exports, "extractVehicleDataFromImage", { enumerable: true, get: function () { return vehicleOcrService_1.extractVehicleDataFromImage; } });
Object.defineProperty(exports, "safeParseVehicleJson", { enumerable: true, get: function () { return vehicleOcrService_1.safeParseVehicleJson; } });
Object.defineProperty(exports, "understandUserText", { enumerable: true, get: function () { return vehicleOcrService_1.understandUserText; } });
Object.defineProperty(exports, "determineMissingVehicleFields", { enumerable: true, get: function () { return vehicleOcrService_1.determineMissingVehicleFields; } });
Object.defineProperty(exports, "isVehicleSufficientForOem", { enumerable: true, get: function () { return vehicleOcrService_1.isVehicleSufficientForOem; } });
var botHelpers_1 = require("./botHelpers");
Object.defineProperty(exports, "callOrchestrator", { enumerable: true, get: function () { return botHelpers_1.callOrchestrator; } });
Object.defineProperty(exports, "buildSmalltalkReply", { enumerable: true, get: function () { return botHelpers_1.buildSmalltalkReply; } });
Object.defineProperty(exports, "needsVehicleDocumentHint", { enumerable: true, get: function () { return botHelpers_1.needsVehicleDocumentHint; } });
Object.defineProperty(exports, "buildVehicleFollowUpQuestion", { enumerable: true, get: function () { return botHelpers_1.buildVehicleFollowUpQuestion; } });
Object.defineProperty(exports, "buildPartFollowUpQuestion", { enumerable: true, get: function () { return botHelpers_1.buildPartFollowUpQuestion; } });
Object.defineProperty(exports, "partRequiredFields", { enumerable: true, get: function () { return botHelpers_1.partRequiredFields; } });
Object.defineProperty(exports, "detectNoVehicleDocument", { enumerable: true, get: function () { return botHelpers_1.detectNoVehicleDocument; } });
Object.defineProperty(exports, "hasSufficientPartInfo", { enumerable: true, get: function () { return botHelpers_1.hasSufficientPartInfo; } });
Object.defineProperty(exports, "mergePartInfo", { enumerable: true, get: function () { return botHelpers_1.mergePartInfo; } });
Object.defineProperty(exports, "calculateEndPrice", { enumerable: true, get: function () { return botHelpers_1.calculateEndPrice; } });
Object.defineProperty(exports, "calculateEstimatedDeliveryRange", { enumerable: true, get: function () { return botHelpers_1.calculateEstimatedDeliveryRange; } });
Object.defineProperty(exports, "answerGeneralQuestion", { enumerable: true, get: function () { return botHelpers_1.answerGeneralQuestion; } });
Object.defineProperty(exports, "runCollectPartBrain", { enumerable: true, get: function () { return botHelpers_1.runCollectPartBrain; } });
Object.defineProperty(exports, "shortOrderLabel", { enumerable: true, get: function () { return botHelpers_1.shortOrderLabel; } });
Object.defineProperty(exports, "verifyOemWithAi", { enumerable: true, get: function () { return botHelpers_1.verifyOemWithAi; } });
// Local imports for use in this file
const nluService_2 = require("./nluService");
const vehicleOcrService_2 = require("./vehicleOcrService");
const botHelpers_2 = require("./botHelpers");
// =================================================================
// OEM Lookup Handler (kept inline — deeply coupled to DB operations)
// =================================================================
async function runOemLookupAndScraping(orderId, language, parsed, orderData, partDescription, vehicleOverride) {
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
        const q = (0, botHelpers_2.buildVehicleFollowUpQuestion)(missingVehicleFields, language ?? "de");
        return { replyText: q || (0, botResponses_1.t)('vehicle_need_more', language), nextStatus: "collect_vehicle" };
    }
    const partText = parsed.part || orderData?.requestedPart || orderData?.partText || partDescription || (0, botResponses_1.t)('part_mentioned', language);
    try {
        let oemResult;
        if (typeof oemService.resolveOEMForOrder === "function") {
            oemResult = await oemService.resolveOEMForOrder(orderId, {
                make: vehicleForOem.make ?? null, model: vehicleForOem.model ?? null,
                year: vehicleForOem.year ?? null, engine: vehicleForOem.engine ?? null,
                engineKw: vehicle?.engineKw ?? null, vin: vehicleForOem.vin ?? null,
                hsn: vehicleForOem.hsn ?? null, tsn: vehicleForOem.tsn ?? null
            }, partText);
        }
        else if (typeof oemService.resolveOEM === "function") {
            try {
                const legacy = await oemService.resolveOEM({
                    make: vehicleForOem.make, model: vehicleForOem.model, year: vehicleForOem.year,
                    engine: vehicleForOem.engine, engineKw: vehicle?.engineKw,
                    vin: vehicleForOem.vin, hsn: vehicleForOem.hsn, tsn: vehicleForOem.tsn
                }, partText);
                oemResult = {
                    primaryOEM: legacy.oemNumber ?? (legacy.oem ?? undefined),
                    overallConfidence: legacy.success ? 0.85 : 0,
                    candidates: legacy.oemData?.candidates ?? [],
                    notes: legacy.message ?? undefined
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
                oemNumber: oemResult.primaryOEM ?? null, oemConfidence: oemResult.overallConfidence ?? null,
                oemNotes: oemResult.notes ?? null, oemCandidates: oemResult.candidates ?? [],
                oemTecdocPartsouq: oemResult.tecdocPartsouqResult ?? null
            });
            try {
                await (0, supabaseService_1.updateOrderOEM)(orderId, {
                    oemStatus: oemResult.primaryOEM ? "resolved" : "not_found",
                    oemError: oemResult.primaryOEM ? null : oemResult.notes ?? null,
                    oemData: oemResult, oemNumber: oemResult.primaryOEM ?? null
                });
            }
            catch (err) {
                logger_1.logger.warn("Failed to persist OEM fields", { orderId, error: err?.message });
            }
        }
        catch (err) {
            logger_1.logger.warn("Failed to persist OEM resolver output", { orderId, error: err?.message });
        }
        if (oemResult.variantDetected && oemResult.variantQuestion && oemResult.variants?.length) {
            logger_1.logger.info('[OEMLookup] Variants detected', { orderId, variantCount: oemResult.variants.length });
            try {
                await (0, supabaseService_1.updateOrderData)(orderId, { pendingVariants: oemResult.variants, oemCandidates: oemResult.candidates ?? [] });
            }
            catch (err) {
                logger_1.logger.warn('Failed to persist variant data', { orderId, error: err?.message });
            }
            return { replyText: oemResult.variantQuestion, nextStatus: "awaiting_variant_selection" };
        }
        if (oemResult.primaryOEM && oemResult.overallConfidence >= 0.7) {
            const cautious = oemResult.overallConfidence < 0.9;
            try {
                const scrapeResult = await (0, scrapingService_1.scrapeOffersForOrder)(orderId, oemResult.primaryOEM);
                try {
                    const scrapeData = { scrapeStatus: (scrapeResult && scrapeResult.jobId) ? "started" : ((scrapeResult && scrapeResult.ok) ? "done" : "unknown"), scrapeResult: scrapeResult ?? null };
                    if (scrapeResult?.jobId)
                        scrapeData.scrapeTaskId = scrapeResult.jobId;
                    if (typeof supabaseService_1.persistScrapeResult === "function")
                        await (0, supabaseService_1.persistScrapeResult)(orderId, scrapeData);
                    else if (typeof supabaseService_1.updateOrderScrapeTask === "function")
                        await (0, supabaseService_1.updateOrderScrapeTask)(orderId, scrapeData);
                }
                catch (uErr) {
                    logger_1.logger.warn("Failed to persist scrape", { orderId, error: uErr?.message });
                }
                const cautionNote = cautious ? (0, botResponses_1.t)('caution_check', language) : "";
                return { replyText: `${(0, botResponses_1.t)('oem_product_found', language)}${cautionNote}`, nextStatus: "show_offers" };
            }
            catch (err) {
                logger_1.logger.error("Scrape after OEM failed", { error: err?.message, orderId });
                return { replyText: (0, botResponses_1.t)('oem_scrape_failed', language), nextStatus: "needs_human" };
            }
        }
        return { replyText: (0, botResponses_1.t)('oem_product_uncertain', language), nextStatus: "needs_human" };
    }
    catch (err) {
        logger_1.logger.error("resolveOEM failed", { error: err?.message, orderId });
        return { replyText: (0, botResponses_1.t)('oem_retry_prompt', language), nextStatus: "oem_lookup" };
    }
}
async function handleIncomingBotMessage(payload, sendInterimReply) {
    return (0, lockService_1.withConversationLock)(payload.from, async () => {
        const userText = (0, nluService_2.sanitizeText)(payload.text || "", 1000);
        const hasVehicleImage = Array.isArray(payload.mediaUrls) && payload.mediaUrls.length > 0;
        const vehicleImageNote = hasVehicleImage && payload.mediaUrls
            ? payload.mediaUrls.map((url, idx) => `[REGISTRATION_IMAGE_${idx + 1}]: ${url}`).join("\n")
            : null;
        // Intent + mögliche offene Orders vor dem Erstellen ermitteln
        const intentResult = (0, nluService_2.detectIntent)(userText, hasVehicleImage);
        const intent = intentResult.intent;
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
            const options = activeOrders.slice(0, 3).map(botHelpers_2.shortOrderLabel).join(" | ");
            return {
                reply: "Zu welcher Anfrage haben Sie die Frage? Bitte nennen Sie die Ticket-ID.\nOptionen: " +
                    options,
                orderId: activeOrders[0].id
            };
        }
        // #7 FIX: Handle oem_direct intent — pro users paste OEM numbers directly
        if (intent === "oem_direct") {
            const extractedOem = intentResult.extractedOem || null;
            if (extractedOem) {
                const order = await getSupa().findOrCreateOrder(payload.from);
                const language = order.language || 'de';
                logger_1.logger.info("[BotLogic] OEM direct input detected", { oem: extractedOem, orderId: order.id });
                // Send interim "searching..." message
                if (sendInterimReply) {
                    await sendInterimReply((0, botResponses_1.t)('oem_searching', language));
                }
                // Store OEM on order and skip to scraping
                await (0, supabaseService_1.updateOrderData)(order.id, { oem: extractedOem, directOemInput: true });
                try {
                    const { scrapeOffersForOrder } = await Promise.resolve().then(() => __importStar(require('../scraping/scrapingService')));
                    const scrapeResult = await scrapeOffersForOrder(order.id, extractedOem);
                    if (scrapeResult && scrapeResult.length > 0) {
                        await (0, supabaseService_1.updateOrder)(order.id, { status: "show_offers" });
                        return {
                            reply: (0, botResponses_1.tWith)('oem_direct_found', language, { oem: extractedOem, count: String(scrapeResult.length) }),
                            orderId: order.id
                        };
                    }
                    else {
                        return {
                            reply: (0, botResponses_1.t)('no_offers', language),
                            orderId: order.id
                        };
                    }
                }
                catch (err) {
                    logger_1.logger.error("[BotLogic] OEM direct scraping failed", { error: err?.message, oem: extractedOem });
                    return {
                        reply: (0, botResponses_1.tWith)('oem_direct_scrape_error', language, { oem: extractedOem }),
                        orderId: order.id
                    };
                }
            }
        }
        // NEW: Handle abort_order intent - user wants to cancel current order
        if (intent === "abort_order" && activeOrders.length > 0) {
            // FIX: If multiple orders, ask which one to cancel
            if (activeOrders.length > 1) {
                const lang = activeOrders[0].language || "de";
                const options = activeOrders.slice(0, 5).map((o, i) => `*${i + 1}.* ${(0, botHelpers_2.shortOrderLabel)(o)}`).join("\n");
                return {
                    reply: (0, botResponses_1.tWith)('cancel_which_order', lang, { options }),
                    orderId: activeOrders[0].id
                };
            }
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
                reply: (0, botResponses_1.t)('cancel_confirmed', lang),
                orderId: orderToCancel.id
            };
        }
        // BACK COMMAND: Let user go back one step
        const backKeywords = ["zurück", "back", "geri", "paş", "wstecz", "nochmal", "restart", "neu anfangen"];
        const isBackCommand = backKeywords.some(k => userText.toLowerCase().includes(k));
        if (isBackCommand && activeOrders.length > 0) {
            const currentOrder = activeOrders[0];
            const currentStatus = currentOrder.status;
            const backMap = {
                "confirm_vehicle": "collect_vehicle",
                "collect_part": "collect_vehicle",
                "oem_lookup": "collect_part",
                "show_offers": "collect_part",
                "await_offer_choice": "show_offers",
                "await_offer_confirmation": "show_offers",
                "collect_delivery_preference": "show_offers",
                "collect_address": "collect_delivery_preference",
            };
            const prevStatus = backMap[currentStatus];
            if (prevStatus) {
                try {
                    await (0, supabaseService_1.updateOrder)(currentOrder.id, { status: prevStatus });
                }
                catch (err) {
                    logger_1.logger.error("Failed to go back", { orderId: currentOrder.id, error: err?.message });
                }
                const lang = currentOrder.language || "de";
                return {
                    reply: (0, botResponses_1.t)('back_command', lang),
                    orderId: currentOrder.id
                };
            }
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
        // FIX: Multi-order routing — if >1 active orders and no explicit orderId, ask user
        if (activeOrders.length > 1 && !payload.orderId && intent !== "new_order" && intent !== "status_question" && intent !== "abort_order" && intent !== "continue_order" && intent !== "oem_direct") {
            const lang = activeOrders[0].language || "de";
            const options = activeOrders.slice(0, 5).map((o, i) => `*${i + 1}.* ${(0, botHelpers_2.shortOrderLabel)(o)}`).join("\n");
            return {
                reply: (0, botResponses_1.tWith)('multi_order_ask', lang, { count: String(activeOrders.length), options }),
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
            const detectedLang = (0, nluService_2.detectLanguageSelection)(userText); // explicit choices only
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
            if ((0, nluService_2.detectAbusive)(userText)) {
                const reply = (0, botResponses_1.t)('abuse_warning', language);
                return { reply, orderId: order.id };
            }
        }
        catch (e) {
            // If abuse check fails for any reason, continue normally.
            logger_1.logger.warn("Abuse detection failed", { error: e?.message });
        }
        // =====================================================================
        // 🖼️ IMAGE FLOW: Classify first, then route appropriately
        // vehicle_document → OCR → vehicle data enrichment
        // part_photo       → extract OEM from label → direct answer
        // unknown          → skip OCR (no waste)
        // =====================================================================
        let ocrResult = null;
        let ocrFailed = false;
        let partLabelOem = null;
        if (hasVehicleImage && Array.isArray(payload.mediaUrls) && payload.mediaUrls.length > 0) {
            try {
                // Step 1: Classify the image (cheap Gemini Flash call ~$0.001)
                const { classifyImage } = await Promise.resolve().then(() => __importStar(require('../intelligence/imageClassifier')));
                const classification = await classifyImage(payload.mediaUrls[0]);
                logger_1.logger.info('[ImageFlow] Classification result', {
                    type: classification.classification,
                    confidence: classification.confidence,
                    orderId: order.id,
                });
                const buf = await (0, vehicleOcrService_2.downloadFromTwilio)(payload.mediaUrls[0]);
                switch (classification.classification) {
                    case 'vehicle_document': {
                        // Route 1: Fahrzeugschein → existing OCR pipeline
                        ocrResult = await (0, vehicleOcrService_2.extractVehicleDataFromImage)(buf);
                        logger_1.logger.info('[ImageFlow] Vehicle document OCR complete', { orderId: order.id, ocr: ocrResult });
                        const hasData = ocrResult && (ocrResult.make || ocrResult.model || ocrResult.vin || ocrResult.hsn);
                        if (!hasData) {
                            ocrFailed = true;
                            logger_1.logger.warn('[ImageFlow] OCR returned empty result', { orderId: order.id });
                        }
                        break;
                    }
                    case 'part_photo': {
                        // Route 2: Part label/Teileetikett → extract OEM directly from photo
                        try {
                            const base64 = buf.toString('base64');
                            const extractPrompt = `Dieses Bild zeigt ein Autoteil oder eine Teileverpackung.
Extrahiere die OEM/OE-Nummer (Originalteilenummer des Herstellers).
Suche nach:
- Aufdrucken auf dem Teil selbst
- Etiketten auf der Verpackung
- Stanzungen/Gravuren auf Metallteilen

Antworte NUR mit JSON: {"oem": "NUMMER", "description": "Was ist das Teil?", "confidence": 0.0-1.0}
Wenn keine OEM-Nummer erkennbar: {"oem": null, "description": "...", "confidence": 0}`;
                            const visionResult = await (0, geminiService_1.generateVisionCompletion)({ prompt: extractPrompt, imageBase64: base64 });
                            const parsed = JSON.parse(visionResult.replace(/```json/g, '').replace(/```/g, '').trim());
                            if (parsed.oem && parsed.confidence > 0.5) {
                                partLabelOem = parsed.oem.replace(/[\s.-]/g, '').toUpperCase();
                                logger_1.logger.info('[ImageFlow] Part label OEM extracted', {
                                    oem: partLabelOem,
                                    description: parsed.description,
                                    confidence: parsed.confidence,
                                    orderId: order.id,
                                });
                                // Direct fast-path: return the OEM from the label immediately
                                const lang = language || 'de';
                                const reply = lang === 'en'
                                    ? `📸 I found an OEM number on the photo:\n\n*${partLabelOem}*\n${parsed.description ? `\n_${parsed.description}_` : ''}\n\nWould you like me to search for offers for this part?`
                                    : `📸 Ich habe eine OEM-Nummer auf dem Foto gefunden:\n\n*${partLabelOem}*\n${parsed.description ? `\n_${parsed.description}_` : ''}\n\nSoll ich nach Angeboten für dieses Teil suchen?`;
                                // Store the OEM on the order
                                await (0, supabaseService_1.updateOrderData)(order.id, { oem: partLabelOem, partLabelExtracted: true });
                                return { reply, orderId: order.id };
                            }
                        }
                        catch (labelErr) {
                            logger_1.logger.warn('[ImageFlow] Part label extraction failed', { error: labelErr?.message });
                        }
                        // If extraction failed, fall through to normal flow
                        break;
                    }
                    default: {
                        // Route 3: Unknown image (selfie, screenshot, etc.) → skip OCR
                        logger_1.logger.info('[ImageFlow] Non-automotive image, skipping OCR', { orderId: order.id });
                        const lang = language || 'de';
                        const skipReply = lang === 'en'
                            ? '📷 I received the photo but couldn\'t identify an automotive document or part. Could you send a photo of your vehicle registration (Fahrzeugschein) or the part label?'
                            : '📷 Ich habe das Foto erhalten, konnte aber kein Fahrzeugdokument oder Autoteil erkennen. Könnten Sie ein Foto vom Fahrzeugschein oder dem Teileetikett senden?';
                        return { reply: skipReply, orderId: order.id };
                    }
                }
            }
            catch (err) {
                logger_1.logger.warn('[ImageFlow] Image processing failed', { error: err?.message, orderId: order.id });
                ocrResult = null;
                ocrFailed = true;
            }
            // M1 FIX: Tell the user when OCR can't read their photo
            if (ocrFailed) {
                const ocrErrorMsg = (0, botResponses_1.t)('ocr_failed', language);
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
                const orch = await (0, botHelpers_2.callOrchestrator)(orchestratorPayload);
                if (orch) {
                    // Handle simple orchestrator actions directly
                    if (orch.action === "abusive") {
                        const reply = orch.reply || (0, botResponses_1.t)('abuse_warning', order.language ?? 'de');
                        return { reply, orderId: order.id };
                    }
                    if (orch.action === "smalltalk") {
                        // do not change state, just reply
                        let reply = orch.reply || "";
                        if ((0, botHelpers_2.needsVehicleDocumentHint)(order)) {
                            const docHint = (0, botResponses_1.t)('doc_hint', order.language);
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
                    if (statesForOrchestrator.includes(order.status) && (0, vehicleOcrService_2.isVehicleSufficientForOem)(vehicleCandidate) && partCandidate) {
                        if (!orderData?.vehicleConfirmed) {
                            const summary = `${vehicleCandidate.make} ${vehicleCandidate.model} (${vehicleCandidate.year})`;
                            const reply = (0, botResponses_1.tWith)('vehicle_confirm', language, { summary });
                            await (0, supabaseService_1.updateOrder)(order.id, { status: "confirm_vehicle" });
                            return { reply, orderId: order.id, nextStatus: "confirm_vehicle" };
                        }
                    }
                    if (orch.action === "ask_slot") {
                        if ((0, vehicleOcrService_2.isVehicleSufficientForOem)(vehicleCandidate) && partCandidate) {
                            // #3 FIX: REMOVED conv-intelligence doppelcall here.
                            // The orchestrator already decided ask_slot with sufficient data.
                            // Proceed directly to OEM lookup — saves ~300ms + AI costs.
                            // #1 FIX: Send Zwischennachricht before OEM lookup
                            if (sendInterimReply) {
                                await sendInterimReply((0, botResponses_1.t)('oem_searching', order.language));
                            }
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
                        // #1 FIX: Send Zwischennachricht BEFORE OEM lookup via callback
                        if (sendInterimReply) {
                            await sendInterimReply((0, botResponses_1.t)('oem_searching', order.language));
                        }
                        // M2 FIX: 30s timeout for entire OEM resolution
                        const OEM_TIMEOUT_MS = 30000;
                        try {
                            const oemFlow = await Promise.race([
                                runOemLookupAndScraping(order.id, order.language ?? "de", minimalParsed, orderData, orch.slots.requestedPart ?? null, vehicleOverride),
                                new Promise((_, reject) => setTimeout(() => reject(new Error('OEM_TIMEOUT')), OEM_TIMEOUT_MS))
                            ]);
                            return { reply: oemFlow.replyText, orderId: order.id };
                        }
                        catch (err) {
                            if (err.message === 'OEM_TIMEOUT') {
                                logger_1.logger.warn('[BotLogic] OEM resolution timed out after 30s', { orderId: order.id });
                                return { reply: (0, botResponses_1.t)('oem_timeout', order.language), orderId: order.id };
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
                    parsed = await (0, nluService_2.parseUserMessage)(userText);
                }
                catch (err2) {
                    logger_1.logger.error("parseUserMessage failed in fallback", { error: err2?.message });
                }
            }
        }
        else {
            // For confirm_vehicle and other non-orchestrated states, use simple legacy parsing
            try {
                parsed = await (0, nluService_2.parseUserMessage)(userText);
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
            const statusReply = (0, botResponses_1.tWith)('status_header', language, { orderId: order.id, status }) +
                (status === "done" ? (0, botResponses_1.t)('status_done', language) :
                    status === "ready" ? (0, botResponses_1.tWith)('status_ready', language, { delivery }) :
                        (0, botResponses_1.t)('status_searching', language));
            return { reply: statusReply, orderId: order.id };
        }
        // Allgemeine Fragen (General QA)
        if (parsed.intent === "general_question") {
            const currentVehicle = await (0, supabaseService_1.getVehicleForOrder)(order.id);
            const knownVehicleSummary = JSON.stringify(currentVehicle ?? {});
            const lang = language ?? "de";
            const reply = await (0, botHelpers_2.answerGeneralQuestion)({
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
        const stateMachineStates = [
            'choose_language', 'collect_vehicle', 'confirm_vehicle', 'collect_part',
            'oem_lookup', 'show_offers', 'await_offer_choice', 'await_offer_confirmation',
            'collect_delivery_preference', 'collect_address', 'done'
        ];
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
            // AUDIT FIX: Log when state machine was active but produced no reply
            if ((0, featureFlags_1.isEnabled)(featureFlags_1.FF.USE_STATE_MACHINE, { userId: payload.from }) && stateMachineStates.includes(nextStatus)) {
                logger_1.logger.warn("[SILENT FALLBACK] State machine active but produced empty reply — legacy switch taking over", {
                    status: nextStatus,
                    orderId: order.id,
                    from: payload.from
                });
            }
            switch (nextStatus) {
                case "choose_language": {
                    // Wenn bereits Sprache gesetzt ist, nicht erneut fragen
                    if (language && supportedLangs.includes(language)) {
                        nextStatus = "collect_vehicle";
                        // We will generate the greeting below
                        break;
                    }
                    const chosen = (0, nluService_2.pickLanguageFromChoice)(userText); // require explicit choice
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
                        // AUDIT FIX: Reuse OCR from the modern image classification flow
                        // instead of re-downloading and re-processing the same image
                        if (ocrResult) {
                            anyBufferDownloaded = true;
                            ocrSucceeded = true;
                            logger_1.logger.info("[collect_vehicle] Reusing OCR from image flow", { orderId: order.id });
                        }
                        try {
                            const buffers = [];
                            for (const url of payload.mediaUrls ?? []) {
                                try {
                                    const buf = await (0, vehicleOcrService_2.downloadFromTwilio)(url);
                                    buffers.push(buf);
                                    anyBufferDownloaded = true;
                                }
                                catch (err) {
                                    logger_1.logger.error("Failed to download vehicle image", { error: err?.message, orderId: order.id });
                                }
                            }
                            if (buffers.length > 0) {
                                const ocr = ocrResult || await (0, vehicleOcrService_2.extractVehicleDataFromImage)(buffers[0]);
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
                                const missingFieldsAfterOcr = (0, vehicleOcrService_2.determineMissingVehicleFields)(combinedVehicle);
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
                                        (0, botResponses_1.t)('ocr_success', language);
                                }
                                else {
                                    // gezielte Rückfrage
                                    const field = missingFieldsAfterOcr[0];
                                    if (field === "vin_or_hsn_tsn") {
                                        replyText = (0, botResponses_1.t)('ocr_vin_missing', language);
                                    }
                                    else if (field === "make") {
                                        replyText = (0, botResponses_1.t)('ask_brand', language);
                                    }
                                    else if (field === "model") {
                                        replyText = (0, botResponses_1.t)('ask_model', language);
                                    }
                                    else {
                                        replyText = (0, botResponses_1.t)('ask_vin_general', language);
                                    }
                                    nextStatus = "collect_vehicle";
                                }
                            }
                        }
                        catch (err) {
                            logger_1.logger.error("Vehicle OCR failed", { error: err?.message, orderId: order.id });
                        }
                        if (!anyBufferDownloaded) {
                            replyText = (0, botResponses_1.t)('ocr_photo_failed', language);
                            nextStatus = "collect_vehicle";
                            break;
                        }
                        // Nach OCR prüfen, ob genug Daten für OEM vorhanden sind
                        const vehicle = await (0, supabaseService_1.getVehicleForOrder)(order.id);
                        const missingFields = (0, vehicleOcrService_2.determineMissingVehicleFields)(vehicle);
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
                                (0, botResponses_1.t)('ocr_success', language);
                        }
                        else {
                            // gezielte Rückfrage
                            const field = missingFields[0];
                            if (field === "vin_or_hsn_tsn") {
                                replyText = (0, botResponses_1.t)('ocr_vin_missing', language);
                            }
                            else if (field === "make") {
                                replyText = (0, botResponses_1.t)('ask_brand', language);
                            }
                            else if (field === "model") {
                                replyText = (0, botResponses_1.t)('ask_model', language);
                            }
                            else {
                                replyText = (0, botResponses_1.t)('ask_vin_general', language);
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
                    const vehicleText = await (0, supabaseService_1.getVehicleForOrder)(order.id);
                    logger_1.logger.info("Vehicle after upsert", { orderId: order.id, vehicle: vehicleText });
                    const missingVehicleFields = (0, oemRequiredFieldsService_1.determineRequiredFields)({
                        make: vehicleText?.make,
                        model: vehicleText?.model,
                        year: vehicleText?.year,
                        engine: vehicleText?.engineCode ?? vehicleText?.engine ?? vehicleText?.engineKw,
                        vin: vehicleText?.vin,
                        hsn: vehicleText?.hsn,
                        tsn: vehicleText?.tsn
                    });
                    if (missingVehicleFields.length > 0) {
                        const q = (0, botHelpers_2.buildVehicleFollowUpQuestion)(missingVehicleFields, language ?? "de");
                        replyText =
                            q ||
                                (0, botResponses_1.t)('ask_vin_general', language);
                        nextStatus = "collect_vehicle";
                    }
                    else {
                        const summary = `${vehicleText?.make} ${vehicleText?.model} (${vehicleText?.year})`;
                        replyText = (0, botResponses_1.tWith)('vehicle_confirm', language, { summary });
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
                            replyText = (0, botResponses_1.t)('confirm_vehicle_yes', language);
                            nextStatus = "collect_part";
                        }
                    }
                    else {
                        // User says no or provided different info
                        replyText = (0, botResponses_1.t)('vehicle_correction', language);
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
                    const mergedPartInfo = (0, botHelpers_2.mergePartInfo)(existingPartInfo, parsed);
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
                    const brain = await (0, botHelpers_2.runCollectPartBrain)({
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
                            (0, botResponses_1.t)('part_mentioned', language);
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
                // 🔀 BUG B FIX: Handle customer's variant selection
                case "awaiting_variant_selection": {
                    const pendingVariants = orderData?.pendingVariants;
                    if (!pendingVariants || !Array.isArray(pendingVariants) || pendingVariants.length === 0) {
                        logger_1.logger.warn('[VariantSelection] No pending variants found', { orderId: order.id });
                        replyText = (0, botResponses_1.t)('oem_product_uncertain', language);
                        nextStatus = "needs_human";
                        break;
                    }
                    const selectionText = (parsed.part || parsed.userPartText || userText || '').trim();
                    // Try to parse customer's selection
                    let selectedIndex = -1;
                    // Method 1: Direct number ("1", "2", "3")
                    const numMatch = selectionText.match(/^(\d+)$/);
                    if (numMatch) {
                        selectedIndex = parseInt(numMatch[1], 10) - 1; // 1-indexed → 0-indexed
                    }
                    // Method 2: Number at start of message ("2 bitte", "3 das ist meins")
                    if (selectedIndex < 0) {
                        const startNumMatch = selectionText.match(/^(\d+)\s/);
                        if (startNumMatch) {
                            selectedIndex = parseInt(startNumMatch[1], 10) - 1;
                        }
                    }
                    // Method 3: Try to match description text to a variant
                    if (selectedIndex < 0) {
                        const lowerText = selectionText.toLowerCase();
                        for (let i = 0; i < pendingVariants.length; i++) {
                            const v = pendingVariants[i];
                            const diff = (v.differentiator || '').toLowerCase();
                            const desc = (v.description || '').toLowerCase();
                            if (diff && lowerText.includes(diff)) {
                                selectedIndex = i;
                                break;
                            }
                            if (desc && lowerText.includes(desc)) {
                                selectedIndex = i;
                                break;
                            }
                            // Match OEM number directly if customer types it
                            if (v.oem && lowerText.includes(v.oem.toLowerCase())) {
                                selectedIndex = i;
                                break;
                            }
                        }
                    }
                    // Validate selection
                    if (selectedIndex < 0 || selectedIndex >= pendingVariants.length) {
                        const maxNum = pendingVariants.length;
                        replyText = language === "de"
                            ? `Bitte antworten Sie mit einer Zahl von 1 bis ${maxNum}, um Ihre Variante auszuwählen.`
                            : `Please reply with a number from 1 to ${maxNum} to select your variant.`;
                        nextStatus = "awaiting_variant_selection";
                        break;
                    }
                    const selectedVariant = pendingVariants[selectedIndex];
                    const selectedOem = selectedVariant.oem;
                    logger_1.logger.info('[VariantSelection] Customer selected variant', {
                        orderId: order.id,
                        selectedIndex: selectedIndex + 1,
                        selectedOem,
                        differentiator: selectedVariant.differentiator,
                    });
                    // Persist selected OEM
                    try {
                        await (0, supabaseService_1.updateOrderData)(order.id, {
                            oemNumber: selectedOem,
                            oemConfidence: selectedVariant.confidence,
                            selectedVariant: selectedVariant,
                            pendingVariants: null, // Clear pending
                        });
                        try {
                            await (0, supabaseService_1.updateOrderOEM)(order.id, {
                                oemStatus: "resolved",
                                oemNumber: selectedOem,
                                oemData: { selectedVariant, allVariants: pendingVariants },
                            });
                        }
                        catch (err) {
                            logger_1.logger.warn("Failed to persist selected variant OEM", { orderId: order.id, error: err?.message });
                        }
                    }
                    catch (err) {
                        logger_1.logger.warn("Failed to persist variant selection", { orderId: order.id, error: err?.message });
                    }
                    // Proceed to scrape offers with the selected OEM
                    try {
                        await (0, scrapingService_1.scrapeOffersForOrder)(order.id, selectedOem);
                        const variantLabel = selectedVariant.differentiator || selectedOem;
                        replyText = language === "de"
                            ? `✅ *${variantLabel}* ausgewählt (${selectedOem}).\n\n🔍 Ich suche jetzt die besten Angebote für Sie...`
                            : `✅ *${variantLabel}* selected (${selectedOem}).\n\n🔍 Searching for the best offers for you...`;
                        nextStatus = "show_offers";
                    }
                    catch (err) {
                        logger_1.logger.error("Scrape after variant selection failed", { error: err?.message, orderId: order.id });
                        replyText = (0, botResponses_1.t)('oem_scrape_failed', language);
                        nextStatus = "needs_human";
                    }
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
                            // FIX: Track how many times we've shown "collecting" to avoid infinite loop
                            const collectAttempts = (orderData?.offerCollectAttempts ?? 0) + 1;
                            try {
                                await (0, supabaseService_1.updateOrderData)(order.id, { offerCollectAttempts: collectAttempts });
                            }
                            catch (_) { }
                            if (collectAttempts >= 3) {
                                // After 3 attempts, escalate to human
                                replyText = (0, botResponses_1.t)('offers_escalate', language);
                                nextStatus = "needs_human";
                                break;
                            }
                            replyText = (0, botResponses_1.t)('offer_collecting', language);
                            nextStatus = "show_offers";
                            break;
                        }
                        // Reset counter on success
                        try {
                            await (0, supabaseService_1.updateOrderData)(order.id, { offerCollectAttempts: 0 });
                        }
                        catch (_) { }
                        if (sorted.length === 1) {
                            const offer = sorted[0];
                            const endPrice = (0, botHelpers_2.calculateEndPrice)(offer.price);
                            const delivery = offer.deliveryTimeDays ?? (0, botResponses_1.t)('na_text', language);
                            const bindingNote = (0, botResponses_1.t)('offer_binding_note', language);
                            // Beautiful offer formatting for WhatsApp (NO LINK, NO SHOP NAME for customer)
                            const isInStock = offer.shopName === "Händler-Lager" || offer.shopName === "Eigener Bestand";
                            const stockInfo = isInStock
                                ? (0, botResponses_1.t)('offer_pickup', language)
                                : (0, botResponses_1.tWith)('offer_delivery', language, { delivery });
                            replyText =
                                `${(0, botResponses_1.t)('offer_single_header', language)}\n\n` +
                                    `🏷️ *${(0, botResponses_1.t)('offer_brand_label', language)}:* ${offer.brand ?? (0, botResponses_1.t)('na_text', language)}\n` +
                                    `💰 *${(0, botResponses_1.t)('offer_price_label', language)}:* ${endPrice} ${offer.currency}\n` +
                                    `${stockInfo}\n` +
                                    `${offer.availability && !isInStock ? `📦 *${(0, botResponses_1.t)('offer_stock_label', language)}:* ${offer.availability}\n` : ''}` +
                                    `${bindingNote}\n\n` +
                                    `${(0, botResponses_1.t)('offer_order_prompt', language)}`;
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
                                buttons: [(0, botResponses_1.t)('btn_yes_order', language), (0, botResponses_1.t)('btn_no_others', language)]
                            };
                        }
                        const top = sorted.slice(0, 3);
                        const lines = top.map((o, idx) => {
                            const isInStock = o.shopName === "H\u00e4ndler-Lager" || o.shopName === "Eigener Bestand";
                            const deliveryInfo = isInStock ? (0, botResponses_1.t)('offer_instant', language) : `🚚 ${o.deliveryTimeDays ?? (0, botResponses_1.t)('na_text', language)} ${language === 'de' ? 'Tage' : language === 'en' ? 'days' : language === 'tr' ? 'g\u00fcn' : language === 'pl' ? 'dni' : 'roj'}`;
                            return `*${idx + 1}.* 🏷️ ${o.brand ?? (0, botResponses_1.t)('na_text', language)}\n` +
                                `   💰 ${(0, botHelpers_2.calculateEndPrice)(o.price)} ${o.currency} | ${deliveryInfo}`;
                        });
                        const multiBindingNote = (0, botResponses_1.t)('offer_multi_binding', language);
                        replyText =
                            replyText =
                                (0, botResponses_1.t)('offer_multi_header', language) + "\n\n" +
                                    lines.join("\n\n") +
                                    multiBindingNote +
                                    "\n\n" + (0, botResponses_1.t)('offer_choose_prompt', language);
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
                            (0, botResponses_1.t)('offer_fetch_failed', language);
                        nextStatus = "show_offers";
                        return { reply: replyText, orderId: order.id };
                    }
                    break;
                }
                case "await_offer_choice": {
                    const txt = (userText || "").trim().toLowerCase();
                    let choiceIndex = null;
                    // FIX: Use strict regex to match only standalone numbers, not "320i" etc.
                    const choiceMatch = txt.match(/^\s*([1-3])\s*[\.\)\:]?\s*/);
                    if (choiceMatch) {
                        choiceIndex = parseInt(choiceMatch[1], 10) - 1;
                    }
                    logger_1.logger.info("User offer choice message", { orderId: order.id, text: userText, choiceIndex });
                    const choiceIds = orderData?.offerChoiceIds;
                    if (choiceIndex === null || !choiceIds || choiceIndex < 0 || choiceIndex >= choiceIds.length) {
                        replyText =
                            (0, botResponses_1.t)('offer_choice_invalid', language);
                        nextStatus = "await_offer_choice";
                        break;
                    }
                    const chosenOfferId = choiceIds[choiceIndex];
                    const offers = await (0, supabaseService_1.listShopOffersByOrderId)(order.id);
                    const chosen = offers.find((o) => o.id === chosenOfferId);
                    if (!chosen) {
                        replyText =
                            (0, botResponses_1.t)('offer_choice_not_found', language);
                        nextStatus = "show_offers";
                        break;
                    }
                    try {
                        await (0, supabaseService_1.updateOrderData)(order.id, {
                            selectedOfferId: chosen.id,
                            selectedOfferSummary: {
                                shopName: chosen.shopName,
                                brand: chosen.brand,
                                price: (0, botHelpers_2.calculateEndPrice)(chosen.price),
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
                        (0, botResponses_1.tWith)('offer_confirmed_choice', language, { orderId: order.id });
                    nextStatus = "done";
                    break;
                }
                case "await_offer_confirmation": {
                    const txt = (userText || "").trim().toLowerCase();
                    // FIX: Stricter matching — require word boundaries to avoid false matches
                    const yesWords = ["ja", "okay", "ok", "passt", "yes", "yep", "okey", "bestellen", "verbindlich"];
                    const noWords = ["nein", "no", "nicht", "anders", "cancel", "abbrechen"];
                    const isYes = yesWords.some((w) => {
                        const re = new RegExp(`(^|\\s)${w}($|\\s|[!.,?])`, 'i');
                        return re.test(txt);
                    });
                    const isNo = noWords.some((w) => {
                        const re = new RegExp(`(^|\\s)${w}($|\\s|[!.,?])`, 'i');
                        return re.test(txt);
                    });
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
                            (0, botResponses_1.t)('offer_confirm_prompt', language);
                        nextStatus = "await_offer_confirmation";
                        break;
                    }
                    if (isNo) {
                        replyText =
                            (0, botResponses_1.t)('offer_decline_alt', language);
                        nextStatus = "show_offers";
                        break;
                    }
                    if (!candidateId) {
                        replyText =
                            (0, botResponses_1.t)('offer_lost', language);
                        nextStatus = "show_offers";
                        break;
                    }
                    // FIX: Show binding order confirmation before finalizing
                    if (!orderData?.pendingBindingConfirmation) {
                        try {
                            await (0, supabaseService_1.updateOrderData)(order.id, { pendingBindingConfirmation: true });
                        }
                        catch (_) { }
                        replyText = (0, botResponses_1.t)('binding_order_confirm', language);
                        nextStatus = "await_offer_confirmation";
                        // The next time user says "ja" with pendingBindingConfirmation=true, we'll process it
                        break;
                    }
                    const offers = await (0, supabaseService_1.listShopOffersByOrderId)(order.id);
                    const chosen = offers.find((o) => o.id === candidateId);
                    if (!chosen) {
                        replyText =
                            (0, botResponses_1.t)('offer_not_found', language);
                        nextStatus = "show_offers";
                        break;
                    }
                    try {
                        await (0, supabaseService_1.updateOrderData)(order.id, {
                            selectedOfferId: chosen.id,
                            bindingConfirmed: true,
                            bindingConfirmedAt: new Date().toISOString(),
                            selectedOfferSummary: {
                                shopName: chosen.shopName,
                                brand: chosen.brand,
                                price: (0, botHelpers_2.calculateEndPrice)(chosen.price, merchantSettings?.marginPercent),
                                currency: chosen.currency,
                                deliveryTimeDays: chosen.deliveryTimeDays
                            }
                        });
                        await (0, supabaseService_1.updateOrderStatus)(order.id, "ready");
                        if (merchantSettings?.allowDirectDelivery) {
                            replyText = (0, botResponses_1.t)('delivery_choose_exact', language);
                            nextStatus = "collect_delivery_preference";
                        }
                        else {
                            const dealerLoc = merchantSettings?.dealerAddress || "unseren Standort";
                            replyText = (0, botResponses_1.tWith)('offer_confirmed', language, { orderId: order.id }) + "\n\n" + (0, botResponses_1.tWith)('pickup_location', language, { location: dealerLoc });
                            nextStatus = "done";
                        }
                    }
                    catch (err) {
                        logger_1.logger.error("Failed to store confirmed offer", { error: err?.message, orderId: order.id, candidateId });
                    }
                    logger_1.logger.info("Binding order confirmed", {
                        orderId: order.id,
                        selectedOfferId: chosen.id,
                        statusUpdatedTo: "ready"
                    });
                    break;
                }
                case "collect_delivery_preference": {
                    const choice = userText.trim();
                    // FIX: Use strict number matching (1/2) instead of includes("d") which matches "Danke"
                    const deliveryMatch = choice.match(/^\s*([12])\s*$/);
                    const isDelivery = deliveryMatch?.[1] === "1" || /^(liefer|deliver|teslimat|gihandin|dostaw)/i.test(choice);
                    const isPickup = deliveryMatch?.[1] === "2" || /^(abhol|pickup|teslim al|wergirtin|odbi[oó]r)/i.test(choice);
                    if (isDelivery) {
                        replyText = (0, botResponses_1.t)('address_hint', language);
                        nextStatus = "collect_address";
                    }
                    else if (isPickup) {
                        const dealerLoc = merchantSettings?.dealerAddress || "unseren Standort";
                        replyText = (0, botResponses_1.tWith)('pickup_location', language, { location: dealerLoc });
                        nextStatus = "done";
                    }
                    else {
                        replyText = (0, botResponses_1.t)('delivery_choose_exact', language);
                        nextStatus = "collect_delivery_preference";
                    }
                    break;
                }
                case "collect_address": {
                    // FIX: Require minimum address pattern (something + number/comma) instead of just length
                    const addressText = userText.trim();
                    const hasStreet = /\d/.test(addressText); // must contain at least one number
                    const hasMinLength = addressText.length >= 15; // "Str. 1, 12345 X" = 16 chars
                    const hasCommaOrNewline = /[,\n]/.test(addressText); // must have structure
                    if (hasStreet && hasMinLength && hasCommaOrNewline) {
                        try {
                            await getSupa().saveDeliveryAddress(order.id, addressText);
                        }
                        catch (err) {
                            logger_1.logger.error("Failed to save delivery address", { orderId: order.id, error: err });
                        }
                        replyText = (0, botResponses_1.t)('address_saved', language);
                        nextStatus = "done";
                    }
                    else {
                        replyText = (0, botResponses_1.t)('address_hint', language);
                        nextStatus = "collect_address";
                    }
                    break;
                }
                case "done": {
                    // Context-aware handling: detect what user wants to do next
                    const txt = userText.toLowerCase().trim();
                    // FIX: Check goodbye FIRST to avoid false "new part" detection
                    const goodbyeKeywords = ["danke", "thanks", "thank you", "tschüss", "tschüs", "bye",
                        "super", "perfekt", "toll", "great", "perfect", "alles klar", "passt",
                        "ok", "okay", "gut", "prima", "klasse", "top", "👍", "🙏", "vielen dank",
                        "merci", "teşekkür", "spas", "dziękuję", "dzięki"];
                    const isGoodbye = goodbyeKeywords.some(k => txt.includes(k)) ||
                        txt.length <= 5; // Very short messages in done state are likely acknowledgments
                    // Check if user wants to start completely fresh
                    const freshStartKeywords = ["neues auto", "anderes auto", "anderes fahrzeug",
                        "new car", "different vehicle", "von vorn", "von vorne", "neu starten",
                        "yeni araç", "başka araç", "wesayîtek din", "nowy pojazd", "inny samochód"];
                    const wantsFreshStart = freshStartKeywords.some(k => txt.includes(k));
                    // FIX: Only detect "new part" with EXPLICIT keywords, not "any text > 5 chars"
                    const newPartKeywords = ["brauche auch", "noch ein teil", "außerdem", "dazu noch", "zusätzlich",
                        "another part", "also need", "noch brauche", "ein weiteres", "gleich noch",
                        "başka parça", "perçeyek din", "kolejna część"];
                    const wantsNewPart = newPartKeywords.some(k => txt.includes(k));
                    // Status question even in done state
                    const statusKeywords = ["wo bleibt", "lieferung", "wann kommt", "status",
                        "delivery", "where is", "tracking", "ne zaman", "kengê", "kiedy"];
                    const isStatusQuestion = statusKeywords.some(k => txt.includes(k));
                    if (isGoodbye) {
                        replyText = (0, botResponses_1.t)('goodbye', language);
                        return {
                            reply: replyText,
                            orderId: order.id,
                            contentSid: process.env.TWILIO_GOODBYE_CONTENT_SID || 'HXb5b62575e6e4ff6129ad7c8efe1f983e',
                            contentVariables: JSON.stringify({ "1": order.id, "2": "Bestellung abgeschlossen" })
                        };
                    }
                    else if (wantsFreshStart) {
                        nextStatus = "collect_vehicle";
                        replyText = (0, botResponses_1.t)('fresh_start', language);
                    }
                    else if (isStatusQuestion) {
                        const odata = order.order_data || {};
                        const delivery = odata.selectedOfferSummary?.deliveryTimeDays ?? "n/a";
                        replyText = (0, botResponses_1.tWith)('status_header', language, { orderId: order.id, status: order.status }) +
                            (0, botResponses_1.t)('status_done', language);
                    }
                    else if (wantsNewPart && order.vehicle_description) {
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
                            replyText = (0, botResponses_1.tWith)('follow_up_part', language, { make: orderData?.vehicle?.make || '', model: orderData?.vehicle?.model || '' });
                            return { reply: replyText, orderId: newOrder.id };
                        }
                        catch (err) {
                            logger_1.logger.error("Failed to create follow-up order", { error: err?.message });
                            replyText = (0, botResponses_1.t)('follow_up_fallback', language);
                            nextStatus = "collect_part";
                        }
                    }
                    else {
                        // Default: politely remind order is complete and offer options
                        replyText = (0, botResponses_1.t)('order_complete', language) + "\n\n" + (0, botResponses_1.t)('order_another_part', language);
                    }
                    break;
                }
                default: {
                    // Unerwarteter Zustand: sauber neustarten
                    nextStatus = "choose_language";
                    language = null;
                    replyText =
                        "Es ist ein interner Fehler im Status aufgetreten. Bitte beginnen wir neu: Wählen Sie Ihre Sprache (1-5).\nThere was an internal state error. Let’s restart: please choose your language (1-5).";
                }
            } // END switch
        } // END if (!replyText) - state machine fallback wrapper
        // Fallback, falls keine Antwort gesetzt wurde
        if (!replyText) {
            replyText = (0, botResponses_1.t)('global_fallback', language);
        }
        const vehicleDescToSave = hasVehicleImage
            ? vehicleDescription
                ? `${vehicleDescription} \n${vehicleImageNote ?? ""} `
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
