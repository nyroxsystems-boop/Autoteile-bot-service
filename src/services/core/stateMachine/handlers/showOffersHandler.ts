/**
 * SHOW OFFERS STATE HANDLER
 * 
 * Loads and formats shop offers for the user.
 * Delegates to legacy handler due to complex offer formatting.
 */

import { createHandler, StateContext, StateResult } from '../stateMachine';
import { logger } from '../../../../utils/logger';

export const showOffersHandler = createHandler(
    'ShowOffersHandler',
    ['show_offers'],
    async (ctx: StateContext): Promise<StateResult> => {
        const { order } = ctx;

        logger.info('Show offers state — delegating to legacy', { orderId: order.id });

        // Offer formatting involves calculateEndPrice, merchant margins,
        // complex WhatsApp card templates with buttons, and image attach.
        // Delegate to legacy handler.
        return {
            reply: '',
            nextStatus: 'show_offers',
            shouldPersistStatus: false,
            updatedOrderData: { _useLegacyHandler: true }
        };
    }
);
