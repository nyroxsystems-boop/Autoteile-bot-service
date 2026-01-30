/**
 * 🛡️ Rate Limiting Middleware
 * 
 * Provides API rate limiting to protect against abuse.
 * Uses sliding window algorithm with Redis-compatible in-memory store.
 */
import { Request, Response, NextFunction } from "express";
import { logger } from "@utils/logger";

// ============================================================================
// TYPES
// ============================================================================

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Max requests per window
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    message?: string;
}

// ============================================================================
// IN-MEMORY STORE
// ============================================================================

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every minute
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
        if (entry.resetAt < now) {
            store.delete(key);
        }
    }
}, 60000);

// ============================================================================
// RATE LIMIT MIDDLEWARE FACTORY
// ============================================================================

/**
 * Create a rate limiting middleware with the specified configuration
 */
export function createRateLimiter(config: RateLimitConfig) {
    const {
        windowMs = 60000,
        maxRequests = 100,
        keyGenerator = (req) => req.ip || "unknown",
        message = "Too many requests, please try again later."
    } = config;

    return (req: Request, res: Response, next: NextFunction): void => {
        const key = keyGenerator(req);
        const now = Date.now();

        let entry = store.get(key);

        // Create new entry or reset if window expired
        if (!entry || entry.resetAt < now) {
            entry = { count: 0, resetAt: now + windowMs };
            store.set(key, entry);
        }

        entry.count++;

        // Set rate limit headers
        res.setHeader("X-RateLimit-Limit", maxRequests);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count));
        res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

        if (entry.count > maxRequests) {
            logger.warn("[RateLimit] Limit exceeded", {
                key,
                count: entry.count,
                limit: maxRequests,
                path: req.path
            });

            res.status(429).json({
                error: "rate_limit_exceeded",
                message,
                retryAfter: Math.ceil((entry.resetAt - now) / 1000)
            });
            return;
        }

        next();
    };
}

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================

/**
 * Strict rate limit for authentication endpoints
 */
export const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,           // 5 attempts per 15 min
    message: "Too many login attempts. Please try again in 15 minutes."
});

/**
 * Standard API rate limit
 */
export const apiLimiter = createRateLimiter({
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 60,          // 60 requests per minute
    message: "API rate limit exceeded. Please slow down."
});

/**
 * Relaxed rate limit for WhatsApp webhook
 */
export const webhookLimiter = createRateLimiter({
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 200,         // 200 messages per minute (high volume)
    keyGenerator: (req) => req.body?.From || req.ip || "unknown",
    message: "Message rate limit exceeded."
});

/**
 * Heavy operation rate limit (OEM lookup, scraping)
 */
export const heavyOperationLimiter = createRateLimiter({
    windowMs: 60 * 1000,      // 1 minute
    maxRequests: 10,          // 10 heavy ops per minute
    message: "Too many requests. Heavy operations are limited."
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get current rate limit stats for a key
 */
export function getRateLimitStats(key: string): RateLimitEntry | null {
    return store.get(key) || null;
}

/**
 * Reset rate limit for a key (e.g., after successful authentication)
 */
export function resetRateLimit(key: string): void {
    store.delete(key);
}

/**
 * Clear all rate limit entries (for testing)
 */
export function clearAllRateLimits(): void {
    store.clear();
}
