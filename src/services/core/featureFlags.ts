/**
 * FEATURE FLAGS SERVICE
 * 
 * Simple, production-ready feature flag system for gradual rollout.
 * 
 * Features:
 * - Environment-based flags
 * - User/Merchant targeting
 * - Percentage-based rollout
 * - Flag override via env vars
 */

import { logger } from '../../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface FeatureFlag {
    name: string;
    description: string;
    defaultEnabled: boolean;
    rolloutPercentage?: number;  // 0-100, for gradual rollouts
    enabledMerchants?: string[];  // Specific merchant IDs
    enabledUsers?: string[];      // Specific user phone numbers
}

export interface FlagContext {
    merchantId?: string;
    userId?: string;
    sessionId?: string;
}

// ============================================================================
// Flag Definitions
// ============================================================================

const FLAGS: Record<string, FeatureFlag> = {
    // State Machine Migration
    USE_STATE_MACHINE: {
        name: 'USE_STATE_MACHINE',
        description: 'Use new state machine architecture instead of legacy switch',
        defaultEnabled: false,
        rolloutPercentage: 0
    },

    // OEM Resolver Improvements
    OEM_DEEP_RESOLUTION: {
        name: 'OEM_DEEP_RESOLUTION',
        description: 'Enable deep OEM resolution with VIN/PR-code analysis',
        defaultEnabled: true,
        rolloutPercentage: 100
    },

    // Source Health Monitoring
    SOURCE_HEALTH_MONITORING: {
        name: 'SOURCE_HEALTH_MONITORING',
        description: 'Enable automatic source disabling on failures',
        defaultEnabled: true,
        rolloutPercentage: 100
    },

    // AI Orchestrator
    USE_AI_ORCHESTRATOR: {
        name: 'USE_AI_ORCHESTRATOR',
        description: 'Use Gemini AI orchestrator for intent detection',
        defaultEnabled: true,
        rolloutPercentage: 100
    },

    // Experimental: Enhanced Conversation Intelligence
    ENHANCED_CONVERSATION_INTELLIGENCE: {
        name: 'ENHANCED_CONVERSATION_INTELLIGENCE',
        description: 'Use enhanced NLU for better context retention',
        defaultEnabled: false,
        rolloutPercentage: 0
    }
};

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check if a feature flag is enabled for the given context.
 */
export function isEnabled(flagName: string, ctx?: FlagContext): boolean {
    // Check for environment override first (highest priority)
    const envKey = `FF_${flagName}`;
    const envValue = process.env[envKey];
    if (envValue !== undefined) {
        const enabled = envValue === '1' || envValue.toLowerCase() === 'true';
        logger.debug(`Feature flag override from env`, { flag: flagName, enabled });
        return enabled;
    }

    const flag = FLAGS[flagName];
    if (!flag) {
        logger.warn('Unknown feature flag requested', { flag: flagName });
        return false;
    }

    // Check user-specific enable list
    if (ctx?.userId && flag.enabledUsers?.includes(ctx.userId)) {
        return true;
    }

    // Check merchant-specific enable list
    if (ctx?.merchantId && flag.enabledMerchants?.includes(ctx.merchantId)) {
        return true;
    }

    // Check percentage rollout
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage > 0) {
        // Use deterministic hash for consistent behavior per user
        const key = ctx?.userId || ctx?.sessionId || 'default';
        const hash = simpleHash(key + flagName);
        const bucket = hash % 100;

        if (bucket < flag.rolloutPercentage) {
            return true;
        }
    }

    return flag.defaultEnabled;
}

/**
 * Get all flag statuses for debugging/monitoring.
 */
export function getAllFlags(ctx?: FlagContext): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const flagName of Object.keys(FLAGS)) {
        result[flagName] = isEnabled(flagName, ctx);
    }
    return result;
}

/**
 * Get flag definition for documentation.
 */
export function getFlagInfo(flagName: string): FeatureFlag | null {
    return FLAGS[flagName] || null;
}

/**
 * Register a custom flag at runtime.
 */
export function registerFlag(flag: FeatureFlag): void {
    FLAGS[flag.name] = flag;
    logger.info('Feature flag registered', { flag: flag.name });
}

/**
 * Update rollout percentage for a flag.
 */
export function setRolloutPercentage(flagName: string, percentage: number): void {
    const flag = FLAGS[flagName];
    if (!flag) {
        logger.warn('Cannot update unknown flag', { flag: flagName });
        return;
    }

    const clampedPercentage = Math.max(0, Math.min(100, percentage));
    flag.rolloutPercentage = clampedPercentage;
    logger.info('Feature flag rollout updated', {
        flag: flagName,
        percentage: clampedPercentage
    });
}

// ============================================================================
// Helpers
// ============================================================================

function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

// ============================================================================
// Convenience Exports
// ============================================================================

export const FF = {
    USE_STATE_MACHINE: 'USE_STATE_MACHINE',
    OEM_DEEP_RESOLUTION: 'OEM_DEEP_RESOLUTION',
    SOURCE_HEALTH_MONITORING: 'SOURCE_HEALTH_MONITORING',
    USE_AI_ORCHESTRATOR: 'USE_AI_ORCHESTRATOR',
    ENHANCED_CONVERSATION_INTELLIGENCE: 'ENHANCED_CONVERSATION_INTELLIGENCE'
} as const;

export type FeatureFlagName = keyof typeof FF;
