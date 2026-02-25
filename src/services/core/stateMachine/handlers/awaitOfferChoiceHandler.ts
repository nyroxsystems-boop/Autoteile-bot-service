/**
 * AWAIT OFFER CHOICE STATE HANDLER
 * 
 * Parses user's number selection from multi-offer list.
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

export const awaitOfferChoiceHandler = createHandler(
    'AwaitOfferChoiceHandler',
    ['await_offer_choice'],
    async (ctx: StateContext): Promise<StateResult> => {
        const { order, orderData, language, userText } = ctx;
        const txt = (userText || "").trim().toLowerCase();

        let choiceIndex: number | null = null;
        if (txt.includes("1")) choiceIndex = 0;
        else if (txt.includes("2")) choiceIndex = 1;
        else if (txt.includes("3")) choiceIndex = 2;

        logger.info("User offer choice", { orderId: order.id, text: userText });

        const choiceIds: string[] | undefined = orderData?.offerChoiceIds;
        if (choiceIndex === null || !choiceIds || choiceIndex < 0 || choiceIndex >= choiceIds.length) {
            return {
                reply: t('offer_choice_invalid', language),
                nextStatus: 'await_offer_choice',
                shouldPersistStatus: false
            };
        }

        const chosenOfferId = choiceIds[choiceIndex];
        const offers = await listShopOffersByOrderId(order.id);
        const chosen = offers.find((o: any) => o.id === chosenOfferId);

        if (!chosen) {
            return {
                reply: t('offer_choice_not_found', language),
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
            logger.error("Failed to store selected offer", { error: err?.message, orderId: order.id });
        }

        logger.info("User selected offer", {
            orderId: order.id,
            choiceIndex,
            chosenOfferId: chosen.id,
            chosenShop: chosen.shopName,
            price: chosen.price
        });

        return {
            reply: tWith('offer_confirmed_choice', language, { orderId: order.id }),
            nextStatus: 'done',
            shouldPersistStatus: true
        };
    }
);
