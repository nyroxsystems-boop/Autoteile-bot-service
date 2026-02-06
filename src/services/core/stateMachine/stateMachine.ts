/**
 * STATE MACHINE ARCHITECTURE
 * 
 * This module defines the conversation state machine pattern.
 * Each ConversationStatus maps to a StateHandler that handles
 * user messages in that state.
 * 
 * Benefits:
 * - Each state handler is isolated and testable
 * - State transitions are explicit
 * - Reduces the 2700-line monolith to focused handlers
 */

import { ConversationStatus } from '../../adapters/supabaseService';
import { logger } from '../../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface StateContext {
    orderId: string;
    order: any;
    orderData: any;
    language: 'de' | 'en' | 'tr' | 'ku' | 'pl';
    userText: string;
    parsed: any;  // ParsedUserMessage
    mediaUrls?: string[];
    currentStatus: ConversationStatus;
}

export interface StateResult {
    reply: string;
    nextStatus: ConversationStatus;
    updatedOrderData?: Record<string, any>;
    shouldPersistStatus?: boolean;
}

export interface StateHandler {
    readonly name: string;
    readonly handles: ConversationStatus[];
    handle(ctx: StateContext): Promise<StateResult>;
}

// ============================================================================
// State Handler Registry
// ============================================================================

const handlers = new Map<ConversationStatus, StateHandler>();

export function registerHandler(handler: StateHandler): void {
    for (const status of handler.handles) {
        if (handlers.has(status)) {
            logger.warn('State handler already registered', {
                status,
                existing: handlers.get(status)?.name,
                new: handler.name
            });
        }
        handlers.set(status, handler);
        logger.debug('Registered state handler', { status, handler: handler.name });
    }
}

export function getHandler(status: ConversationStatus): StateHandler | null {
    return handlers.get(status) ?? null;
}

export function listRegisteredStates(): ConversationStatus[] {
    return Array.from(handlers.keys());
}

// ============================================================================
// State Machine Executor
// ============================================================================

export async function executeState(
    status: ConversationStatus,
    ctx: StateContext
): Promise<StateResult> {
    const handler = getHandler(status);

    if (!handler) {
        logger.error('No handler for state', { status, orderId: ctx.orderId });
        return {
            reply: ctx.language === 'de'
                ? 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.'
                : 'An unexpected error occurred. Please try again.',
            nextStatus: status,
            shouldPersistStatus: false
        };
    }

    logger.info('Executing state handler', {
        handler: handler.name,
        status,
        orderId: ctx.orderId
    });

    try {
        const result = await handler.handle(ctx);

        logger.info('State handler complete', {
            handler: handler.name,
            orderId: ctx.orderId,
            nextStatus: result.nextStatus,
            transitioned: result.nextStatus !== status
        });

        return result;
    } catch (err: any) {
        logger.error('State handler failed', {
            handler: handler.name,
            status,
            orderId: ctx.orderId,
            error: err?.message,
            stack: err?.stack?.split('\n').slice(0, 3).join('\n')
        });

        return {
            reply: ctx.language === 'de'
                ? 'Etwas ist schiefgelaufen. Bitte versuche es noch einmal.'
                : 'Something went wrong. Please try again.',
            nextStatus: status,
            shouldPersistStatus: false
        };
    }
}

// ============================================================================
// Helper: Create handler factory
// ============================================================================

export function createHandler(
    name: string,
    handles: ConversationStatus[],
    handler: (ctx: StateContext) => Promise<StateResult>
): StateHandler {
    return {
        name,
        handles,
        handle: handler
    };
}
