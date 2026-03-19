/**
 * Tests for Zod Validation Middleware
 */
import { validate, validateQuery, validateParams } from '../validate';
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Helper to create mock Express objects
function mockReqResNext(body?: any, query?: any, params?: any) {
  const req = {
    body: body ?? {},
    query: query ?? {},
    params: params ?? {},
  } as unknown as Request;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  const next = jest.fn() as NextFunction;

  return { req, res, next };
}

describe('validate() middleware', () => {
  const schema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
  }).strict();

  it('should call next() for valid body', () => {
    const { req, res, next } = mockReqResNext({ email: 'test@example.com', name: 'Test' });
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no error
  });

  it('should return 400 for missing required field', () => {
    const { req, res, next } = mockReqResNext({ email: 'test@example.com' });
    validate(schema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation failed',
        details: expect.arrayContaining([
          expect.objectContaining({ field: 'name' }),
        ]),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid email format', () => {
    const { req, res, next } = mockReqResNext({ email: 'not-an-email', name: 'Test' });
    validate(schema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject unknown fields with strict schema', () => {
    const { req, res, next } = mockReqResNext({
      email: 'test@example.com',
      name: 'Test',
      unknown: 'field',
    });
    validate(schema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('should strip and replace req.body with parsed data', () => {
    const nonStrictSchema = z.object({
      count: z.coerce.number().int(),
    });
    const { req, res, next } = mockReqResNext({ count: '5' });
    validate(nonStrictSchema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body.count).toBe(5); // coerced from string to number
  });
});

describe('validateQuery() middleware', () => {
  const schema = z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  });

  it('should call next() for valid query params', () => {
    const { req, res, next } = mockReqResNext(undefined, { page: '1', limit: '10' });
    validateQuery(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should return 400 for invalid query params', () => {
    const { req, res, next } = mockReqResNext(undefined, { limit: '-5' });
    validateQuery(schema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid query parameters' })
    );
  });
});

describe('validateParams() middleware', () => {
  const schema = z.object({
    id: z.coerce.number().int().positive(),
  });

  it('should call next() for valid param', () => {
    const { req, res, next } = mockReqResNext(undefined, undefined, { id: '42' });
    validateParams(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should return 400 for non-numeric id param', () => {
    const { req, res, next } = mockReqResNext(undefined, undefined, { id: 'abc' });
    validateParams(schema)(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid path parameters' })
    );
  });
});
