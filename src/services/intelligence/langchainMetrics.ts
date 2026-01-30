/**
 * 📊 LANGCHAIN METRICS - Production Observability
 * 
 * 10/10 Premium Features:
 * - Request tracking (success/failure)
 * - Latency percentiles
 * - Tool usage stats
 * - Memory utilization
 * - Health check endpoint data
 */

import { logger } from "@utils/logger";
import { getMemoryStats, isRedisConnected } from "./langchainMemory";
import { agentRateLimiter } from "./langchainRateLimiter";

// ============================================================================
// Metrics Storage
// ============================================================================

interface MetricsData {
    // Request counts
    totalRequests: number;
    successCount: number;
    failureCount: number;
    fallbackCount: number; // Times we fell back to legacy orchestrator

    // Latency tracking (in ms)
    latencies: number[];

    // Tool usage
    toolUsage: Record<string, number>;

    // Timestamps
    startTime: number;
    lastRequestTime: number | null;
}

const metrics: MetricsData = {
    totalRequests: 0,
    successCount: 0,
    failureCount: 0,
    fallbackCount: 0,
    latencies: [],
    toolUsage: {
        oem_lookup: 0,
        stock_check: 0,
        order_status: 0,
        escalate_human: 0,
    },
    startTime: Date.now(),
    lastRequestTime: null,
};

// Max latencies to keep (for percentile calculation)
const MAX_LATENCIES = 1000;

// ============================================================================
// Metrics Recording
// ============================================================================

export function recordRequest(success: boolean, latencyMs: number): void {
    metrics.totalRequests++;
    metrics.lastRequestTime = Date.now();

    if (success) {
        metrics.successCount++;
    } else {
        metrics.failureCount++;
    }

    // Record latency
    metrics.latencies.push(latencyMs);
    if (metrics.latencies.length > MAX_LATENCIES) {
        metrics.latencies.shift();
    }
}

export function recordFallback(): void {
    metrics.fallbackCount++;
    logger.info("[Metrics] Fallback to legacy orchestrator recorded");
}

export function recordToolUsage(toolName: string): void {
    if (metrics.toolUsage[toolName] !== undefined) {
        metrics.toolUsage[toolName]++;
    } else {
        metrics.toolUsage[toolName] = 1;
    }
}

// ============================================================================
// Metrics Calculation
// ============================================================================

function calculatePercentile(arr: number[], percentile: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
}

// ============================================================================
// Public API
// ============================================================================

export interface AgentMetrics {
    // Overview
    uptime: number;
    uptimeHuman: string;

    // Requests
    requests: {
        total: number;
        success: number;
        failure: number;
        fallback: number;
        successRate: number;
    };

    // Latency (ms)
    latency: {
        p50: number;
        p95: number;
        p99: number;
        avg: number;
    };

    // Tools
    toolUsage: Record<string, number>;

    // Memory
    memory: {
        activeSessions: number;
        totalMessages: number;
        backend: string;
        redisConnected: boolean;
    };

    // Rate Limiting
    rateLimiting: {
        activeSessions: number;
        blockedSessions: number;
    };

    // Health
    health: "healthy" | "degraded" | "unhealthy";
}

export function getAgentMetrics(): AgentMetrics {
    const uptime = Date.now() - metrics.startTime;
    const memoryStats = getMemoryStats();
    const rateLimitStats = agentRateLimiter.getStats();

    // Calculate success rate
    const successRate = metrics.totalRequests > 0
        ? (metrics.successCount / metrics.totalRequests) * 100
        : 100;

    // Calculate latency stats
    const avgLatency = metrics.latencies.length > 0
        ? metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length
        : 0;

    // Determine health status
    let health: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (successRate < 90) health = "degraded";
    if (successRate < 70) health = "unhealthy";
    if (metrics.fallbackCount > metrics.successCount) health = "degraded";

    return {
        uptime,
        uptimeHuman: formatUptime(uptime),

        requests: {
            total: metrics.totalRequests,
            success: metrics.successCount,
            failure: metrics.failureCount,
            fallback: metrics.fallbackCount,
            successRate: Math.round(successRate * 100) / 100,
        },

        latency: {
            p50: calculatePercentile(metrics.latencies, 50),
            p95: calculatePercentile(metrics.latencies, 95),
            p99: calculatePercentile(metrics.latencies, 99),
            avg: Math.round(avgLatency),
        },

        toolUsage: { ...metrics.toolUsage },

        memory: {
            activeSessions: memoryStats.activeSessions,
            totalMessages: memoryStats.totalMessages,
            backend: memoryStats.backend,
            redisConnected: isRedisConnected(),
        },

        rateLimiting: {
            activeSessions: rateLimitStats.activeSessions,
            blockedSessions: rateLimitStats.blockedSessions,
        },

        health,
    };
}

function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/**
 * Reset metrics (admin function)
 */
export function resetMetrics(): void {
    metrics.totalRequests = 0;
    metrics.successCount = 0;
    metrics.failureCount = 0;
    metrics.fallbackCount = 0;
    metrics.latencies = [];
    Object.keys(metrics.toolUsage).forEach(key => {
        metrics.toolUsage[key] = 0;
    });
    logger.info("[Metrics] Metrics reset");
}

// ============================================================================
// Export
// ============================================================================

export default {
    recordRequest,
    recordFallback,
    recordToolUsage,
    getAgentMetrics,
    resetMetrics,
};
