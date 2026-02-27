/**
 * GEMINI API CALL BUDGET
 * 
 * AUDIT FIX: Limits the number of Gemini API calls per incoming message.
 * Without this, a single user message could trigger 15-20 Gemini calls,
 * costing $0.15-0.35 per request.
 * 
 * Usage:
 *   await withGeminiBudget(8, async () => {
 *     // All Gemini calls within this block share a budget of 8
 *     await processMessage(...);
 *   });
 * 
 * Inside any Gemini call:
 *   if (!acquireBudgetToken()) throw new BudgetExhaustedError();
 */

import { AsyncLocalStorage } from 'async_hooks';
import { logger } from '@utils/logger';

// ============================================================================
// Types
// ============================================================================

interface BudgetContext {
    maxCalls: number;
    usedCalls: number;
    requestId?: string;
}

export class BudgetExhaustedError extends Error {
    constructor(maxCalls: number, requestId?: string) {
        super(`Gemini API budget exhausted: ${maxCalls} calls used (requestId: ${requestId || 'unknown'})`);
        this.name = 'BudgetExhaustedError';
    }
}

// ============================================================================
// AsyncLocalStorage for per-request budgets
// ============================================================================

const budgetStorage = new AsyncLocalStorage<BudgetContext>();

/**
 * Run a function with a Gemini API call budget.
 * All Gemini calls within this scope share the budget.
 */
export async function withGeminiBudget<T>(
    maxCalls: number,
    fn: () => Promise<T>,
    requestId?: string
): Promise<T> {
    const ctx: BudgetContext = { maxCalls, usedCalls: 0, requestId };
    return budgetStorage.run(ctx, fn);
}

/**
 * Try to acquire a budget token. Returns true if allowed, false if budget exhausted.
 * Safe to call outside a budget context (always returns true).
 */
export function acquireBudgetToken(): boolean {
    const ctx = budgetStorage.getStore();
    if (!ctx) return true; // No budget context = unlimited (backwards compat)

    if (ctx.usedCalls >= ctx.maxCalls) {
        logger.warn('[GeminiBudget] Budget exhausted', {
            maxCalls: ctx.maxCalls,
            usedCalls: ctx.usedCalls,
            requestId: ctx.requestId,
        });
        return false;
    }

    ctx.usedCalls++;

    if (ctx.usedCalls >= ctx.maxCalls - 1) {
        logger.info('[GeminiBudget] Budget nearly exhausted', {
            usedCalls: ctx.usedCalls,
            maxCalls: ctx.maxCalls,
            requestId: ctx.requestId,
        });
    }

    return true;
}

/**
 * Get remaining budget. Returns Infinity if no budget context.
 */
export function getRemainingBudget(): number {
    const ctx = budgetStorage.getStore();
    if (!ctx) return Infinity;
    return Math.max(0, ctx.maxCalls - ctx.usedCalls);
}

/**
 * Get current budget stats (for logging/debugging).
 */
export function getBudgetStats(): { usedCalls: number; maxCalls: number; requestId?: string } | null {
    const ctx = budgetStorage.getStore();
    if (!ctx) return null;
    return { usedCalls: ctx.usedCalls, maxCalls: ctx.maxCalls, requestId: ctx.requestId };
}

export default {
    withGeminiBudget,
    acquireBudgetToken,
    getRemainingBudget,
    getBudgetStats,
    BudgetExhaustedError,
};
