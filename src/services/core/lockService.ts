/**
 * DISTRIBUTED LOCKING SERVICE
 * 
 * Provides mutex-style locking for concurrent message handling.
 * 
 * CURRENT: In-memory implementation (development/single instance)
 * UPGRADE PATH: Replace with Redis-based implementation for production
 * 
 * Usage:
 *   const lock = getLockService();
 *   await lock.withLock('order-123', async () => { ... });
 */

import { logger } from '../../utils/logger';

// ============================================================================
// Interface (Redis-Compatible)
// ============================================================================

export interface LockService {
    /**
     * Execute function with an exclusive lock on the given key.
     * Ensures only one operation per key runs at a time.
     */
    withLock<T>(key: string, fn: () => Promise<T>, options?: LockOptions): Promise<T>;

    /**
     * Check if a key is currently locked.
     */
    isLocked(key: string): boolean;

    /**
     * Get metrics about lock usage.
     */
    getStats(): LockStats;
}

export interface LockOptions {
    /** Maximum time to wait for lock acquisition (ms) */
    timeout?: number;
    /** Maximum time to hold the lock (ms) - auto-release safety */
    ttl?: number;
}

export interface LockStats {
    activeLocks: number;
    totalAcquired: number;
    totalReleased: number;
    totalTimeouts: number;
}

// ============================================================================
// In-Memory Implementation (Fallback for development / single-instance)
// ============================================================================

class InMemoryLockService implements LockService {
    private locks = new Map<string, Promise<void>>();
    private stats = {
        totalAcquired: 0,
        totalReleased: 0,
        totalTimeouts: 0
    };

    async withLock<T>(key: string, fn: () => Promise<T>, options?: LockOptions): Promise<T> {
        const prev = this.locks.get(key) ?? Promise.resolve();
        let release!: () => void;

        const current = new Promise<void>((res) => {
            release = res;
        });

        this.locks.set(key, prev.then(() => current));

        // Wait for previous lock with timeout
        const timeout = options?.timeout ?? 30000; // 30s default
        const waitStart = Date.now();

        try {
            await Promise.race([
                prev,
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error(`Lock timeout for ${key}`)), timeout)
                )
            ]);
        } catch (err: any) {
            if (err.message?.includes('Lock timeout')) {
                this.stats.totalTimeouts++;
                logger.warn('Lock acquisition timeout', { key, timeout });
            }
            throw err;
        }

        this.stats.totalAcquired++;
        const acquireTime = Date.now() - waitStart;

        if (acquireTime > 1000) {
            logger.warn('Slow lock acquisition', { key, acquireTime });
        }

        // Auto-release TTL
        const ttl = options?.ttl ?? 60000; // 60s default max hold time
        const autoRelease = setTimeout(() => {
            logger.error('Lock TTL exceeded, force releasing', { key, ttl });
            release();
        }, ttl);

        try {
            return await fn();
        } finally {
            clearTimeout(autoRelease);
            this.stats.totalReleased++;
            release();

            if (this.locks.get(key) === current) {
                this.locks.delete(key);
            }
        }
    }

    isLocked(key: string): boolean {
        return this.locks.has(key);
    }

    getStats(): LockStats {
        return {
            activeLocks: this.locks.size,
            ...this.stats
        };
    }
}

// ============================================================================
// Redis Implementation (Production - Distributed Locking)
// ============================================================================

class RedisLockService implements LockService {
    private redis: any; // IORedis instance
    private stats = {
        totalAcquired: 0,
        totalReleased: 0,
        totalTimeouts: 0
    };
    private activeLocks = new Set<string>();

    constructor(redisUrl: string) {
        const IORedis = require('ioredis');
        this.redis = new IORedis(redisUrl, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            enableReadyCheck: false,
        });
        this.redis.connect().catch((err: any) => {
            logger.error('Redis lock service connection failed', { error: err?.message });
        });
    }

    async withLock<T>(key: string, fn: () => Promise<T>, options?: LockOptions): Promise<T> {
        const lockKey = `lock:${key}`;
        const timeout = options?.timeout ?? 30000;
        const ttlSeconds = Math.ceil((options?.ttl ?? 60000) / 1000);
        const lockValue = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const waitStart = Date.now();

        // Spin-wait for lock acquisition with backoff
        let acquired = false;
        while (Date.now() - waitStart < timeout) {
            // SET key value NX EX ttl — atomic acquire
            const result = await this.redis.set(lockKey, lockValue, 'EX', ttlSeconds, 'NX');
            if (result === 'OK') {
                acquired = true;
                break;
            }
            // Exponential backoff: 50ms, 100ms, 200ms... max 500ms
            const elapsed = Date.now() - waitStart;
            const delay = Math.min(50 * Math.pow(2, Math.floor(elapsed / 1000)), 500);
            await new Promise(r => setTimeout(r, delay));
        }

        if (!acquired) {
            this.stats.totalTimeouts++;
            logger.warn('Redis lock acquisition timeout', { key, timeout });
            throw new Error(`Lock timeout for ${key}`);
        }

        this.stats.totalAcquired++;
        this.activeLocks.add(key);
        const acquireTime = Date.now() - waitStart;
        if (acquireTime > 1000) {
            logger.warn('Slow Redis lock acquisition', { key, acquireTime });
        }

        try {
            return await fn();
        } finally {
            // Release only if WE still own the lock (compare value)
            // Uses Lua script for atomic check-and-delete
            const luaScript = `
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
            `;
            try {
                await this.redis.eval(luaScript, 1, lockKey, lockValue);
            } catch (err: any) {
                logger.error('Failed to release Redis lock', { key, error: err?.message });
            }
            this.activeLocks.delete(key);
            this.stats.totalReleased++;
        }
    }

    isLocked(key: string): boolean {
        return this.activeLocks.has(key);
    }

    getStats(): LockStats {
        return {
            activeLocks: this.activeLocks.size,
            ...this.stats
        };
    }
}

// ============================================================================
// Singleton — Auto-detects Redis, falls back to in-memory
// ============================================================================

let lockService: LockService | null = null;

export function getLockService(): LockService {
    if (!lockService) {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
            try {
                lockService = new RedisLockService(redisUrl);
                logger.info('Using Redis-based distributed lock service');
            } catch (err: any) {
                logger.warn('Failed to initialize Redis lock, falling back to in-memory', { error: err?.message });
                lockService = new InMemoryLockService();
            }
        } else {
            lockService = new InMemoryLockService();
            logger.info('Using in-memory lock service (single instance mode)');
        }
    }
    return lockService;
}

// ============================================================================
// Convenience Export
// ============================================================================

export async function withConversationLock<T>(
    senderKey: string,
    fn: () => Promise<T>
): Promise<T> {
    return getLockService().withLock(`conversation:${senderKey}`, fn);
}
