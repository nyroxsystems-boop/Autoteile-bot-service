/**
 * 🔍 Request ID Middleware
 * 
 * Attaches a unique trace ID to every incoming request for end-to-end
 * request correlation in logs. Forwards existing X-Request-ID headers
 * from upstream proxies (e.g., Railway, Traefik, Cloudflare).
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

declare global {
    namespace Express {
        interface Request {
            requestId?: string;
        }
    }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Use upstream request ID if present, otherwise generate one
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    
    next();
}
