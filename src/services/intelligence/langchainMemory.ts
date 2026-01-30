/**
 * 🧠 LANGCHAIN MEMORY - Production-Grade Conversation History
 * 
 * 10/10 Premium Implementation:
 * - Redis backend for persistence (survives server restarts)
 * - In-memory fallback if Redis unavailable
 * - Session-based isolation per phone number
 * - Auto-expiry and cleanup
 */

import { BufferMemory, ChatMessageHistory } from "langchain/memory";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { logger } from "@utils/logger";

// ============================================================================
// Redis Client (Production) + In-Memory Fallback
// ============================================================================

let redisClient: any = null;
let useRedis = false;

// Try to initialize Redis connection
async function initRedis(): Promise<boolean> {
    if (redisClient) return useRedis;

    try {
        // Check if REDIS_URL is configured
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            logger.info("[LangChain Memory] No REDIS_URL configured, using in-memory storage");
            return false;
        }

        // Dynamic import to avoid issues if ioredis not available
        const Redis = require("ioredis");
        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryDelayOnFailover: 100,
            lazyConnect: true,
        });

        await redisClient.connect();
        useRedis = true;
        logger.info("[LangChain Memory] ✅ Redis connected for production memory");
        return true;
    } catch (error: any) {
        logger.warn("[LangChain Memory] Redis connection failed, using in-memory fallback", {
            error: error?.message,
        });
        redisClient = null;
        useRedis = false;
        return false;
    }
}

// Initialize on module load
initRedis().catch(() => { });

// ============================================================================
// Configuration
// ============================================================================

const MAX_MESSAGES_PER_SESSION = 50;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const REDIS_KEY_PREFIX = "langchain:memory:";
const REDIS_TTL_SECONDS = 1800; // 30 minutes

// ============================================================================
// In-Memory Fallback Store
// ============================================================================

const inMemoryStore = new Map<string, BaseMessage[]>();
const sessionActivity = new Map<string, number>();

function cleanupOldSessions(): void {
    const now = Date.now();
    for (const [sessionId, lastActivity] of sessionActivity.entries()) {
        if (now - lastActivity > SESSION_TIMEOUT_MS) {
            inMemoryStore.delete(sessionId);
            sessionActivity.delete(sessionId);
            logger.info("[LangChain Memory] Session expired", { sessionId });
        }
    }
}

// Cleanup every 5 minutes
setInterval(cleanupOldSessions, 5 * 60 * 1000);

// ============================================================================
// Production Chat Message History (Redis + Fallback)
// ============================================================================

export class ProductionChatHistory extends ChatMessageHistory {
    private sessionId: string;
    private redisKey: string;

    constructor(sessionId: string) {
        super();
        this.sessionId = sessionId;
        this.redisKey = `${REDIS_KEY_PREFIX}${sessionId}`;
    }

    async getMessages(): Promise<BaseMessage[]> {
        sessionActivity.set(this.sessionId, Date.now());

        // Try Redis first
        if (useRedis && redisClient) {
            try {
                const raw = await redisClient.get(this.redisKey);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    return parsed.map((m: any) =>
                        m.type === "human" ? new HumanMessage(m.content) : new AIMessage(m.content)
                    );
                }
                return [];
            } catch (error: any) {
                logger.warn("[LangChain Memory] Redis read failed, using in-memory", {
                    error: error?.message
                });
            }
        }

        // Fallback to in-memory
        return inMemoryStore.get(this.sessionId) || [];
    }

    async addMessage(message: BaseMessage): Promise<void> {
        sessionActivity.set(this.sessionId, Date.now());

        // Get existing messages
        let messages = await this.getMessages();
        messages.push(message);

        // Trim if too many
        if (messages.length > MAX_MESSAGES_PER_SESSION) {
            messages = messages.slice(-MAX_MESSAGES_PER_SESSION);
        }

        // Save to Redis if available
        if (useRedis && redisClient) {
            try {
                const serialized = messages.map(m => ({
                    type: m._getType(),
                    content: m.content,
                }));
                await redisClient.setex(this.redisKey, REDIS_TTL_SECONDS, JSON.stringify(serialized));
            } catch (error: any) {
                logger.warn("[LangChain Memory] Redis write failed", { error: error?.message });
            }
        }

        // Always update in-memory (backup)
        inMemoryStore.set(this.sessionId, messages);
    }

    async addUserMessage(message: string): Promise<void> {
        await this.addMessage(new HumanMessage(message));
    }

    async addAIMessage(message: string): Promise<void> {
        await this.addMessage(new AIMessage(message));
    }

    async clear(): Promise<void> {
        // Clear Redis
        if (useRedis && redisClient) {
            try {
                await redisClient.del(this.redisKey);
            } catch (error: any) {
                logger.warn("[LangChain Memory] Redis clear failed", { error: error?.message });
            }
        }

        // Clear in-memory
        inMemoryStore.delete(this.sessionId);
        sessionActivity.delete(this.sessionId);
        logger.info("[LangChain Memory] Session cleared", { sessionId: this.sessionId });
    }
}

// ============================================================================
// Memory Factory
// ============================================================================

export function createMemoryForSession(sessionId: string): BufferMemory {
    const chatHistory = new ProductionChatHistory(sessionId);

    return new BufferMemory({
        chatHistory,
        memoryKey: "chat_history",
        returnMessages: true,
    });
}

export function getSessionMessageCount(sessionId: string): number {
    return inMemoryStore.get(sessionId)?.length || 0;
}

export function clearSessionMemory(sessionId: string): void {
    const history = new ProductionChatHistory(sessionId);
    history.clear();
}

export function getActiveSessionIds(): string[] {
    return Array.from(inMemoryStore.keys());
}

export function getMemoryStats(): {
    activeSessions: number;
    totalMessages: number;
    oldestSessionAge: number | null;
    backend: "redis" | "in-memory";
} {
    const now = Date.now();
    let totalMessages = 0;
    let oldestAge: number | null = null;

    for (const [sessionId, messages] of inMemoryStore.entries()) {
        totalMessages += messages.length;
        const lastActivity = sessionActivity.get(sessionId);
        if (lastActivity) {
            const age = now - lastActivity;
            if (oldestAge === null || age > oldestAge) {
                oldestAge = age;
            }
        }
    }

    return {
        activeSessions: inMemoryStore.size,
        totalMessages,
        oldestSessionAge: oldestAge,
        backend: useRedis ? "redis" : "in-memory",
    };
}

/**
 * Check if Redis is connected (for health checks)
 */
export function isRedisConnected(): boolean {
    return useRedis && redisClient !== null;
}

// ============================================================================
// Legacy exports for backwards compatibility
// ============================================================================

export const SessionChatHistory = ProductionChatHistory;

export default {
    createMemoryForSession,
    getSessionMessageCount,
    clearSessionMemory,
    getActiveSessionIds,
    getMemoryStats,
    isRedisConnected,
    ProductionChatHistory,
    SessionChatHistory,
};
