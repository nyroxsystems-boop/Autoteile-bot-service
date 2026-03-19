/**
 * Request Timing Middleware
 * Logs request duration and sets Server-Timing header for observability.
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '@utils/logger';

const SLOW_REQUEST_THRESHOLD_MS = 2000;

export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationMs = Math.round(durationNs / 1_000_000);

    // Set Server-Timing header (visible in browser DevTools)
    res.setHeader('Server-Timing', `total;dur=${durationMs}`);

    // Log slow requests
    if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
      logger.warn('[Perf] Slow request', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
        requestId: req.headers['x-request-id'],
      });
    }

    // Debug-level logging for all requests
    logger.debug('[Perf] Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}
