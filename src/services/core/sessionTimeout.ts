/**
 * ⏰ SESSION TIMEOUT — Proactive follow-up for inactive conversations
 *
 * P1 #9: Sends a "Sind Sie noch da?" message after 24h inactivity.
 * Runs as a periodic check (every hour).
 *
 * Usage: import { startSessionTimeoutChecker } from './sessionTimeout';
 *        startSessionTimeoutChecker(); // Call once at startup
 */

import { logger } from '@utils/logger';
import { t } from '@core/botResponses';

// In-memory tracking of last activity per waId
const lastActivity = new Map<string, { timestamp: number; orderId: string; language: string | null }>();

const TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
const FOLLOWUP_COOLDOWN_MS = 48 * 60 * 60 * 1000; // Don't send again for 48h

// Track which waIds already got a follow-up (prevent spam)
const followUpSent = new Map<string, number>();

/**
 * Record activity for a conversation.
 * Call this from botWorker or botLogicService on every incoming message.
 */
export function recordActivity(waId: string, orderId: string, language: string | null): void {
    lastActivity.set(waId, {
        timestamp: Date.now(),
        orderId,
        language,
    });
    // Clear follow-up flag on new activity
    followUpSent.delete(waId);
}

/**
 * Get all conversations that have been inactive for > 24h.
 * Returns only conversations that haven't already received a follow-up.
 */
export function getTimedOutSessions(): Array<{ waId: string; orderId: string; language: string | null; inactiveMs: number }> {
    const now = Date.now();
    const timedOut: Array<{ waId: string; orderId: string; language: string | null; inactiveMs: number }> = [];

    for (const [waId, data] of lastActivity.entries()) {
        const inactiveMs = now - data.timestamp;
        const lastFollowUp = followUpSent.get(waId) || 0;

        if (inactiveMs > TIMEOUT_MS && (now - lastFollowUp) > FOLLOWUP_COOLDOWN_MS) {
            timedOut.push({
                waId,
                orderId: data.orderId,
                language: data.language,
                inactiveMs,
            });
        }
    }

    return timedOut;
}

/**
 * Mark a session as having received a follow-up.
 */
export function markFollowUpSent(waId: string): void {
    followUpSent.set(waId, Date.now());
}

/**
 * Get the timeout follow-up message for a given language.
 */
export function getTimeoutMessage(language: string | null): string {
    return t('session_timeout', language);
}

/**
 * Start the periodic session timeout checker.
 * The checker calls the provided `sendMessage` callback for each timed-out session.
 *
 * @param sendMessage — Callback to send a WhatsApp message (waId, message) => Promise
 */
export function startSessionTimeoutChecker(
    sendMessage: (waId: string, message: string) => Promise<void>
): NodeJS.Timeout {
    const intervalId = setInterval(async () => {
        try {
            const timedOut = getTimedOutSessions();
            if (timedOut.length === 0) return;

            logger.info('[SessionTimeout] Found inactive sessions', { count: timedOut.length });

            for (const session of timedOut) {
                try {
                    const message = getTimeoutMessage(session.language);
                    await sendMessage(session.waId, message);
                    markFollowUpSent(session.waId);
                    logger.info('[SessionTimeout] Follow-up sent', { waId: session.waId, orderId: session.orderId });
                } catch (err: any) {
                    logger.error('[SessionTimeout] Failed to send follow-up', {
                        waId: session.waId,
                        error: err?.message,
                    });
                }
            }
        } catch (err: any) {
            logger.error('[SessionTimeout] Checker error', { error: err?.message });
        }
    }, CHECK_INTERVAL_MS);

    logger.info('[SessionTimeout] Checker started (interval: 1h, timeout: 24h)');
    return intervalId;
}

/**
 * Clean up old entries to prevent memory leaks.
 * Called automatically; removes entries older than 7 days.
 */
export function cleanupOldEntries(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    for (const [waId, data] of lastActivity.entries()) {
        if (data.timestamp < cutoff) {
            lastActivity.delete(waId);
            followUpSent.delete(waId);
        }
    }
}

// Auto-cleanup every 6 hours
setInterval(cleanupOldEntries, 6 * 60 * 60 * 1000);
