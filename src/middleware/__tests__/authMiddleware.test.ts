/**
 * Tests for Auth Middleware
 * Tests JWT auth flow, service token, and error cases.
 * Database-backed session tests are skipped (need integration test setup).
 */
import { authMiddleware } from '../authMiddleware';
import { Request, Response, NextFunction } from 'express';

// Mock the logger
jest.mock('@utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock the database module
jest.mock('../../services/core/database', () => ({
  get: jest.fn().mockResolvedValue(null),
}));

// Mock jwtService
const mockVerifyAccessToken = jest.fn();
jest.mock('../../services/auth/jwtService', () => ({
  jwtService: {
    verifyAccessToken: (...args: any[]) => mockVerifyAccessToken(...args),
  },
}));

function createMockReqRes(authHeader?: string, method = 'GET', path = '/test') {
  const req = {
    method,
    path,
    headers: authHeader ? { authorization: authHeader } : {},
    body: {},
  } as unknown as Request;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  const next = jest.fn() as NextFunction;

  return { req, res, next };
}

describe('authMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAccessToken.mockResolvedValue(null);
    // Clear env tokens for each test
    delete process.env.WAWI_SERVICE_TOKEN;
    delete process.env.VITE_WAWI_SERVICE_TOKEN;
    delete process.env.WAWI_API_TOKEN;
    delete process.env.VITE_WAWI_API_TOKEN;
  });

  it('should allow OPTIONS preflight requests without auth', async () => {
    const { req, res, next } = createMockReqRes(undefined, 'OPTIONS');
    await authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should reject requests with no authorization header', async () => {
    const { req, res, next } = createMockReqRes(undefined);
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'No authorization header provided' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject malformed authorization header', async () => {
    const { req, res, next } = createMockReqRes('Bearer');
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Malformed authorization header' })
    );
  });

  it('should authenticate valid JWT token', async () => {
    mockVerifyAccessToken.mockResolvedValue({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'TENANT_USER',
      merchantId: 'merchant-1',
      tenantId: 'tenant-1',
    });

    const { req, res, next } = createMockReqRes('Bearer valid-jwt-token');
    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(
      expect.objectContaining({
        id: 'user-123',
        email: 'test@example.com',
        role: 'TENANT_USER',
      })
    );
  });

  it('should reject invalid JWT with 403', async () => {
    mockVerifyAccessToken.mockResolvedValue(null);
    const { req, res, next } = createMockReqRes('Bearer invalid-token');
    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject unsupported auth type', async () => {
    const { req, res, next } = createMockReqRes('Basic dXNlcjpwYXNz');
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
