/**
 * Tests for Rate Limiter Middleware (in-memory store)
 */
import { createRateLimiter, clearAllRateLimits } from '../rateLimiter';
import { Request, Response, NextFunction } from 'express';

// Mock the logger to avoid console noise during tests
jest.mock('@utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

function mockReqResNext(ip = '127.0.0.1', method = 'GET', path = '/test') {
  const req = {
    ip,
    method,
    path,
    body: {},
    headers: {},
  } as unknown as Request;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
  } as unknown as Response;

  const next = jest.fn() as NextFunction;

  return { req, res, next };
}

describe('Rate Limiter', () => {
  beforeEach(async () => {
    await clearAllRateLimits();
  });

  it('should allow requests under the limit', async () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 5 });
    const { req, res, next } = mockReqResNext();

    await limiter(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
  });

  it('should block requests over the limit with 429', async () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 2 });

    // Make 3 requests (limit is 2)
    for (let i = 0; i < 3; i++) {
      const { req, res, next } = mockReqResNext();
      await limiter(req, res, next);

      if (i < 2) {
        expect(next).toHaveBeenCalled();
      } else {
        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'rate_limit_exceeded',
            retryAfter: expect.any(Number),
          })
        );
      }
    }
  });

  it('should skip OPTIONS preflight requests', async () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 1 });
    const { req, res, next } = mockReqResNext('127.0.0.1', 'OPTIONS');

    await limiter(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should use custom key generator', async () => {
    const limiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: 1,
      keyGenerator: (req) => req.headers['x-api-key'] as string || 'default',
    });

    // Two requests from different keys should both succeed
    const { req: req1, res: res1, next: next1 } = mockReqResNext();
    (req1 as any).headers = { 'x-api-key': 'key-a' };
    await limiter(req1, res1, next1);
    expect(next1).toHaveBeenCalled();

    const { req: req2, res: res2, next: next2 } = mockReqResNext();
    (req2 as any).headers = { 'x-api-key': 'key-b' };
    await limiter(req2, res2, next2);
    expect(next2).toHaveBeenCalled();
  });

  it('should set correct rate limit headers', async () => {
    const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 10 });
    const { req, res, next } = mockReqResNext();

    await limiter(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
  });

  it('should show custom error message', async () => {
    const limiter = createRateLimiter({
      windowMs: 60000,
      maxRequests: 0, // immediate limit
      message: 'Custom rate limit message',
    });

    const { req, res, next } = mockReqResNext();
    await limiter(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Custom rate limit message' })
    );
  });
});
