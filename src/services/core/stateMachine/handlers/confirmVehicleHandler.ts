/**
 * CONFIRM VEHICLE STATE HANDLER
 *
 * Handles user confirmation of detected vehicle (yes/no).
 * Uses AI detection for ambiguous messages.
 * Extracted from botLogicService.ts lines 1226-1293.
 */

import { createHandler, StateContext, StateResult } from '../stateMachine';
import { ConversationStatus, updateOrderData, getVehicleForOrder } from '../../../adapters/supabaseService';
import { generateChatCompletion } from '../../../intelligence/geminiService';
import { t, tWith } from '../../botResponses';
import { logger } from '../../../../utils/logger';

const QUICK_YES = /^(ja|yes|jo|jup|jupp|correct|korrekt|stimmt|richtig|genau|jawohl|passt|ok|okay|jap|jaa|y|si|evet|erê|tak|1)$/i;
const QUICK_NO = /^(nein|no|falsch|wrong|hayır|na|nie|nee|0)$/i;

export const confirmVehicleHandler = createHandler(
    'ConfirmVehicleHandler',
    ['confirm_vehicle'],
    async (ctx: StateContext): Promise<StateResult> => {
        const { orderId, order, orderData, language, userText } = ctx;
        const trimmed = userText.trim();

        let isConfirmed = false;

        // Quick regex check first (saves an API call for obvious cases)
        if (QUICK_YES.test(trimmed)) {
            isConfirmed = true;
        } else if (QUICK_NO.test(trimmed)) {
            isConfirmed = false;
        } else {
            // Use AI to detect confirmation intent for ambiguous messages
            try {
                const confirmResult = await generateChatCompletion({
                    messages: [
                        {
                            role: 'system',
                            content: 'You classify user messages as confirmation (YES) or rejection (NO). The user was asked: "Is your vehicle correct?" Respond with ONLY "YES" or "NO". If the message is unclear or unrelated, respond "YES" if it seems positive, "NO" if negative.',
                        },
                        { role: 'user', content: userText },
                    ],
                    temperature: 0.1,
                });
                const aiAnswer = (confirmResult || '').trim().toUpperCase();
                isConfirmed = aiAnswer.startsWith('YES') || aiAnswer.startsWith('JA');
                logger.info('[confirmVehicle] AI confirmation detection', {
                    userText: userText.substring(0, 50),
                    aiAnswer,
                    isConfirmed,
                });
            } catch (err: any) {
                // AI failed — heuristic fallback
                logger.warn('[confirmVehicle] AI detection failed, using heuristic', { error: err?.message });
                isConfirmed = !/nein|no|falsch|wrong|nicht|stop/i.test(userText);
            }
        }

        if (isConfirmed) {
            // Mark vehicle as confirmed
            const updatedData: Record<string, any> = { vehicleConfirmed: true };

            // Check if we also have a part → go directly to OEM
            const partName = orderData?.requestedPart || orderData?.partText;
            if (partName) {
                // Vehicle confirmed + part known → proceed to OEM lookup
                return {
                    reply: '', // Will be handled by oemLookupHandler
                    nextStatus: 'oem_lookup',
                    shouldPersistStatus: true,
                    updatedOrderData: updatedData,
                };
            }

            return {
                reply: t('confirm_vehicle_yes', language),
                nextStatus: 'collect_part',
                shouldPersistStatus: true,
                updatedOrderData: updatedData,
            };
        }

        // User says no → back to collect_vehicle
        return {
            reply: t('vehicle_correction', language),
            nextStatus: 'collect_vehicle',
            shouldPersistStatus: true,
        };
    }
);
