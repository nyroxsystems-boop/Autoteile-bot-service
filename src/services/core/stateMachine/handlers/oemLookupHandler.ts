/**
 * OEM LOOKUP STATE HANDLER
 * 
 * Delegates to the existing resolveOEM pipeline.
 * This is a thin wrapper — the heavy logic stays in botLogicService.
 */

import { createHandler, StateContext, StateResult } from '../stateMachine';
import { logger } from '../../../../utils/logger';

export const oemLookupHandler = createHandler(
    'OemLookupHandler',
    ['oem_lookup'],
    async (ctx: StateContext): Promise<StateResult> => {
        const { order } = ctx;

        logger.info('OEM lookup state reached — delegating to legacy', { orderId: order.id });

        // OEM lookup involves complex multi-source resolution, scraping, etc.
        // Delegate to legacy handler by returning empty reply
        return {
            reply: '',
            nextStatus: 'oem_lookup',
            shouldPersistStatus: false,
            updatedOrderData: { _useLegacyHandler: true }
        };
    }
);
