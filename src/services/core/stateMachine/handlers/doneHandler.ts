/**
 * DONE STATE HANDLER
 * 
 * Handles post-completion interactions: goodbye, new part for same vehicle,
 * or fresh start with different vehicle.
 */

import { createHandler, StateContext, StateResult } from '../stateMachine';
import { t, tWith } from '../../botResponses';
import { logger } from '../../../../utils/logger';

const NEW_PART_KEYWORDS = [
    "brauche auch", "noch ein", "außerdem", "dazu noch", "zusätzlich",
    "another", "also need", "bir de", "hê jî", "jeszcze",
    "bremsbeläge", "scheiben", "filter", "zündkerzen", "kupplung"
];

const FRESH_START_KEYWORDS = [
    "neues auto", "anderes auto", "new car", "different vehicle",
    "von vorn", "başka araç", "wesayîtek din", "inny samochód"
];

const GOODBYE_KEYWORDS = [
    "danke", "thanks", "tschüss", "bye", "super", "perfekt", "ok",
    "teşekkür", "spas", "dziękuję"
];

export const doneHandler = createHandler(
    'DoneHandler',
    ['done'],
    async (ctx: StateContext): Promise<StateResult> => {
        const { order, orderData, language, userText } = ctx;
        const txt = userText.toLowerCase();

        const wantsFreshStart = FRESH_START_KEYWORDS.some(k => txt.includes(k));
        const wantsNewPart = NEW_PART_KEYWORDS.some(k => txt.includes(k)) ||
            (txt.length > 5 && !txt.includes("?") && !txt.includes("danke") && !txt.includes("thanks"));
        const isGoodbye = GOODBYE_KEYWORDS.some(k => txt.includes(k));

        if (wantsFreshStart) {
            return {
                reply: t('fresh_start', language),
                nextStatus: 'collect_vehicle',
                shouldPersistStatus: true
            };
        }

        if (wantsNewPart && order.vehicle_description) {
            // Signal to legacy handler to create new order with copied vehicle
            return {
                reply: tWith('follow_up_part', language, {
                    make: orderData?.vehicle?.make || '',
                    model: orderData?.vehicle?.model || ''
                }),
                nextStatus: 'collect_part',
                shouldPersistStatus: true,
                updatedOrderData: { _createFollowUpOrder: true }
            };
        }

        if (isGoodbye) {
            return {
                reply: t('goodbye', language),
                nextStatus: 'done',
                shouldPersistStatus: false
            };
        }

        // Default: order complete message
        return {
            reply: t('order_complete', language),
            nextStatus: 'done',
            shouldPersistStatus: false
        };
    }
);
