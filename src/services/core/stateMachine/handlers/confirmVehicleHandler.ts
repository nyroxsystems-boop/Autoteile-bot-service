/**
 * CONFIRM VEHICLE STATE HANDLER
 * 
 * Handles user confirmation of detected vehicle (yes/no).
 */

import { createHandler, StateContext, StateResult } from '../stateMachine';
import { ConversationStatus, updateOrderData, getVehicleForOrder } from '../../../adapters/supabaseService';
import { t } from '../../botResponses';
import { logger } from '../../../../utils/logger';

const YES_PATTERNS = /^(ja|yes|jo|jup|correct|korrekt|stimmt|y|evet|erê|tak)$/i;

export const confirmVehicleHandler = createHandler(
    'ConfirmVehicleHandler',
    ['confirm_vehicle'],
    async (ctx: StateContext): Promise<StateResult> => {
        const { order, orderData, language, userText } = ctx;

        const isYes = YES_PATTERNS.test(userText.trim());

        if (isYes) {
            try {
                await updateOrderData(order.id, { vehicleConfirmed: true });
            } catch (err: any) {
                logger.error("Failed to store vehicle confirmation", { orderId: order.id, error: err?.message });
            }

            const partName = orderData?.requestedPart || orderData?.partText;
            if (partName) {
                // Have vehicle + part → delegate to OEM lookup via legacy
                // Return empty reply to signal delegation
                return {
                    reply: '',
                    nextStatus: 'oem_lookup',
                    shouldPersistStatus: true,
                    updatedOrderData: { vehicleConfirmed: true, _delegateOemLookup: true }
                };
            }

            return {
                reply: t('confirm_vehicle_yes', language),
                nextStatus: 'collect_part',
                shouldPersistStatus: true,
                updatedOrderData: { vehicleConfirmed: true }
            };
        }

        // User says no → back to collect_vehicle
        return {
            reply: t('vehicle_correction', language),
            nextStatus: 'collect_vehicle',
            shouldPersistStatus: true
        };
    }
);
