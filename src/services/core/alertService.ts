/**
 * 🚨 ALERT SERVICE - Production Monitoring
 *
 * Sends alerts via webhook (Slack/Discord) when critical events occur.
 * Gracefully degrades to logger-only when no webhook is configured.
 *
 * Features:
 * - Deduplication: same alert key max once per 5 minutes
 * - Supports Slack and Discord webhook formats
 * - Non-blocking: never throws, never crashes the caller
 */

import { logger } from '@utils/logger';
import fetch from 'node-fetch';

// ============================================================================
// Types
// ============================================================================

type AlertLevel = 'warn' | 'error' | 'critical';

interface AlertPayload {
    level: AlertLevel;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
}

// ============================================================================
// Deduplication Cache
// ============================================================================

const recentAlerts = new Map<string, number>(); // alertKey → timestamp
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function isDuplicate(key: string): boolean {
    const lastSent = recentAlerts.get(key);
    if (lastSent && Date.now() - lastSent < DEDUP_WINDOW_MS) {
        return true;
    }
    recentAlerts.set(key, Date.now());

    // Cleanup old entries (prevent memory leak)
    if (recentAlerts.size > 100) {
        const cutoff = Date.now() - DEDUP_WINDOW_MS;
        for (const [k, v] of recentAlerts.entries()) {
            if (v < cutoff) recentAlerts.delete(k);
        }
    }

    return false;
}

// ============================================================================
// Webhook Sender
// ============================================================================

const WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;

async function sendWebhook(payload: AlertPayload): Promise<void> {
    if (!WEBHOOK_URL) return;

    const emoji = payload.level === 'critical' ? '🔴' : payload.level === 'error' ? '🟠' : '🟡';
    const text = `${emoji} **[PartsUnion ${payload.level.toUpperCase()}]** ${payload.message}${payload.details ? '\n```json\n' + JSON.stringify(payload.details, null, 2).slice(0, 500) + '\n```' : ''
        }`;

    try {
        // Auto-detect Slack vs Discord format
        const isSlack = WEBHOOK_URL.includes('hooks.slack.com');
        const body = isSlack
            ? JSON.stringify({ text })
            : JSON.stringify({ content: text }); // Discord format

        await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            timeout: 5000,
        });
    } catch (err: any) {
        // Never crash — alert failure must not affect the main flow
        logger.warn('[AlertService] Webhook delivery failed', { error: err?.message });
    }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Send an alert. Non-blocking, never throws.
 * Same alertKey is deduplicated within a 5-minute window.
 */
export async function sendAlert(
    level: AlertLevel,
    message: string,
    details?: Record<string, any>
): Promise<void> {
    const alertKey = `${level}:${message}`;

    if (isDuplicate(alertKey)) {
        logger.debug('[AlertService] Suppressed duplicate alert', { alertKey });
        return;
    }

    const payload: AlertPayload = {
        level,
        message,
        details,
        timestamp: new Date().toISOString(),
    };

    // Always log
    if (level === 'critical' || level === 'error') {
        logger.error(`[ALERT] ${message}`, details);
    } else {
        logger.warn(`[ALERT] ${message}`, details);
    }

    // Send webhook (fire and forget)
    sendWebhook(payload).catch(() => { });
}

// ============================================================================
// Convenience Exports
// ============================================================================

export function alertSourceDisabled(sourceName: string, reason: string): void {
    sendAlert('warn', `OEM Source "${sourceName}" wurde auto-disabled`, {
        source: sourceName,
        reason,
    });
}

let consecutiveOemFailures = 0;

export function trackOemResolutionResult(found: boolean): void {
    if (found) {
        consecutiveOemFailures = 0;
        return;
    }

    consecutiveOemFailures++;
    if (consecutiveOemFailures >= 5) {
        sendAlert('error', `${consecutiveOemFailures} aufeinanderfolgende OEM-Resolutions gescheitert`, {
            consecutiveFailures: consecutiveOemFailures,
        });
    }
}
