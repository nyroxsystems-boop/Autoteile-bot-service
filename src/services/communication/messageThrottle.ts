/**
 * 📱 MESSAGE THROTTLING SERVICE
 *
 * Prevents flooding the user with multiple rapid bot responses.
 * Groups closely-timed outbound messages and enforces rate limits.
 *
 * Rules:
 * - Max 1 message per 2 seconds per user (configurable)
 * - Queues excess messages with spacing
 * - Deduplication: identical messages within 10s are dropped
 */

import { logger } from '@utils/logger';

// ============================================================================
// Configuration
// ============================================================================

const MIN_INTERVAL_MS = 2000;   // Minimum gap between messages to same user
const DEDUP_WINDOW_MS = 10000;  // Ignore duplicate messages within this window

// ============================================================================
// State
// ============================================================================

interface ThrottleState {
    lastSentAt: number;
    recentMessages: Map<string, number>; // hash → timestamp
}

const userThrottles = new Map<string, ThrottleState>();

function getState(userId: string): ThrottleState {
    if (!userThrottles.has(userId)) {
        userThrottles.set(userId, {
            lastSentAt: 0,
            recentMessages: new Map(),
        });
    }
    return userThrottles.get(userId)!;
}

function simpleHash(str: string): string {
    // Quick hash for dedup — not cryptographic
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return String(Math.abs(hash));
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if a message should be sent or throttled.
 * Returns the delay in ms to wait before sending (0 = send immediately).
 * Returns -1 if the message should be dropped (duplicate).
 */
export function shouldSendMessage(
    userId: string,
    messageText: string
): number {
    const state = getState(userId);
    const now = Date.now();

    // 1. Deduplication: check for identical recent messages
    const msgHash = simpleHash(messageText.substring(0, 200));
    const lastSent = state.recentMessages.get(msgHash);
    if (lastSent && now - lastSent < DEDUP_WINDOW_MS) {
        logger.debug('[Throttle] Duplicate message suppressed', { userId, hash: msgHash });
        return -1; // Drop
    }

    // 2. Rate limiting: enforce minimum interval
    const elapsed = now - state.lastSentAt;
    if (elapsed < MIN_INTERVAL_MS) {
        const delay = MIN_INTERVAL_MS - elapsed;
        logger.debug('[Throttle] Rate limiting applied', { userId, delay });
        return delay;
    }

    return 0; // Send immediately
}

/**
 * Record that a message was sent (call AFTER actually sending).
 */
export function recordMessageSent(userId: string, messageText: string): void {
    const state = getState(userId);
    const now = Date.now();

    state.lastSentAt = now;

    const msgHash = simpleHash(messageText.substring(0, 200));
    state.recentMessages.set(msgHash, now);

    // Cleanup old entries (prevent memory leak)
    if (state.recentMessages.size > 50) {
        const cutoff = now - DEDUP_WINDOW_MS;
        for (const [hash, ts] of state.recentMessages.entries()) {
            if (ts < cutoff) state.recentMessages.delete(hash);
        }
    }
}

/**
 * Convenience: Apply throttle, wait if needed, then execute send function.
 * Returns false if the message was dropped (duplicate).
 */
export async function throttledSend(
    userId: string,
    messageText: string,
    sendFn: () => Promise<void>
): Promise<boolean> {
    const delay = shouldSendMessage(userId, messageText);

    if (delay === -1) {
        return false; // Duplicate — dropped
    }

    if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    await sendFn();
    recordMessageSent(userId, messageText);
    return true;
}

// ============================================================================
// Cleanup (call periodically or on graceful shutdown)
// ============================================================================

export function cleanupThrottleState(): void {
    const cutoff = Date.now() - 60000; // Remove users inactive for 1 min
    for (const [userId, state] of userThrottles.entries()) {
        if (state.lastSentAt < cutoff) {
            userThrottles.delete(userId);
        }
    }
}
