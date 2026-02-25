/**
 * COLLECT DELIVERY PREFERENCE STATE HANDLER
 * 
 * Asks user: delivery or pickup?
 */

import { createHandler, StateContext, StateResult } from '../stateMachine';
import { t, tWith } from '../../botResponses';
import { logger } from '../../../../utils/logger';

const DELIVERY_PATTERNS = /liefer|deliver|teslimat|gihandin|dostaw|^d$/i;
const PICKUP_PATTERNS = /abhol|pickup|pick.?up|teslim al|werbigir|odbi|^p$/i;

export const collectDeliveryPreferenceHandler = createHandler(
    'CollectDeliveryPreferenceHandler',
    ['collect_delivery_preference'],
    async (ctx: StateContext): Promise<StateResult> => {
        const { order, language, userText } = ctx;
        const choice = userText.toLowerCase();

        if (DELIVERY_PATTERNS.test(choice)) {
            return {
                reply: t('delivery_ask_address', language),
                nextStatus: 'collect_address',
                shouldPersistStatus: true,
                updatedOrderData: { deliveryPreference: 'delivery' }
            };
        }

        if (PICKUP_PATTERNS.test(choice)) {
            const dealerLoc = "unseren Standort"; // TODO: from merchantSettings
            return {
                reply: tWith('pickup_location', language, { location: dealerLoc }),
                nextStatus: 'done',
                shouldPersistStatus: true,
                updatedOrderData: { deliveryPreference: 'pickup' }
            };
        }

        // Unclear choice
        return {
            reply: t('delivery_or_pickup', language),
            nextStatus: 'collect_delivery_preference',
            shouldPersistStatus: false
        };
    }
);
