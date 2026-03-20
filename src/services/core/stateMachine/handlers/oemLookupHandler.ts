/**
 * OEM LOOKUP STATE HANDLER
 *
 * Runs the OEM resolution pipeline (APEX) and scraping.
 * Extracted from botLogicService.ts lines 1377-1388.
 */

import { createHandler, StateContext, StateResult } from '../stateMachine';
import { ConversationStatus, getVehicleForOrder, updateOrderData, updateOrderOEM } from '../../../adapters/supabaseService';
import { determineRequiredFields } from '../../../intelligence/oemRequiredFieldsService';
import * as oemService from '@intelligence/oemService';
import { scrapeOffersForOrder } from '../../../scraping/scrapingService';
import { escalateToDealer } from '../../escalationService';
import { t, tWith } from '../../botResponses';
import { buildVehicleFollowUpQuestion } from '../../botHelpers';
import { logger } from '../../../../utils/logger';

export const oemLookupHandler = createHandler(
    'OemLookupHandler',
    ['oem_lookup'],
    async (ctx: StateContext): Promise<StateResult> => {
        const { orderId, order, orderData, language, parsed } = ctx;

        logger.info('[OemLookupHandler] Starting OEM resolution', { orderId, language });

        const vehicle = await getVehicleForOrder(orderId);
        const engineVal = (vehicle as any)?.engineCode ?? (vehicle as any)?.engine ?? undefined;
        const vehicleForOem = {
            make: (vehicle as any)?.make ?? undefined,
            model: (vehicle as any)?.model ?? undefined,
            year: (vehicle as any)?.year ?? undefined,
            engine: engineVal,
            engineKw: (vehicle as any)?.engineKw ?? undefined,
            vin: (vehicle as any)?.vin ?? undefined,
            hsn: (vehicle as any)?.hsn ?? undefined,
            tsn: (vehicle as any)?.tsn ?? undefined,
        };

        // Check required fields
        const missingVehicleFields = determineRequiredFields(vehicleForOem);
        if (missingVehicleFields.length > 0) {
            const q = buildVehicleFollowUpQuestion(missingVehicleFields, language);
            return {
                reply: q || t('vehicle_need_more', language),
                nextStatus: 'collect_vehicle',
            };
        }

        const partText = parsed.part || orderData?.requestedPart || orderData?.partText || t('part_mentioned', language);
        
        // Map common German/English position terms to internal structure
        let partPosition: 'front' | 'rear' | 'left' | 'right' | 'front-left' | 'front-right' | 'rear-left' | 'rear-right' | 'any' = 'any';
        const txt = (partText + ' ' + (parsed.rawText || '')).toLowerCase();
        
        if (txt.includes('vorne links') || txt.includes('front left')) partPosition = 'front-left';
        else if (txt.includes('vorne rechts') || txt.includes('front right')) partPosition = 'front-right';
        else if (txt.includes('hinten links') || txt.includes('rear left')) partPosition = 'rear-left';
        else if (txt.includes('hinten rechts') || txt.includes('rear right')) partPosition = 'rear-right';
        else if (txt.includes('vorne') || txt.includes('front') || txt.includes('vorderachse')) partPosition = 'front';
        else if (txt.includes('hinten') || txt.includes('rear') || txt.includes('hinterachse')) partPosition = 'rear';
        else if (txt.includes('links') || txt.includes('left')) partPosition = 'left';
        else if (txt.includes('rechts') || txt.includes('right')) partPosition = 'right';

        try {
            let oemResult: any;
            if (typeof (oemService as any).resolveOEMForOrder === 'function') {
                oemResult = await (oemService as any).resolveOEMForOrder(orderId, {
                    make: vehicleForOem.make ?? null, model: vehicleForOem.model ?? null,
                    year: vehicleForOem.year ?? null, engine: vehicleForOem.engine ?? null,
                    engineKw: vehicleForOem.engineKw ?? null, vin: vehicleForOem.vin ?? null,
                    hsn: vehicleForOem.hsn ?? null, tsn: vehicleForOem.tsn ?? null,
                }, partText, partPosition);
            } else if (typeof (oemService as any).resolveOEM === 'function') {
                try {
                    const legacy = await (oemService as any).resolveOEM({
                        make: vehicleForOem.make, model: vehicleForOem.model,
                        year: vehicleForOem.year, engine: vehicleForOem.engine,
                        engineKw: vehicleForOem.engineKw, vin: vehicleForOem.vin,
                        hsn: vehicleForOem.hsn, tsn: vehicleForOem.tsn,
                    }, partText);
                    oemResult = {
                        primaryOEM: legacy.oemNumber ?? (legacy.oem ?? undefined),
                        overallConfidence: legacy.success ? 0.85 : 0,
                        candidates: legacy.oemData?.candidates ?? [],
                        notes: legacy.message ?? undefined,
                    };
                } catch (err: any) {
                    logger.warn('Legacy resolveOEM adapter failed', { orderId, error: err?.message });
                    oemResult = { primaryOEM: undefined, overallConfidence: 0, candidates: [], notes: undefined };
                }
            } else {
                logger.warn('No OEM resolver available', { orderId });
                oemResult = { primaryOEM: undefined, overallConfidence: 0, candidates: [], notes: undefined };
            }

            // Persist OEM result
            try {
                await updateOrderData(orderId, {
                    oemNumber: oemResult.primaryOEM ?? null, oemConfidence: oemResult.overallConfidence ?? null,
                    oemNotes: oemResult.notes ?? null, oemCandidates: oemResult.candidates ?? [],
                });
                try {
                    await updateOrderOEM(orderId, {
                        oemStatus: oemResult.primaryOEM ? 'resolved' : 'not_found',
                        oemError: oemResult.primaryOEM ? null : oemResult.notes ?? null,
                        oemData: oemResult, oemNumber: oemResult.primaryOEM ?? null,
                    });
                } catch (err: any) { logger.warn('Failed to persist OEM fields', { orderId, error: err?.message }); }
            } catch (err: any) { logger.warn('Failed to persist OEM resolver output', { orderId, error: err?.message }); }

            // Handle variant detection
            if (oemResult.variantDetected && oemResult.variantQuestion && oemResult.variants?.length) {
                logger.info('[OemLookupHandler] Variants detected', { orderId, variantCount: oemResult.variants.length });
                return {
                    reply: oemResult.variantQuestion,
                    nextStatus: 'awaiting_variant_selection' as ConversationStatus,
                    updatedOrderData: { pendingVariants: oemResult.variants, oemCandidates: oemResult.candidates ?? [] },
                };
            }

            // High confidence → scrape offers
            if (oemResult.primaryOEM && oemResult.overallConfidence >= 0.7) {
                const cautious = oemResult.overallConfidence < 0.9;
                try {
                    await scrapeOffersForOrder(orderId, oemResult.primaryOEM);
                    const cautionNote = cautious ? t('caution_check', language) : '';
                    return {
                        reply: `${t('oem_product_found', language)}${cautionNote}`,
                        nextStatus: 'show_offers',
                    };
                } catch (err: any) {
                    logger.error('Scrape after OEM failed', { error: err?.message, orderId });
                    return {
                        reply: t('oem_scrape_failed', language),
                        nextStatus: 'needs_human' as ConversationStatus,
                    };
                }
            }

            // Low confidence → escalate to dealer
            escalateToDealer({
                orderId,
                customerPhone: (order as any)?.customer_contact || 'unknown',
                reason: 'OEM-Nummer nicht sicher gefunden',
                vehicleSummary: `${vehicleForOem.make || '?'} ${vehicleForOem.model || '?'} (${vehicleForOem.year || '?'})`,
                partDescription: partText,
                oemNumber: oemResult.primaryOEM,
                oemConfidence: oemResult.overallConfidence,
                language,
            });
            return {
                reply: t('oem_product_uncertain', language),
                nextStatus: 'needs_human' as ConversationStatus,
            };
        } catch (err: any) {
            logger.error('resolveOEM failed', { error: err?.message, orderId });
            return {
                reply: t('oem_retry_prompt', language),
                nextStatus: 'oem_lookup',
            };
        }
    }
);
