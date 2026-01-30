/**
 * 🛡️ LANGCHAIN RATE LIMITER - Premium Abuse Protection
 * 
 * 10/10 Production Features:
 * - Per-session rate limiting
 * - Sliding window algorithm
 * - Configurable limits
 * - Abuse detection and logging
 */

import { logger } from "@utils/logger";

// ============================================================================
// Configuration
// ============================================================================

interface RateLimitConfig {
    maxRequestsPerMinute: number;
    maxRequestsPerHour: number;
    burstLimit: number; // Max requests in 10 seconds
}

const DEFAULT_CONFIG: RateLimitConfig = {
    maxRequestsPerMinute: 20,  // 20 requests/min per session
    maxRequestsPerHour: 100,   // 100 requests/hour per session
    burstLimit: 5,             // Max 5 requests in 10 seconds
};

// Premium tier gets higher limits
const PREMIUM_CONFIG: RateLimitConfig = {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 500,
    burstLimit: 15,
};

// ============================================================================
// Rate Limit Storage
// ============================================================================

interface RateLimitEntry {
    timestamps: number[];
    isBlocked: boolean;
    blockExpiry?: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// ============================================================================
// Rate Limiter Implementation
// ============================================================================

export class AgentRateLimiter {
    private config: RateLimitConfig;

    constructor(isPremium: boolean = false) {
        this.config = isPremium ? PREMIUM_CONFIG : DEFAULT_CONFIG;
    }

    /**
     * Check if a request should be allowed
     */
    checkLimit(sessionId: string): { allowed: boolean; reason?: string; retryAfterMs?: number } {
        const now = Date.now();
        let entry = rateLimitStore.get(sessionId);

        // Initialize if new session
        if (!entry) {
            entry = { timestamps: [], isBlocked: false };
            rateLimitStore.set(sessionId, entry);
        }

        // Check if currently blocked
        if (entry.isBlocked && entry.blockExpiry) {
            if (now < entry.blockExpiry) {
                const retryAfterMs = entry.blockExpiry - now;
                logger.warn("[RateLimiter] Session blocked", { sessionId, retryAfterMs });
                return {
                    allowed: false,
                    reason: "Rate limit exceeded. Please wait before sending more messages.",
                    retryAfterMs,
                };
            }
            // Block expired, reset
            entry.isBlocked = false;
            entry.timestamps = [];
        }

        // Clean up old timestamps (keep last hour)
        const oneHourAgo = now - 3600000;
        entry.timestamps = entry.timestamps.filter(ts => ts > oneHourAgo);

        // Check burst limit (10 seconds)
        const tenSecondsAgo = now - 10000;
        const burstCount = entry.timestamps.filter(ts => ts > tenSecondsAgo).length;
        if (burstCount >= this.config.burstLimit) {
            logger.warn("[RateLimiter] Burst limit exceeded", { sessionId, burstCount });
            return {
                allowed: false,
                reason: "Too many requests. Please slow down.",
                retryAfterMs: 10000,
            };
        }

        // Check per-minute limit
        const oneMinuteAgo = now - 60000;
        const minuteCount = entry.timestamps.filter(ts => ts > oneMinuteAgo).length;
        if (minuteCount >= this.config.maxRequestsPerMinute) {
            logger.warn("[RateLimiter] Minute limit exceeded", { sessionId, minuteCount });
            return {
                allowed: false,
                reason: "Rate limit reached. Please wait a minute.",
                retryAfterMs: 60000,
            };
        }

        // Check per-hour limit
        const hourCount = entry.timestamps.length;
        if (hourCount >= this.config.maxRequestsPerHour) {
            // Block for remaining time in the hour
            const oldestInHour = entry.timestamps[0];
            const blockUntil = oldestInHour + 3600000;
            entry.isBlocked = true;
            entry.blockExpiry = blockUntil;
            logger.warn("[RateLimiter] Hour limit exceeded, blocking", {
                sessionId,
                hourCount,
                blockUntil: new Date(blockUntil).toISOString(),
            });
            return {
                allowed: false,
                reason: "Hourly limit reached. Service will resume shortly.",
                retryAfterMs: blockUntil - now,
            };
        }

        // Record this request
        entry.timestamps.push(now);
        return { allowed: true };
    }

    /**
     * Record a successful request (for metrics)
     */
    recordRequest(sessionId: string): void {
        // Already recorded in checkLimit
    }

    /**
     * Reset limits for a session (admin function)
     */
    resetSession(sessionId: string): void {
        rateLimitStore.delete(sessionId);
        logger.info("[RateLimiter] Session reset", { sessionId });
    }

    /**
     * Get rate limit stats
     */
    getStats(): {
        activeSessions: number;
        blockedSessions: number;
        totalRequests: number;
    } {
        let blockedCount = 0;
        let totalRequests = 0;

        for (const entry of rateLimitStore.values()) {
            if (entry.isBlocked) blockedCount++;
            totalRequests += entry.timestamps.length;
        }

        return {
            activeSessions: rateLimitStore.size,
            blockedSessions: blockedCount,
            totalRequests,
        };
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const agentRateLimiter = new AgentRateLimiter();

// ============================================================================
// Cleanup
// ============================================================================

// Clean up old entries every 10 minutes
setInterval(() => {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    for (const [sessionId, entry] of rateLimitStore.entries()) {
        // Remove entries with no recent activity
        const hasRecentActivity = entry.timestamps.some(ts => ts > oneHourAgo);
        if (!hasRecentActivity) {
            rateLimitStore.delete(sessionId);
        }
    }
}, 10 * 60 * 1000);

export default agentRateLimiter;
