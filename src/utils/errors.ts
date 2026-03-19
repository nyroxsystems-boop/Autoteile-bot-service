/**
 * 🚨 Structured Error Classes
 * 
 * Typed error classes for consistent error handling across the application.
 * Each error has a code, HTTP status, and optional context for structured logging.
 */

export class AppError extends Error {
    public readonly code: string;
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly context?: Record<string, unknown>;

    constructor(
        message: string,
        code: string = 'INTERNAL_ERROR',
        statusCode: number = 500,
        context?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = true; // Operational errors are expected (vs. programmer errors)
        this.context = context;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

export class AuthError extends AppError {
    constructor(message: string = 'Authentication required', context?: Record<string, unknown>) {
        super(message, 'AUTH_ERROR', 401, context);
        this.name = 'AuthError';
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = 'Access denied', context?: Record<string, unknown>) {
        super(message, 'FORBIDDEN', 403, context);
        this.name = 'ForbiddenError';
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string = 'Resource', context?: Record<string, unknown>) {
        super(`${resource} not found`, 'NOT_FOUND', 404, context);
        this.name = 'NotFoundError';
    }
}

export class ValidationError extends AppError {
    public readonly errors?: Record<string, string[]>;

    constructor(
        message: string = 'Validation failed',
        errors?: Record<string, string[]>,
        context?: Record<string, unknown>
    ) {
        super(message, 'VALIDATION_ERROR', 422, context);
        this.name = 'ValidationError';
        this.errors = errors;
    }
}

export class RateLimitError extends AppError {
    public readonly retryAfter: number;

    constructor(retryAfter: number = 60, context?: Record<string, unknown>) {
        super('Rate limit exceeded', 'RATE_LIMIT', 429, context);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}

export class ExternalServiceError extends AppError {
    public readonly service: string;

    constructor(service: string, message?: string, context?: Record<string, unknown>) {
        super(message || `External service ${service} failed`, 'EXTERNAL_SERVICE_ERROR', 502, context);
        this.name = 'ExternalServiceError';
        this.service = service;
    }
}
