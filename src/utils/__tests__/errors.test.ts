/**
 * Tests for structured error classes
 */
import {
  AppError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ExternalServiceError,
} from '../errors';

describe('AppError', () => {
  it('should create an error with default values', () => {
    const err = new AppError('Something went wrong');
    expect(err.message).toBe('Something went wrong');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.isOperational).toBe(true);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.name).toBe('AppError');
  });

  it('should accept custom status code and error code', () => {
    const err = new AppError('Custom error', 'TEAPOT', 418);
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe('TEAPOT');
  });

  it('should store context', () => {
    const ctx = { userId: '123', orderId: 'abc' };
    const err = new AppError('Error', 'ERR', 500, ctx);
    expect(err.context).toEqual(ctx);
  });
});

describe('AuthError', () => {
  it('should default to 401 status', () => {
    const err = new AuthError('Not authenticated');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_ERROR');
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('ForbiddenError', () => {
  it('should default to 403 status', () => {
    const err = new ForbiddenError('Not allowed');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});

describe('NotFoundError', () => {
  it('should default to 404 status', () => {
    const err = new NotFoundError('Order not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});

describe('ValidationError', () => {
  it('should default to 400 status', () => {
    const err = new ValidationError('Invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
  });
});

describe('RateLimitError', () => {
  it('should default to 429 status', () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.message).toBe('Rate limit exceeded');
  });
});

describe('ExternalServiceError', () => {
  it('should default to 502 status', () => {
    const err = new ExternalServiceError('API down');
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe('EXTERNAL_SERVICE_ERROR');
  });
});
