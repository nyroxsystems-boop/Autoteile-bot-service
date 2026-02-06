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
// In-Memory Implementation
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
// Singleton
// ============================================================================

let lockService: LockService | null = null;

export function getLockService(): LockService {
    if (!lockService) {
        // TODO: Check for Redis configuration and use RedisLockService if available
        // if (process.env.REDIS_URL) {
        //   lockService = new RedisLockService(process.env.REDIS_URL);
        // } else {
        lockService = new InMemoryLockService();
        logger.info('Using in-memory lock service (single instance mode)');
        // }
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
