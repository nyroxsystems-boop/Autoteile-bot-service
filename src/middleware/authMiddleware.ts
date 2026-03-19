import { Request, Response, NextFunction } from "express";
import { logger } from "@utils/logger";
// Import 'get' directly for DB session lookups (backward compatible)
import { get } from "../services/core/database";
import { jwtService } from "../services/auth/jwtService";

// Secure Tokens via Env only - NO DEFAULTS
const SERVICE_TOKEN = process.env.WAWI_SERVICE_TOKEN || process.env.VITE_WAWI_SERVICE_TOKEN;
const API_TOKEN = process.env.WAWI_API_TOKEN || process.env.VITE_WAWI_API_TOKEN;

/**
 * Unified Auth Middleware
 *
 * Authentication priority:
 * 1. Bearer JWT (stateless, preferred)
 * 2. Bearer Service Token (internal/WAWI)
 * 3. Token Session (legacy DB sessions — backward compatible)
 * 4. Token API Key (static API token)
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const path = req.path;

    // Allow OPTIONS preflight
    if (req.method === 'OPTIONS') {
        return next();
    }

    if (!authHeader) {
        logger.debug(`[Auth] Missing Authorization header for ${path}`);
        return res.status(401).json({ error: "No authorization header provided" });
    }

    const [type, token] = authHeader.split(' ');

    if (!token) {
        return res.status(401).json({ error: "Malformed authorization header" });
    }

    // ─── 1. Bearer: JWT or Service Token ───────────────────────
    if (type === "Bearer") {
        // 1a. Try JWT first
        const jwtPayload = await jwtService.verifyAccessToken(token);
        if (jwtPayload) {
            req.user = {
                id: jwtPayload.sub,
                email: jwtPayload.email,
                role: jwtPayload.role as any,
                merchantId: jwtPayload.merchantId,
                tenantId: jwtPayload.tenantId,
            };
            req.merchantId = jwtPayload.merchantId;
            req.tenantId = jwtPayload.tenantId;
            return next();
        }

        // 1b. Service Token (WAWI / internal)
        if (SERVICE_TOKEN && token === SERVICE_TOKEN) {
            return next();
        }

        logger.warn(`[Auth] Invalid Bearer token for ${path}`);
    }

    // ─── 2. Token: DB Session or API Key (backward compatible) ──
    else if (type === "Token") {
        // 2a. Static API Token
        if (API_TOKEN && token === API_TOKEN) {
            return next();
        }

        // 2b. Database Session (admin + user)
        try {
            // Check admin_sessions table
            const adminSession = await get<any>(
                'SELECT * FROM admin_sessions WHERE token = ? AND expires_at::TIMESTAMP > NOW()',
                [token]
            );

            if (adminSession) {
                req.user = {
                    id: adminSession.id || adminSession.user_id,
                    email: adminSession.email || '',
                    role: 'admin',
                    merchantId: adminSession.merchant_id || '',
                };
                return next();
            }

            // Check regular sessions table (User Dashboard)
            const userSession = await get<any>(
                'SELECT s.*, u.id as user_id, u.email, u.username, u.role, u.merchant_id FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at::TIMESTAMP > NOW()',
                [token]
            );

            if (userSession) {
                req.user = {
                    id: userSession.user_id,
                    email: userSession.email || '',
                    role: userSession.role || 'user',
                    merchantId: userSession.merchant_id || '',
                };
                req.merchantId = userSession.merchant_id;
                return next();
            }

            logger.warn(`[Auth] Session invalid or expired for ${path}`);
        } catch (error) {
            logger.error("[Auth] DB session check failed", error);
        }
    }

    else {
        logger.warn(`[Auth] Unsupported auth type '${type}' for ${path}`);
    }

    return res.status(403).json({
        error: "Invalid or unauthorized token"
    });
}

/**
 * Admin Auth Middleware
 * Validates admin JWT or Session token
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    // Allow OPTIONS preflight
    if (req.method === 'OPTIONS') {
        return next();
    }

    if (!authHeader || !authHeader.startsWith('Token ')) {
        logger.debug(`[Admin Auth] Missing Authorization header for ${req.path}`);
        return res.status(401).json({ error: "Nicht authentifiziert" });
    }

    const token = authHeader.substring(6);

    try {
        const session = await get<any>(
            `SELECT * FROM admin_sessions WHERE token = ? AND expires_at::TIMESTAMP > NOW()`,
            [token]
        );

        if (!session) {
            return res.status(401).json({ error: "Session abgelaufen" });
        }

        req.user = {
            id: session.admin_id.toString(),
            email: 'admin',
            role: 'admin' as any,
            merchantId: '',
        };
        
        return next();
    } catch (error) {
        logger.error("[Admin Auth] Session check failed", error);
        return res.status(500).json({ error: "Authentifizierungsfehler" });
    }
}
