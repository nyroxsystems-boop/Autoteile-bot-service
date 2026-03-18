/**
 * APM (Application Performance Monitoring) Wrapper
 * Placeholder for Datadog APM / Sentry Performance
 * Standardizes distributed tracing across the application.
 */

import { logger } from './logger';

export interface Span {
    finish: () => void;
    setTag: (key: string, value: string | number | boolean) => void;
}

/**
 * Start a performance tracking span
 * Compatible with Sentry/Datadog interface
 */
export function startSpan(name: string, tags?: Record<string, any>): Span {
    const startTime = Date.now();
    const spanTags = { ...tags };

    return {
        setTag(key: string, value: string | number | boolean) {
            spanTags[key] = value;
        },
        finish() {
            const durationMs = Date.now() - startTime;
            
            // Log the span in production format (Datadog/Sentry will hook here)
            logger.info({
                apm_span: true,
                span_name: name,
                duration_ms: durationMs,
                tags: spanTags
            }, `[APM] Span closed: ${name} (${durationMs}ms)`);
            
            // If Sentry was installed, it would be:
            // sentrySpan.finish();
        }
    };
}

/**
 * Execute a function within a traced span
 */
export async function withSpan<T>(name: string, tags: Record<string, any>, fn: (span: Span) => Promise<T>): Promise<T> {
    const span = startSpan(name, tags);
    try {
        return await fn(span);
    } catch (err: any) {
        span.setTag('error', true);
        span.setTag('error_message', err?.message || 'Unknown error');
        throw err;
    } finally {
        span.finish();
    }
}
