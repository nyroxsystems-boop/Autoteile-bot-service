/**
 * 🔧 Centralized Error Handler
 * Premium error handling with structured logging, categorization, and recovery hints.
 */
import { logger } from "@utils/logger";

// ============================================================================
// ERROR TYPES
// ============================================================================

export enum ErrorCategory {
    NETWORK = "NETWORK",           // Fetch/HTTP errors
    SCRAPING = "SCRAPING",         // Web scraping failures
    AI_SERVICE = "AI_SERVICE",     // OpenAI/LLM errors
    DATABASE = "DATABASE",         // DB connection/query errors
    VALIDATION = "VALIDATION",     // Input validation errors
    EXTERNAL_API = "EXTERNAL_API", // Third-party API errors
    INTERNAL = "INTERNAL",         // Logic/programming errors
}

export interface StructuredError {
    category: ErrorCategory;
    message: string;
    source?: string;
    originalError?: Error;
    recoverable: boolean;
    context?: Record<string, unknown>;
}

// ============================================================================
// ERROR FACTORY
// ============================================================================

export function createError(
    category: ErrorCategory,
    message: string,
    options: {
        source?: string;
        originalError?: Error;
        recoverable?: boolean;
        context?: Record<string, unknown>;
    } = {}
): StructuredError {
    return {
        category,
        message,
        source: options.source,
        originalError: options.originalError,
        recoverable: options.recoverable ?? false,
        context: options.context,
    };
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

export function logError(error: StructuredError): void {
    const logData = {
        category: error.category,
        source: error.source,
        recoverable: error.recoverable,
        context: error.context,
        originalMessage: error.originalError?.message,
        stack: error.originalError?.stack?.split("\n").slice(0, 3).join("\n"),
    };

    if (error.recoverable) {
        logger.warn(`[${error.category}] ${error.message}`, logData);
    } else {
        logger.error(`[${error.category}] ${error.message}`, logData);
    }
}

// ============================================================================
// SAFE WRAPPERS
// ============================================================================

/**
 * Wrap an async function with automatic error handling.
 * Returns null on failure instead of throwing.
 */
export async function safeAsync<T>(
    fn: () => Promise<T>,
    options: {
        source: string;
        category?: ErrorCategory;
        fallback?: T;
        logErrors?: boolean;
    }
): Promise<T | null> {
    try {
        return await fn();
    } catch (err: any) {
        const error = createError(
            options.category || ErrorCategory.INTERNAL,
            err?.message || "Unknown error",
            {
                source: options.source,
                originalError: err instanceof Error ? err : new Error(String(err)),
                recoverable: true,
            }
        );

        if (options.logErrors !== false) {
            logError(error);
        }

        return options.fallback ?? null;
    }
}

/**
 * Wrap a fetch call with timeout, retry, and error handling.
 */
export async function safeFetch(
    url: string,
    options: RequestInit & {
        source: string;
        timeoutMs?: number;
        retries?: number;
    }
): Promise<Response | null> {
    const { source, timeoutMs = 10000, retries = 1, ...fetchOptions } = options;

    for (let attempt = 1; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            return response;
        } catch (err: any) {
            clearTimeout(timeoutId);

            const isTimeout = err?.name === "AbortError";
            const error = createError(ErrorCategory.NETWORK,
                isTimeout ? `Timeout after ${timeoutMs}ms` : err?.message || "Fetch failed",
                {
                    source,
                    originalError: err instanceof Error ? err : new Error(String(err)),
                    recoverable: attempt < retries,
                    context: { url, attempt, maxRetries: retries },
                }
            );

            logError(error);

            if (attempt === retries) {
                return null;
            }

            // Wait before retry (exponential backoff)
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
        }
    }

    return null;
}

// ============================================================================
// SCRAPING ERROR HANDLER
// ============================================================================

export function handleScrapingError(
    source: string,
    err: any,
    context?: Record<string, unknown>
): void {
    const error = createError(ErrorCategory.SCRAPING, err?.message || "Scraping failed", {
        source,
        originalError: err instanceof Error ? err : new Error(String(err)),
        recoverable: true,
        context,
    });
    logError(error);
}

// ============================================================================
// AI SERVICE ERROR HANDLER
// ============================================================================

export function handleAIError(
    source: string,
    err: any,
    context?: Record<string, unknown>
): void {
    const message = err?.message || "AI service error";

    // Detect specific AI error types
    let isRecoverable = true;
    if (message.includes("rate limit") || message.includes("429")) {
        isRecoverable = false; // Rate limit - need to wait
    } else if (message.includes("invalid_api_key") || message.includes("401")) {
        isRecoverable = false; // Auth failure - can't recover
    }

    const error = createError(ErrorCategory.AI_SERVICE, message, {
        source,
        originalError: err instanceof Error ? err : new Error(String(err)),
        recoverable: isRecoverable,
        context,
    });
    logError(error);
}
