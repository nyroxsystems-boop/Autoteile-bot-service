/**
 * 🛡️ Rate Limiting Middleware
 * 
 * Provides API rate limiting to protect against abuse.
 * Uses Redis when REDIS_URL is set (production), falls back to in-memory for dev.
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

interface RateLimitStore {
    get(key: string): Promise<RateLimitEntry | null>;
    increment(key: string, windowMs: number): Promise<RateLimitEntry>;
    reset(key: string): Promise<void>;
    clear(): Promise<void>;
}

// ============================================================================
// IN-MEMORY STORE (Development / Fallback)
// ============================================================================

class InMemoryStore implements RateLimitStore {
    private store = new Map<string, RateLimitEntry>();
    private cleanupInterval: ReturnType<typeof setInterval>;

    constructor() {
        // Cleanup expired entries every minute
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.store.entries()) {
                if (entry.resetAt < now) {
                    this.store.delete(key);
                }
            }
        }, 60000);
    }

    async get(key: string): Promise<RateLimitEntry | null> {
        const entry = this.store.get(key);
        if (!entry || entry.resetAt < Date.now()) return null;
        return entry;
    }

    async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
        const now = Date.now();
        let entry = this.store.get(key);

        if (!entry || entry.resetAt < now) {
            entry = { count: 0, resetAt: now + windowMs };
            this.store.set(key, entry);
        }

        entry.count++;
        return entry;
    }

    async reset(key: string): Promise<void> {
        this.store.delete(key);
    }

    async clear(): Promise<void> {
        this.store.clear();
    }
}

// ============================================================================
// REDIS STORE (Production)
// ============================================================================

class RedisStore implements RateLimitStore {
    private redis: any;
    private connected = false;

    constructor(redisUrl: string) {
        this.initRedis(redisUrl);
    }

    private async initRedis(redisUrl: string) {
        try {
            // @ts-ignore — redis is an optional dependency, only loaded when REDIS_URL is set
            const { createClient } = await import('redis');
            this.redis = createClient({ url: redisUrl });
            this.redis.on('error', (err: Error) => {
                logger.error('[RateLimit] Redis error', { error: err.message });
                this.connected = false;
            });
            this.redis.on('connect', () => {
                logger.info('[RateLimit] Redis connected for rate limiting');
                this.connected = true;
            });
            await this.redis.connect();
        } catch (err: any) {
            logger.warn('[RateLimit] Redis unavailable, falling back to in-memory', { error: err?.message });
            this.connected = false;
        }
    }

    async get(key: string): Promise<RateLimitEntry | null> {
        if (!this.connected || !this.redis) return null;
        try {
            const data = await this.redis.get(`rl:${key}`);
            return data ? JSON.parse(data) : null;
        } catch (err) {
          logger.warn('[RateLimiter] Redis increment error', { error: err });
            return null;
        }
    }

    async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
        if (!this.connected || !this.redis) {
            // Fallback: allow the request (fail-open)
            return { count: 1, resetAt: Date.now() + windowMs };
        }

        try {
            const redisKey = `rl:${key}`;
            const ttlSeconds = Math.ceil(windowMs / 1000);

            // Atomic: INCR returns new count, EXPIRE sets TTL only on first access
            const count = await this.redis.incr(redisKey);
            if (count === 1) {
                // First request in this window — set expiry
                await this.redis.expire(redisKey, ttlSeconds);
            }

            // Calculate resetAt from Redis TTL
            const ttl = await this.redis.ttl(redisKey);
            const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);

            return { count, resetAt };
        } catch (err: any) {
            logger.error('[RateLimit] Redis increment failed', { error: err?.message });
            return { count: 1, resetAt: Date.now() + windowMs };
        }
    }

    async reset(key: string): Promise<void> {
        if (!this.connected || !this.redis) return;
        try {
            await this.redis.del(`rl:${key}`);
        } catch (err) { logger.warn('[RateLimiter] Redis reset error', { error: err }); }
    }

    async clear(): Promise<void> {
        // Not implemented for Redis (would need SCAN + DEL)
    }
}

// ============================================================================
// STORE INITIALIZATION
// ============================================================================

let activeStore: RateLimitStore;

function getStore(): RateLimitStore {
    if (activeStore) return activeStore;

    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
        logger.info('[RateLimit] Using Redis store for rate limiting');
        activeStore = new RedisStore(redisUrl);
    } else {
        if (process.env.NODE_ENV === 'production') {
            logger.warn('[RateLimit] ⚠️ Using in-memory rate limiting in production! Set REDIS_URL for distributed rate limiting.');
        }
        activeStore = new InMemoryStore();
    }

    return activeStore;
}

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

    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Skip rate limiting for CORS preflight requests
        if (req.method === 'OPTIONS') {
            next();
            return;
        }

        const store = getStore();
        const key = keyGenerator(req);

        try {
            const entry = await store.increment(key, windowMs);

            // Set rate limit headers
            res.setHeader("X-RateLimit-Limit", maxRequests);
            res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count));
            res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

            if (entry.count > maxRequests) {
                const now = Date.now();
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
        } catch (err: any) {
            // On store error, fail-open (allow the request)
            logger.error("[RateLimit] Store error, allowing request", { error: err?.message });
            next();
        }
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
    maxRequests: 15,          // 15 attempts per 15 min
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
export async function getRateLimitStats(key: string): Promise<RateLimitEntry | null> {
    return getStore().get(key);
}

/**
 * Reset rate limit for a key (e.g., after successful authentication)
 */
export async function resetRateLimit(key: string): Promise<void> {
    await getStore().reset(key);
}

/**
 * Clear all rate limit entries (for testing)
 */
export async function clearAllRateLimits(): Promise<void> {
    await getStore().clear();
}
