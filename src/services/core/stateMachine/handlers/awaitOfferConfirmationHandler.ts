/**
 * AWAIT OFFER CONFIRMATION STATE HANDLER
 * 
 * Handles binding yes/no confirmation for single-offer flow.
 */

import { createHandler, StateContext, StateResult } from '../stateMachine';
import {
    updateOrderData,
    updateOrderStatus,
    listShopOffersByOrderId,
} from '../../../adapters/supabaseService';
import { t, tWith } from '../../botResponses';
import { logger } from '../../../../utils/logger';

function calculateEndPrice(price: number, marginPercent?: number): string {
    const p = Number(price ?? 0);
    const margin = marginPercent ?? 0;
    return (Math.round(p * (1 + margin / 100) * 100) / 100).toFixed(2);
}

const YES_WORDS = ["ja", "okay", "ok", "passt", "yes", "yep", "okey", "evet", "erê", "tak"];
const NO_WORDS = ["nein", "no", "nicht", "anders", "hayır", "na", "nie"];

export const awaitOfferConfirmationHandler = createHandler(
    'AwaitOfferConfirmationHandler',
    ['await_offer_confirmation'],
    async (ctx: StateContext): Promise<StateResult> => {
        const { order, orderData, language, userText } = ctx;
        const txt = (userText || "").trim().toLowerCase();

        const isYes = YES_WORDS.some(w => txt.includes(w));
        const isNo = NO_WORDS.some(w => txt.includes(w));
        const candidateId = orderData?.selectedOfferCandidateId as string | undefined;

        logger.info("Offer confirmation", {
            orderId: order.id,
            text: userText,
            isYes,
            isNo,
            candidateOfferId: candidateId
        });

        if (!isYes && !isNo) {
            return {
                reply: t('offer_confirm_prompt', language),
                nextStatus: 'await_offer_confirmation',
                shouldPersistStatus: false
            };
        }

        if (isNo) {
            return {
                reply: t('offer_decline_alt', language),
                nextStatus: 'show_offers',
                shouldPersistStatus: true
            };
        }

        if (!candidateId) {
            return {
                reply: t('offer_lost', language),
                nextStatus: 'show_offers',
                shouldPersistStatus: true
            };
        }

        const offers = await listShopOffersByOrderId(order.id);
        const chosen = offers.find((o: any) => o.id === candidateId);

        if (!chosen) {
            return {
                reply: t('offer_not_found', language),
                nextStatus: 'show_offers',
                shouldPersistStatus: true
            };
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
            logger.error("Failed to store confirmed offer", { error: err?.message, orderId: order.id });
        }

        logger.info("Offer confirmed", {
            orderId: order.id,
            selectedOfferId: chosen.id,
            statusUpdatedTo: "ready"
        });

        return {
            reply: tWith('offer_confirmed', language, { orderId: order.id }),
            nextStatus: 'collect_delivery_preference',
            shouldPersistStatus: true
        };
    }
);
