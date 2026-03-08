// =================================================================
// Bot Logic Service — Main orchestrator for the WhatsApp Bot.
// Helper functions are in: nluService.ts, vehicleOcrService.ts, botHelpers.ts
// =================================================================

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
  listActiveOrdersByContact,
  insertShopOffers,
  getRecentMessages,
} from '@adapters/supabaseService';
import { determineRequiredFields } from '../intelligence/oemRequiredFieldsService';
import * as oemService from '@intelligence/oemService';
import { logger } from '@utils/logger';
import { scrapeOffersForOrder } from '../scraping/scrapingService';
import { generateChatCompletion, generateVisionCompletion } from '../intelligence/geminiService';
import { getConversationDecision, type ConversationContext } from '../intelligence/conversationIntelligence';
import { checkVehicleCompleteness } from '../intelligence/vehicleGuard';
import { t, tWith } from './botResponses';
import * as fs from "fs/promises";
import { isEnabled, FF } from './featureFlags';
import { getMerchantByPhone } from '../adapters/phoneMerchantMapper';
import { withConversationLock } from './lockService';

// Lazy accessor so tests can mock `supabaseService` after this module was loaded.
function getSupa() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("../adapters/supabaseService");
}

// =================================================================
// RE-EXPORTS from extracted modules (backwards compatibility)
// =================================================================

export {
  type ParsedUserMessage, type SmalltalkType, type MessageIntent, type IntentResult,
  detectLanguageSelection, detectLanguageFromText, detectSmalltalk, detectAbusive,
  sanitizeText, extractVinHsnTsn, hasVehicleHints, detectIntent,
  parseUserMessage, pickLanguageFromChoice,
} from './nluService';

export {
  type VehicleOcrResult, type VehicleInfoPatch, type Intent, type NlpResult,
  downloadImageBuffer, downloadFromTwilio, extractVehicleDataFromImage,
  safeParseVehicleJson, understandUserText, determineMissingVehicleFields,
  isVehicleSufficientForOem,
} from './vehicleOcrService';

export {
  type OrchestratorAction, type OrchestratorResult, type CollectPartBrainResult,
  callOrchestrator, buildSmalltalkReply, needsVehicleDocumentHint,
  buildVehicleFollowUpQuestion, buildPartFollowUpQuestion, partRequiredFields,
  detectNoVehicleDocument, hasSufficientPartInfo, mergePartInfo,
  calculateEndPrice, calculateEstimatedDeliveryRange,
  answerGeneralQuestion, runCollectPartBrain, shortOrderLabel, verifyOemWithAi,
} from './botHelpers';

// Local imports for use in this file
import {
  type ParsedUserMessage, type MessageIntent,
  detectLanguageSelection, detectLanguageFromText, detectSmalltalk, detectAbusive,
  sanitizeText, extractVinHsnTsn, hasVehicleHints, detectIntent,
  parseUserMessage, pickLanguageFromChoice,
} from './nluService';

import {
  type VehicleOcrResult,
  downloadImageBuffer, downloadFromTwilio, extractVehicleDataFromImage,
  understandUserText, determineMissingVehicleFields, isVehicleSufficientForOem,
} from './vehicleOcrService';

import {
  callOrchestrator, buildSmalltalkReply, needsVehicleDocumentHint,
  buildVehicleFollowUpQuestion, buildPartFollowUpQuestion,
  detectNoVehicleDocument, hasSufficientPartInfo, mergePartInfo,
  calculateEndPrice, calculateEstimatedDeliveryRange,
  answerGeneralQuestion, runCollectPartBrain, shortOrderLabel, verifyOemWithAi,
} from './botHelpers';

// =================================================================
// OEM Lookup Handler (kept inline — deeply coupled to DB operations)
// =================================================================

async function runOemLookupAndScraping(
  orderId: string,
  language: string | null,
  parsed: ParsedUserMessage,
  orderData: any,
  partDescription: string | null,
  vehicleOverride?: {
    make?: string; model?: string; year?: number; engine?: string;
    engineKw?: number; vin?: string; hsn?: string; tsn?: string;
    fuelType?: string; emissionClass?: string;
  }
): Promise<{ replyText: string; nextStatus: ConversationStatus }> {

  logger.info('[OEMLookup] Starting OEM resolution', { orderId, language });

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
    return { replyText: q || t('vehicle_need_more', language), nextStatus: "collect_vehicle" };
  }

  const partText = parsed.part || orderData?.requestedPart || orderData?.partText || partDescription || t('part_mentioned', language);

  try {
    let oemResult: any;
    if (typeof (oemService as any).resolveOEMForOrder === "function") {
      oemResult = await (oemService as any).resolveOEMForOrder(orderId, {
        make: vehicleForOem.make ?? null, model: vehicleForOem.model ?? null,
        year: vehicleForOem.year ?? null, engine: vehicleForOem.engine ?? null,
        engineKw: (vehicle as any)?.engineKw ?? null, vin: vehicleForOem.vin ?? null,
        hsn: vehicleForOem.hsn ?? null, tsn: vehicleForOem.tsn ?? null
      }, partText);
    } else if (typeof (oemService as any).resolveOEM === "function") {
      try {
        const legacy = await (oemService as any).resolveOEM({
          make: vehicleForOem.make, model: vehicleForOem.model, year: vehicleForOem.year,
          engine: vehicleForOem.engine, engineKw: (vehicle as any)?.engineKw,
          vin: vehicleForOem.vin, hsn: vehicleForOem.hsn, tsn: vehicleForOem.tsn
        }, partText);
        oemResult = {
          primaryOEM: legacy.oemNumber ?? (legacy.oem ?? undefined),
          overallConfidence: legacy.success ? 0.85 : 0,
          candidates: legacy.oemData?.candidates ?? [],
          notes: legacy.message ?? undefined
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
        oemNumber: oemResult.primaryOEM ?? null, oemConfidence: oemResult.overallConfidence ?? null,
        oemNotes: oemResult.notes ?? null, oemCandidates: oemResult.candidates ?? [],
        oemTecdocPartsouq: oemResult.tecdocPartsouqResult ?? null
      });
      try {
        await updateOrderOEM(orderId, {
          oemStatus: oemResult.primaryOEM ? "resolved" : "not_found",
          oemError: oemResult.primaryOEM ? null : oemResult.notes ?? null,
          oemData: oemResult, oemNumber: oemResult.primaryOEM ?? null
        });
      } catch (err: any) { logger.warn("Failed to persist OEM fields", { orderId, error: err?.message }); }
    } catch (err: any) { logger.warn("Failed to persist OEM resolver output", { orderId, error: err?.message }); }

    if (oemResult.variantDetected && oemResult.variantQuestion && oemResult.variants?.length) {
      logger.info('[OEMLookup] Variants detected', { orderId, variantCount: oemResult.variants.length });
      try {
        await updateOrderData(orderId, { pendingVariants: oemResult.variants, oemCandidates: oemResult.candidates ?? [] });
      } catch (err: any) { logger.warn('Failed to persist variant data', { orderId, error: err?.message }); }
      return { replyText: oemResult.variantQuestion, nextStatus: "awaiting_variant_selection" as ConversationStatus };
    }

    if (oemResult.primaryOEM && oemResult.overallConfidence >= 0.7) {
      const cautious = oemResult.overallConfidence < 0.9;
      try {
        const scrapeResult = await scrapeOffersForOrder(orderId, oemResult.primaryOEM);
        try {
          const scrapeData: any = { scrapeStatus: (scrapeResult && (scrapeResult as any).jobId) ? "started" : ((scrapeResult && (scrapeResult as any).ok) ? "done" : "unknown"), scrapeResult: scrapeResult ?? null };
          if ((scrapeResult as any)?.jobId) scrapeData.scrapeTaskId = (scrapeResult as any).jobId;
          if (typeof persistScrapeResult === "function") await persistScrapeResult(orderId, scrapeData);
          else if (typeof updateOrderScrapeTask === "function") await updateOrderScrapeTask(orderId, scrapeData);
        } catch (uErr: any) { logger.warn("Failed to persist scrape", { orderId, error: uErr?.message }); }

        const cautionNote = cautious ? t('caution_check', language) : "";
        return { replyText: `${t('oem_product_found', language)}${cautionNote}`, nextStatus: "show_offers" };
      } catch (err: any) {
        logger.error("Scrape after OEM failed", { error: err?.message, orderId });
        return { replyText: t('oem_scrape_failed', language), nextStatus: "needs_human" as ConversationStatus };
      }
    }

    return { replyText: t('oem_product_uncertain', language), nextStatus: "needs_human" as ConversationStatus };
  } catch (err: any) {
    logger.error("resolveOEM failed", { error: err?.message, orderId });
    return { replyText: t('oem_retry_prompt', language), nextStatus: "oem_lookup" as ConversationStatus };
  }
}

// =================================================================
// Main Flow Entry Point
// =================================================================

export interface BotMessagePayload {
  from: string;
  text: string;
  orderId?: string | null;
  mediaUrls?: string[];
  channel?: 'whatsapp' | 'web' | 'test';
}

export async function handleIncomingBotMessage(
  payload: BotMessagePayload,
  sendInterimReply?: (message: string) => Promise<void>
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
    const intentResult = detectIntent(userText, hasVehicleImage);
    const intent: MessageIntent = intentResult.intent;
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
          "Zu welcher Anfrage haben Sie die Frage? Bitte nennen Sie die Ticket-ID.\nOptionen: " +
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

        logger.info("[BotLogic] OEM direct input detected", { oem: extractedOem, orderId: order.id });

        // Send interim "searching..." message
        if (sendInterimReply) {
          await sendInterimReply(t('oem_searching', language));
        }

        // Store OEM on order and skip to scraping
        await updateOrderData(order.id, { oem: extractedOem, directOemInput: true });

        try {
          const { scrapeOffersForOrder } = await import('../scraping/scrapingService');
          const scrapeResult = await scrapeOffersForOrder(order.id, extractedOem);

          if (scrapeResult && scrapeResult.length > 0) {
            await updateOrder(order.id, { status: "show_offers" as ConversationStatus });
            return {
              reply: tWith('oem_direct_found', language, { oem: extractedOem, count: String(scrapeResult.length) }),
              orderId: order.id
            };
          } else {
            return {
              reply: t('no_offers', language),
              orderId: order.id
            };
          }
        } catch (err: any) {
          logger.error("[BotLogic] OEM direct scraping failed", { error: err?.message, oem: extractedOem });
          return {
            reply: tWith('oem_direct_scrape_error', language, { oem: extractedOem }),
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
        const options = activeOrders.slice(0, 5).map((o, i) =>
          `*${i + 1}.* ${shortOrderLabel(o)}`
        ).join("\n");
        return {
          reply: tWith('cancel_which_order', lang, { options }),
          orderId: activeOrders[0].id
        };
      }
      const orderToCancel = activeOrders[0];
      try {
        await updateOrder(orderToCancel.id, { status: "cancelled" as ConversationStatus });
        logger.info("Order cancelled by user request", { orderId: orderToCancel.id });
      } catch (err) {
        logger.error("Failed to cancel order", { orderId: orderToCancel.id, error: (err as any)?.message });
      }
      const lang = orderToCancel.language || "de";
      return {
        reply: t('cancel_confirmed', lang),
        orderId: orderToCancel.id
      };
    }

    // BACK COMMAND: Let user go back one step
    const backKeywords = ["zurück", "back", "geri", "paş", "wstecz", "nochmal", "restart", "neu anfangen"];
    const isBackCommand = backKeywords.some(k => userText.toLowerCase().includes(k));
    if (isBackCommand && activeOrders.length > 0) {
      const currentOrder = activeOrders[0];
      const currentStatus = currentOrder.status as ConversationStatus;
      const backMap: Partial<Record<ConversationStatus, ConversationStatus>> = {
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
          await updateOrder(currentOrder.id, { status: prevStatus });
        } catch (err) {
          logger.error("Failed to go back", { orderId: currentOrder.id, error: (err as any)?.message });
        }
        const lang = currentOrder.language || "de";
        return {
          reply: t('back_command', lang),
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
          await updateOrder(newOrder.id, {
            vehicle_description: lastOrder.vehicle_description,
            status: "collect_part" as ConversationStatus,
            language: lastOrder.language
          });
          // Copy vehicle data if exists
          if (lastOrder.order_data?.vehicle) {
            await getSupa().updateOrderData(newOrder.id, { vehicle: lastOrder.order_data.vehicle });
          }
        } catch (err) {
          logger.error("Failed to copy vehicle for continue_order", { error: (err as any)?.message });
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
      const options = activeOrders.slice(0, 5).map((o, i) =>
        `*${i + 1}.* ${shortOrderLabel(o)}`
      ).join("\n");
      return {
        reply: tWith('multi_order_ask', lang, { count: String(activeOrders.length), options }),
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
    // Multi-tenant: Get merchant for this phone number
    const merchantMapping = await getMerchantByPhone(payload.from);
    const merchantId = merchantMapping?.merchantId || process.env.DEFAULT_MERCHANT_ID || 'admin';
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
        const reply = t('abuse_warning', language);
        return { reply, orderId: order.id };
      }
    } catch (e) {
      // If abuse check fails for any reason, continue normally.
      logger.warn("Abuse detection failed", { error: (e as any)?.message });
    }
    // =====================================================================
    // 🖼️ IMAGE FLOW: Classify first, then route appropriately
    // vehicle_document → OCR → vehicle data enrichment
    // part_photo       → extract OEM from label → direct answer
    // unknown          → skip OCR (no waste)
    // =====================================================================
    let ocrResult: any = null;
    let ocrFailed = false;
    let partLabelOem: string | null = null;

    if (hasVehicleImage && Array.isArray(payload.mediaUrls) && payload.mediaUrls.length > 0) {
      try {
        // Step 1: Classify the image (cheap Gemini Flash call ~$0.001)
        const { classifyImage } = await import('../intelligence/imageClassifier');
        const classification = await classifyImage(payload.mediaUrls[0]);
        logger.info('[ImageFlow] Classification result', {
          type: classification.classification,
          confidence: classification.confidence,
          orderId: order.id,
        });

        const buf = await downloadFromTwilio(payload.mediaUrls[0]);

        switch (classification.classification) {
          case 'vehicle_document': {
            // Route 1: Fahrzeugschein → existing OCR pipeline
            ocrResult = await extractVehicleDataFromImage(buf);
            logger.info('[ImageFlow] Vehicle document OCR complete', { orderId: order.id, ocr: ocrResult });

            const hasData = ocrResult && (ocrResult.make || ocrResult.model || ocrResult.vin || ocrResult.hsn);
            if (!hasData) {
              ocrFailed = true;
              logger.warn('[ImageFlow] OCR returned empty result', { orderId: order.id });
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

              const visionResult = await generateVisionCompletion({ prompt: extractPrompt, imageBase64: base64 });
              const parsed = JSON.parse(
                visionResult.replace(/```json/g, '').replace(/```/g, '').trim()
              );

              if (parsed.oem && parsed.confidence > 0.5) {
                partLabelOem = parsed.oem.replace(/[\s.-]/g, '').toUpperCase();
                logger.info('[ImageFlow] Part label OEM extracted', {
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
                await updateOrderData(order.id, { oem: partLabelOem, partLabelExtracted: true });
                return { reply, orderId: order.id };
              }
            } catch (labelErr: any) {
              logger.warn('[ImageFlow] Part label extraction failed', { error: labelErr?.message });
            }
            // If extraction failed, fall through to normal flow
            break;
          }

          default: {
            // Route 3: Unknown image (selfie, screenshot, etc.) → skip OCR
            logger.info('[ImageFlow] Non-automotive image, skipping OCR', { orderId: order.id });
            const lang = language || 'de';
            const skipReply = lang === 'en'
              ? '📷 I received the photo but couldn\'t identify an automotive document or part. Could you send a photo of your vehicle registration (Fahrzeugschein) or the part label?'
              : '📷 Ich habe das Foto erhalten, konnte aber kein Fahrzeugdokument oder Autoteil erkennen. Könnten Sie ein Foto vom Fahrzeugschein oder dem Teileetikett senden?';
            return { reply: skipReply, orderId: order.id };
          }
        }
      } catch (err: any) {
        logger.warn('[ImageFlow] Image processing failed', { error: err?.message, orderId: order.id });
        ocrResult = null;
        ocrFailed = true;
      }

      // M1 FIX: Tell the user when OCR can't read their photo
      if (ocrFailed) {
        const ocrErrorMsg = t('ocr_failed', language);
        if (!ocrResult?.make && !ocrResult?.vin) {
          return { reply: ocrErrorMsg, orderId: order.id };
        }
      }
    }

    // Call AI orchestrator as primary decision maker. If it fails, fallback to legacy NLU.
    let parsed: ParsedUserMessage = { intent: "unknown" };
    const statesForOrchestrator: ConversationStatus[] = ["choose_language", "collect_vehicle", "collect_part"];
    if (statesForOrchestrator.includes(order.status as any)) {
      try {
        // Fix: Load lastBotMessage from orderData instead of null
        const lastBotMsg = orderData?.lastBotMessage || orderData?.last_bot_reply || null;

        // P1 #11: Load chat history for orchestrator context
        let chatHistory: Array<{ role: string; content: string }> = [];
        try {
          chatHistory = await getRecentMessages(order.id, 5);
        } catch (histErr: any) {
          logger.warn('[BotLogic] Failed to load chat history', { error: histErr?.message });
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
            const reply = orch.reply || t('abuse_warning', order.language ?? 'de');
            return { reply, orderId: order.id };
          }

          if (orch.action === "smalltalk") {
            // do not change state, just reply
            let reply = orch.reply || "";
            if (needsVehicleDocumentHint(order)) {
              const docHint =
                t('doc_hint', order.language);
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
              const reply = tWith('vehicle_confirm', language, { summary });
              await updateOrder(order.id, { status: "confirm_vehicle" });
              return { reply, orderId: order.id, nextStatus: "confirm_vehicle" };
            }
          }


          if (orch.action === "ask_slot") {
            if (isVehicleSufficientForOem(vehicleCandidate) && partCandidate) {
              // #3 FIX: REMOVED conv-intelligence doppelcall here.
              // The orchestrator already decided ask_slot with sufficient data.
              // Proceed directly to OEM lookup — saves ~300ms + AI costs.

              // #1 FIX: Send Zwischennachricht before OEM lookup
              if (sendInterimReply) {
                await sendInterimReply(t('oem_searching', order.language));
              }

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
            const guardResult = checkVehicleCompleteness({
              make: vehicleOverride.make,
              model: vehicleOverride.model,
              year: vehicleOverride.year,
              engine: vehicleOverride.engine,
              vin: vehicleOverride.vin,
              hsn: vehicleOverride.hsn,
              tsn: vehicleOverride.tsn,
            });

            if (!guardResult.isComplete && guardResult.followUpQuestion) {
              logger.info('[BotLogic] Vehicle guard: incomplete vehicle data', {
                missingFields: guardResult.missingFields,
                confidence: guardResult.confidence,
                orderId: order.id
              });
              return { reply: guardResult.followUpQuestion, orderId: order.id };
            }

            const minimalParsed: ParsedUserMessage = {
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
              await sendInterimReply(t('oem_searching', order.language));
            }

            // M2 FIX: 30s timeout for entire OEM resolution
            const OEM_TIMEOUT_MS = 30000;
            try {
              const oemFlow = await Promise.race([
                runOemLookupAndScraping(
                  order.id,
                  order.language ?? "de",
                  minimalParsed,
                  orderData,
                  orch.slots.requestedPart ?? null,
                  vehicleOverride
                ),
                new Promise<never>((_, reject) =>
                  setTimeout(() => reject(new Error('OEM_TIMEOUT')), OEM_TIMEOUT_MS)
                )
              ]);
              return { reply: oemFlow.replyText, orderId: order.id };
            } catch (err: any) {
              if (err.message === 'OEM_TIMEOUT') {
                logger.warn('[BotLogic] OEM resolution timed out after 30s', { orderId: order.id });
                return { reply: t('oem_timeout', order.language), orderId: order.id };
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

      const statusReply = tWith('status_header', language, { orderId: order.id, status }) +
        (status === "done" ? t('status_done', language) :
          status === "ready" ? tWith('status_ready', language, { delivery }) :
            t('status_searching', language));
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

    // 🚀 STATE MACHINE INTEGRATION (Feature Flag controlled)
    // When enabled, use new state machine handlers instead of legacy switch
    const stateMachineStates: ConversationStatus[] = [
      'choose_language', 'collect_vehicle', 'confirm_vehicle', 'collect_part',
      'oem_lookup', 'show_offers', 'await_offer_choice', 'await_offer_confirmation',
      'collect_delivery_preference', 'collect_address', 'done'
    ];
    if (isEnabled(FF.USE_STATE_MACHINE, { userId: payload.from }) && stateMachineStates.includes(nextStatus)) {
      try {
        // Dynamic import to avoid circular dependencies
        const { executeState, getHandler } = await import('./stateMachine');
        await import('./stateMachine/index'); // Ensure handlers are registered

        const handler = getHandler(nextStatus);
        if (handler) {
          const stateCtx = {
            orderId: order.id,
            order,
            orderData,
            language: (language || 'de') as 'de' | 'en' | 'tr' | 'ku' | 'pl',
            userText,
            parsed,
            mediaUrls: payload.mediaUrls,
            currentStatus: nextStatus
          };

          const stateResult = await executeState(nextStatus, stateCtx);

          if (stateResult.updatedOrderData) {
            await updateOrderData(order.id, stateResult.updatedOrderData);
            orderData = { ...orderData, ...stateResult.updatedOrderData };
          }

          replyText = stateResult.reply;
          nextStatus = stateResult.nextStatus;

          logger.info("State machine handled request", {
            orderId: order.id,
            handler: handler.name,
            nextStatus,
            replyLength: replyText.length
          });

          // Skip legacy switch if state machine handled it
          // We'll jump to the persist section
        } else {
          logger.debug("No state machine handler for status, falling back to legacy", { status: nextStatus });
        }
      } catch (smError: any) {
        logger.warn("State machine failed, falling back to legacy switch", {
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
      if (isEnabled(FF.USE_STATE_MACHINE, { userId: payload.from }) && stateMachineStates.includes(nextStatus)) {
        logger.warn("[SILENT FALLBACK] State machine active but produced empty reply — legacy switch taking over", {
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
            // Generate greeting after language selection
            replyText = t('greeting_after_language', language);
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
            // AUDIT FIX: Reuse OCR from the modern image classification flow
            // instead of re-downloading and re-processing the same image
            if (ocrResult) {
              anyBufferDownloaded = true;
              ocrSucceeded = true;
              logger.info("[collect_vehicle] Reusing OCR from image flow", { orderId: order.id });
            }
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
                const ocr = ocrResult || await extractVehicleDataFromImage(buffers[0]);
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
                    t('ocr_success', language);
                } else {
                  // gezielte Rückfrage
                  const field = missingFieldsAfterOcr[0];
                  if (field === "vin_or_hsn_tsn") {
                    replyText = t('ocr_vin_missing', language);
                  } else if (field === "make") {
                    replyText = t('ask_brand', language);
                  } else if (field === "model") {
                    replyText = t('ask_model', language);
                  } else {
                    replyText = t('ask_vin_general', language);
                  }
                  nextStatus = "collect_vehicle";
                }
              }
            } catch (err: any) {
              logger.error("Vehicle OCR failed", { error: err?.message, orderId: order.id });
            }

            if (!anyBufferDownloaded) {
              replyText = t('ocr_photo_failed', language);
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
                t('ocr_success', language);
            } else {
              // gezielte Rückfrage
              const field = missingFields[0];
              if (field === "vin_or_hsn_tsn") {
                replyText = t('ocr_vin_missing', language);
              } else if (field === "make") {
                replyText = t('ask_brand', language);
              } else if (field === "model") {
                replyText = t('ask_model', language);
              } else {
                replyText = t('ask_vin_general', language);
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
          const vehicleText = await getVehicleForOrder(order.id);
          logger.info("Vehicle after upsert", { orderId: order.id, vehicle: vehicleText });
          const missingVehicleFields = determineRequiredFields({
            make: vehicleText?.make,
            model: vehicleText?.model,
            year: vehicleText?.year,
            engine: (vehicleText as any)?.engineCode ?? (vehicleText as any)?.engine ?? (vehicleText as any)?.engineKw,
            vin: vehicleText?.vin,
            hsn: vehicleText?.hsn,
            tsn: vehicleText?.tsn
          });

          if (missingVehicleFields.length > 0) {
            const q = buildVehicleFollowUpQuestion(missingVehicleFields, language ?? "de");
            replyText =
              q ||
              t('ask_vin_general', language);
            nextStatus = "collect_vehicle";
          } else {
            const summary = `${vehicleText?.make} ${vehicleText?.model} (${vehicleText?.year})`;
            replyText = tWith('vehicle_confirm', language, { summary });
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
              replyText = t('confirm_vehicle_yes', language);
              nextStatus = "collect_part";
            }
          } else {
            // User says no or provided different info
            replyText = t('vehicle_correction', language);
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
              t('part_mentioned', language);

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

        // 🔀 BUG B FIX: Handle customer's variant selection
        case "awaiting_variant_selection": {
          const pendingVariants = orderData?.pendingVariants;
          if (!pendingVariants || !Array.isArray(pendingVariants) || pendingVariants.length === 0) {
            logger.warn('[VariantSelection] No pending variants found', { orderId: order.id });
            replyText = t('oem_product_uncertain', language);
            nextStatus = "needs_human" as ConversationStatus;
            break;
          }

          const selectionText = (parsed.part || (parsed as any).userPartText || userText || '').trim();

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
              if (diff && lowerText.includes(diff)) { selectedIndex = i; break; }
              if (desc && lowerText.includes(desc)) { selectedIndex = i; break; }
              // Match OEM number directly if customer types it
              if (v.oem && lowerText.includes(v.oem.toLowerCase())) { selectedIndex = i; break; }
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

          logger.info('[VariantSelection] Customer selected variant', {
            orderId: order.id,
            selectedIndex: selectedIndex + 1,
            selectedOem,
            differentiator: selectedVariant.differentiator,
          });

          // Persist selected OEM
          try {
            await updateOrderData(order.id, {
              oemNumber: selectedOem,
              oemConfidence: selectedVariant.confidence,
              selectedVariant: selectedVariant,
              pendingVariants: null, // Clear pending
            });
            try {
              await updateOrderOEM(order.id, {
                oemStatus: "resolved",
                oemNumber: selectedOem,
                oemData: { selectedVariant, allVariants: pendingVariants },
              });
            } catch (err: any) {
              logger.warn("Failed to persist selected variant OEM", { orderId: order.id, error: err?.message });
            }
          } catch (err: any) {
            logger.warn("Failed to persist variant selection", { orderId: order.id, error: err?.message });
          }

          // Proceed to scrape offers with the selected OEM
          try {
            await scrapeOffersForOrder(order.id, selectedOem);
            const variantLabel = selectedVariant.differentiator || selectedOem;
            replyText = language === "de"
              ? `✅ *${variantLabel}* ausgewählt (${selectedOem}).\n\n🔍 Ich suche jetzt die besten Angebote für Sie...`
              : `✅ *${variantLabel}* selected (${selectedOem}).\n\n🔍 Searching for the best offers for you...`;
            nextStatus = "show_offers";
          } catch (err: any) {
            logger.error("Scrape after variant selection failed", { error: err?.message, orderId: order.id });
            replyText = t('oem_scrape_failed', language);
            nextStatus = "needs_human" as ConversationStatus;
          }
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
              // FIX: Track how many times we've shown "collecting" to avoid infinite loop
              const collectAttempts = (orderData?.offerCollectAttempts ?? 0) + 1;
              try {
                await updateOrderData(order.id, { offerCollectAttempts: collectAttempts });
              } catch (_) { }

              if (collectAttempts >= 3) {
                // After 3 attempts, escalate to human
                replyText = t('offers_escalate', language);
                nextStatus = "needs_human" as ConversationStatus;
                break;
              }

              replyText = t('offer_collecting', language);
              nextStatus = "show_offers";
              break;
            }
            // Reset counter on success
            try { await updateOrderData(order.id, { offerCollectAttempts: 0 }); } catch (_) { }

            if (sorted.length === 1) {
              const offer = sorted[0] as any;
              const endPrice = calculateEndPrice(offer.price);
              const delivery = offer.deliveryTimeDays ?? t('na_text', language);

              const bindingNote = t('offer_binding_note', language);

              // Beautiful offer formatting for WhatsApp (NO LINK, NO SHOP NAME for customer)
              const isInStock = offer.shopName === "Händler-Lager" || offer.shopName === "Eigener Bestand";
              const stockInfo = isInStock
                ? t('offer_pickup', language)
                : tWith('offer_delivery', language, { delivery });

              replyText =
                `${t('offer_single_header', language)}\n\n` +
                `🏷️ *${t('offer_brand_label', language)}:* ${offer.brand ?? t('na_text', language)}\n` +
                `💰 *${t('offer_price_label', language)}:* ${endPrice} ${offer.currency}\n` +
                `${stockInfo}\n` +
                `${offer.availability && !isInStock ? `📦 *${t('offer_stock_label', language)}:* ${offer.availability}\n` : ''}` +
                `${bindingNote}\n\n` +
                `${t('offer_order_prompt', language)}`;
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
                buttons: [t('btn_yes_order', language), t('btn_no_others', language)]
              };
            }

            const top = sorted.slice(0, 3);
            const lines =
              top.map(
                (o: any, idx: number) => {
                  const isInStock = o.shopName === "H\u00e4ndler-Lager" || o.shopName === "Eigener Bestand";
                  const deliveryInfo = isInStock ? t('offer_instant', language) : `🚚 ${o.deliveryTimeDays ?? t('na_text', language)} ${language === 'de' ? 'Tage' : language === 'en' ? 'days' : language === 'tr' ? 'g\u00fcn' : language === 'pl' ? 'dni' : 'roj'}`;
                  return `*${idx + 1}.* 🏷️ ${o.brand ?? t('na_text', language)}\n` +
                    `   💰 ${calculateEndPrice(o.price)} ${o.currency} | ${deliveryInfo}`;
                }
              );
            const multiBindingNote = t('offer_multi_binding', language);

            replyText =
              replyText =
              t('offer_multi_header', language) + "\n\n" +
              lines.join("\n\n") +
              multiBindingNote +
              "\n\n" + t('offer_choose_prompt', language);

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
              t('offer_fetch_failed', language);
            nextStatus = "show_offers";
            return { reply: replyText, orderId: order.id };
          }
          break;
        }

        case "await_offer_choice": {
          const txt = (userText || "").trim().toLowerCase();
          let choiceIndex: number | null = null;
          // FIX: Use strict regex to match only standalone numbers, not "320i" etc.
          const choiceMatch = txt.match(/^\s*([1-3])\s*[\.\)\:]?\s*/);
          if (choiceMatch) {
            choiceIndex = parseInt(choiceMatch[1], 10) - 1;
          }
          logger.info("User offer choice message", { orderId: order.id, text: userText, choiceIndex });

          const choiceIds: string[] | undefined = orderData?.offerChoiceIds;
          if (choiceIndex === null || !choiceIds || choiceIndex < 0 || choiceIndex >= choiceIds.length) {
            replyText =
              t('offer_choice_invalid', language);
            nextStatus = "await_offer_choice";
            break;
          }

          const chosenOfferId = choiceIds[choiceIndex];
          const offers = await listShopOffersByOrderId(order.id);
          const chosen = offers.find((o: any) => o.id === chosenOfferId);
          if (!chosen) {
            replyText =
              t('offer_choice_not_found', language);
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
            tWith('offer_confirmed_choice', language, { orderId: order.id });
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
              t('offer_confirm_prompt', language);
            nextStatus = "await_offer_confirmation";
            break;
          }

          if (isNo) {
            replyText =
              t('offer_decline_alt', language);
            nextStatus = "show_offers";
            break;
          }

          if (!candidateId) {
            replyText =
              t('offer_lost', language);
            nextStatus = "show_offers";
            break;
          }

          // FIX: Show binding order confirmation before finalizing
          if (!orderData?.pendingBindingConfirmation) {
            try {
              await updateOrderData(order.id, { pendingBindingConfirmation: true });
            } catch (_) { }
            replyText = t('binding_order_confirm', language);
            nextStatus = "await_offer_confirmation";
            // The next time user says "ja" with pendingBindingConfirmation=true, we'll process it
            break;
          }

          const offers = await listShopOffersByOrderId(order.id);
          const chosen = offers.find((o: any) => o.id === candidateId);
          if (!chosen) {
            replyText =
              t('offer_not_found', language);
            nextStatus = "show_offers";
            break;
          }

          try {
            await updateOrderData(order.id, {
              selectedOfferId: chosen.id,
              bindingConfirmed: true,
              bindingConfirmedAt: new Date().toISOString(),
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
              replyText = t('delivery_choose_exact', language);
              nextStatus = "collect_delivery_preference";
            } else {
              const dealerLoc = merchantSettings?.dealerAddress || "unseren Standort";
              replyText = tWith('offer_confirmed', language, { orderId: order.id }) + "\n\n" + tWith('pickup_location', language, { location: dealerLoc });
              nextStatus = "done";
            }
          } catch (err: any) {
            logger.error("Failed to store confirmed offer", { error: err?.message, orderId: order.id, candidateId });
          }

          logger.info("Binding order confirmed", {
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
            replyText = t('address_hint', language);
            nextStatus = "collect_address";
          } else if (isPickup) {
            const dealerLoc = merchantSettings?.dealerAddress || "unseren Standort";
            replyText = tWith('pickup_location', language, { location: dealerLoc });
            nextStatus = "done";
          } else {
            replyText = t('delivery_choose_exact', language);
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
            } catch (err) {
              logger.error("Failed to save delivery address", { orderId: order.id, error: err });
            }
            replyText = t('address_saved', language);
            nextStatus = "done";
          } else {
            replyText = t('address_hint', language);
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
            replyText = t('goodbye', language);
            return {
              reply: replyText,
              orderId: order.id,
              contentSid: process.env.TWILIO_GOODBYE_CONTENT_SID || 'HXb5b62575e6e4ff6129ad7c8efe1f983e',
              contentVariables: JSON.stringify({ "1": order.id, "2": "Bestellung abgeschlossen" })
            };
          } else if (wantsFreshStart) {
            nextStatus = "collect_vehicle";
            replyText = t('fresh_start', language);
          } else if (isStatusQuestion) {
            const odata = order.order_data || {};
            const delivery = odata.selectedOfferSummary?.deliveryTimeDays ?? "n/a";
            replyText = tWith('status_header', language, { orderId: order.id, status: order.status }) +
              t('status_done', language);
          } else if (wantsNewPart && order.vehicle_description) {
            try {
              const newOrder = await getSupa().findOrCreateOrder(payload.from, null, { forceNew: true });
              await updateOrder(newOrder.id, {
                vehicle_description: order.vehicle_description,
                status: "collect_part" as ConversationStatus,
                language
              });
              if (orderData?.vehicle) {
                await getSupa().updateOrderData(newOrder.id, { vehicle: orderData.vehicle });
              }
              replyText = tWith('follow_up_part', language, { make: orderData?.vehicle?.make || '', model: orderData?.vehicle?.model || '' });
              return { reply: replyText, orderId: newOrder.id };
            } catch (err) {
              logger.error("Failed to create follow-up order", { error: (err as any)?.message });
              replyText = t('follow_up_fallback', language);
              nextStatus = "collect_part";
            }
          } else {
            // Default: politely remind order is complete and offer options
            replyText = t('order_complete', language) + "\n\n" + t('order_another_part', language);
          }
          break;
        }

        default: {
          // Unerwarteter Zustand: sauber neustarten
          nextStatus = "choose_language";
          language = null;
          replyText =
            "Bitte wähle deine Sprache:\n" +
            "1. Deutsch 🇩🇪\n" +
            "2. English 🇬🇧\n" +
            "3. Türkçe 🇹🇷\n" +
            "4. Kurdî ☀️\n" +
            "5. Polski 🇵🇱\n\n" +
            "Please choose your language (1-5).";
        }
      } // END switch
    } // END if (!replyText) - state machine fallback wrapper

    // Fallback, falls keine Antwort gesetzt wurde
    if (!replyText) {
      replyText = t('global_fallback', language);
    }

    const vehicleDescToSave = hasVehicleImage
      ? vehicleDescription
        ? `${vehicleDescription} \n${vehicleImageNote ?? ""} `
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



