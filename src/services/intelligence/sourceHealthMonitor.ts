/**
 * OEM SOURCE HEALTH MONITOR
 * 
 * Tracks health and reliability of OEM sources over time.
 * Automatically reduces confidence weight or disables sources
 * that are failing frequently.
 */

import { logger } from '@utils/logger';
import { alertSourceDisabled } from '@core/alertService';
import { reportSourceHealth } from './scraperFallback';

// ============================================================================
// Types
// ============================================================================

interface SourceHealth {
    name: string;
    successCount: number;
    failureCount: number;
    lastSuccessAt: Date | null;
    lastFailureAt: Date | null;
    consecutiveFailures: number;
    isDisabled: boolean;
    disabledReason?: string;
}

// ============================================================================
// State (In-Memory - Reset on restart)
// ============================================================================

const sourceHealthMap = new Map<string, SourceHealth>();

const CONSECUTIVE_FAILURE_THRESHOLD = 3;  // Disable after 3 consecutive failures
const FAILURE_RATE_THRESHOLD = 0.5;        // Disable if >50% failure rate (min 10 calls)
const AUTO_REENABLE_AFTER_MS = 5 * 60 * 1000; // Re-enable after 5 minutes

// ============================================================================
// Public API
// ============================================================================

export function getSourceHealth(sourceName: string): SourceHealth {
    if (!sourceHealthMap.has(sourceName)) {
        sourceHealthMap.set(sourceName, {
            name: sourceName,
            successCount: 0,
            failureCount: 0,
            lastSuccessAt: null,
            lastFailureAt: null,
            consecutiveFailures: 0,
            isDisabled: false
        });
    }
    return sourceHealthMap.get(sourceName)!;
}

export function recordSuccess(sourceName: string): void {
    const health = getSourceHealth(sourceName);
    health.successCount++;
    health.lastSuccessAt = new Date();
    health.consecutiveFailures = 0;

    // S5 FIX: Feed data to scraperFallback
    reportSourceHealth(sourceName, true);

    // Re-enable if was disabled
    if (health.isDisabled) {
        health.isDisabled = false;
        health.disabledReason = undefined;
        logger.info('OEM source re-enabled after success', { source: sourceName });
    }
}

export function recordFailure(sourceName: string, error: string): void {
    const health = getSourceHealth(sourceName);
    health.failureCount++;
    health.lastFailureAt = new Date();
    health.consecutiveFailures++;

    // S5 FIX: Feed data to scraperFallback
    reportSourceHealth(sourceName, false);

    // Check for automatic disable
    if (health.consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
        health.isDisabled = true;
        health.disabledReason = `${CONSECUTIVE_FAILURE_THRESHOLD} consecutive failures`;
        logger.warn('OEM source auto-disabled', {
            source: sourceName,
            reason: health.disabledReason,
            lastError: error
        });
        // P0: Send alert when source is disabled
        alertSourceDisabled(sourceName, `${health.disabledReason} — last error: ${error}`);
        return;
    }

    const totalCalls = health.successCount + health.failureCount;
    if (totalCalls >= 10) {
        const failureRate = health.failureCount / totalCalls;
        if (failureRate > FAILURE_RATE_THRESHOLD) {
            health.isDisabled = true;
            health.disabledReason = `Failure rate ${(failureRate * 100).toFixed(1)}% exceeds threshold`;
            logger.warn('OEM source auto-disabled due to high failure rate', {
                source: sourceName,
                failureRate,
                reason: health.disabledReason
            });
            // P0: Send alert when source is disabled
            alertSourceDisabled(sourceName, health.disabledReason);
        }
    }
}

export function isSourceDisabled(sourceName: string): boolean {
    const health = sourceHealthMap.get(sourceName);
    if (!health || !health.isDisabled) return false;

    // Auto re-enable after timeout
    if (health.lastFailureAt) {
        const elapsed = Date.now() - health.lastFailureAt.getTime();
        if (elapsed > AUTO_REENABLE_AFTER_MS) {
            health.isDisabled = false;
            health.consecutiveFailures = 0;
            health.disabledReason = undefined;
            logger.info('OEM source auto-re-enabled after timeout', { source: sourceName });
            return false;
        }
    }

    return true;
}

export function getConfidenceWeight(sourceName: string): number {
    const health = sourceHealthMap.get(sourceName);
    if (!health) return 1.0;

    if (health.isDisabled) return 0;

    const totalCalls = health.successCount + health.failureCount;
    if (totalCalls < 5) return 1.0; // Not enough data

    const successRate = health.successCount / totalCalls;
    // Weight = 0.5 to 1.0 based on success rate
    return 0.5 + (successRate * 0.5);
}

export function getAllSourcesHealth(): SourceHealth[] {
    return Array.from(sourceHealthMap.values());
}

export function getHealthSummary(): {
    total: number;
    healthy: number;
    degraded: number;
    disabled: number;
} {
    const all = getAllSourcesHealth();
    return {
        total: all.length,
        healthy: all.filter(s => !s.isDisabled && s.consecutiveFailures === 0).length,
        degraded: all.filter(s => !s.isDisabled && s.consecutiveFailures > 0).length,
        disabled: all.filter(s => s.isDisabled).length
    };
}
