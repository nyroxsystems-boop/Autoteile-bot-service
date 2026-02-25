/**
 * COLLECT ADDRESS STATE HANDLER
 * 
 * Collects delivery address from user text.
 */

import { createHandler, StateContext, StateResult } from '../stateMachine';
import { t } from '../../botResponses';
import { logger } from '../../../../utils/logger';

export const collectAddressHandler = createHandler(
    'CollectAddressHandler',
    ['collect_address'],
    async (ctx: StateContext): Promise<StateResult> => {
        const { order, language, userText } = ctx;

        if (userText.length > 10) {
            logger.info("Address collected", { orderId: order.id, addressLen: userText.length });

            return {
                reply: t('address_saved', language),
                nextStatus: 'done',
                shouldPersistStatus: true,
                updatedOrderData: { deliveryAddress: userText }
            };
        }

        // Too short to be an address
        return {
            reply: t('address_invalid', language),
            nextStatus: 'collect_address',
            shouldPersistStatus: false
        };
    }
);
