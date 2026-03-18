/**
 * SHOW OFFERS STATE HANDLER
 *
 * Loads, formats, and displays shop offers to the customer.
 * Extracted from botLogicService.ts lines 1490-1608.
 */

import { createHandler, StateContext, StateResult } from '../stateMachine';
import { ConversationStatus, listShopOffersByOrderId, updateOrderData } from '../../../adapters/supabaseService';
import { calculateEndPrice } from '../../botHelpers';
import { t, tWith } from '../../botResponses';
import { logger } from '../../../../utils/logger';

export const showOffersHandler = createHandler(
    'ShowOffersHandler',
    ['show_offers'],
    async (ctx: StateContext): Promise<StateResult> => {
        const { orderId, order, orderData, language } = ctx;

        try {
            const offers = await listShopOffersByOrderId(orderId);
            const sorted = (offers ?? []).slice().sort((a: any, b: any) => {
                const pa = a.price ?? Number.POSITIVE_INFINITY;
                const pb = b.price ?? Number.POSITIVE_INFINITY;
                return pa - pb;
            });

            logger.info('Show offers', { orderId, offersCount: sorted.length });

            if (!sorted || sorted.length === 0) {
                // Track attempts to avoid infinite loop
                const collectAttempts = (orderData?.offerCollectAttempts ?? 0) + 1;

                if (collectAttempts >= 3) {
                    return {
                        reply: t('offers_escalate', language),
                        nextStatus: 'needs_human' as ConversationStatus,
                        updatedOrderData: { offerCollectAttempts: collectAttempts },
                    };
                }

                return {
                    reply: t('offer_collecting', language),
                    nextStatus: 'show_offers',
                    updatedOrderData: { offerCollectAttempts: collectAttempts },
                };
            }

            // Reset counter on success
            const resetData: Record<string, any> = { offerCollectAttempts: 0 };

            // Single offer → direct confirmation
            if (sorted.length === 1) {
                const offer = sorted[0] as any;
                const endPrice = calculateEndPrice(offer.price);
                const delivery = offer.deliveryTimeDays ?? t('na_text', language);
                const bindingNote = t('offer_binding_note', language);

                const oemDisplay = orderData?.oemNumber ? `🔧 *OEM:* ${orderData.oemNumber}\n` : '';
                const vehicleSummary = orderData?.vehicle
                    ? `🚗 ${orderData.vehicle.make || ''} ${orderData.vehicle.model || ''} (${orderData.vehicle.year || ''})\n`
                    : '';

                const isInStock = offer.shopName === 'Händler-Lager' || offer.shopName === 'Eigener Bestand' || offer.shopName === '✨ Eigenes Lager';
                const stockInfo = isInStock
                    ? t('offer_pickup', language)
                    : tWith('offer_delivery', language, { delivery });

                const reply =
                    `${t('offer_single_header', language)}\n\n` +
                    `${vehicleSummary}` +
                    `${oemDisplay}` +
                    `🏷️ *${t('offer_brand_label', language)}:* ${offer.brand ?? t('na_text', language)}\n` +
                    `💰 *${t('offer_price_label', language)}:* ${endPrice} ${offer.currency}\n` +
                    `${stockInfo}\n` +
                    `${offer.availability && !isInStock ? `📦 *${t('offer_stock_label', language)}:* ${offer.availability}\n` : ''}` +
                    `${bindingNote}\n\n` +
                    `${t('offer_order_prompt', language)}`;

                return {
                    reply,
                    nextStatus: 'await_offer_confirmation',
                    updatedOrderData: { ...resetData, selectedOfferCandidateId: offer.id },
                };
            }

            // Multiple offers → show top 3
            const top = sorted.slice(0, 3);
            const lines = top.map((o: any, idx: number) => {
                const isInStock = o.shopName === 'Händler-Lager' || o.shopName === 'Eigener Bestand';
                const dayLabel = language === 'de' ? 'Tage' : language === 'en' ? 'days' : language === 'tr' ? 'gün' : language === 'pl' ? 'dni' : 'roj';
                const deliveryInfo = isInStock
                    ? t('offer_instant', language)
                    : `🚚 ${o.deliveryTimeDays ?? t('na_text', language)} ${dayLabel}`;
                return `*${idx + 1}.* 🏷️ ${o.brand ?? t('na_text', language)}\n` +
                    `   💰 ${calculateEndPrice(o.price)} ${o.currency} | ${deliveryInfo}`;
            });

            const multiBindingNote = t('offer_multi_binding', language);
            const reply =
                t('offer_multi_header', language) + '\n\n' +
                lines.join('\n\n') +
                multiBindingNote +
                '\n\n' + t('offer_choose_prompt', language);

            return {
                reply,
                nextStatus: 'await_offer_choice',
                updatedOrderData: { ...resetData, offerChoiceIds: top.map((o: any) => o.id) },
            };
        } catch (err: any) {
            logger.error('Fetching offers failed', { error: err?.message, orderId });
            return {
                reply: t('offer_fetch_failed', language),
                nextStatus: 'show_offers',
            };
        }
    }
);
