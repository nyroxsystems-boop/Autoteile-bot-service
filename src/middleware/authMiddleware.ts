import { Request, Response, NextFunction } from "express";
import { logger } from "@utils/logger";
// Import 'get' directly as it is async, matching the unified Promise interface
import { get } from "../services/core/database";

// Secure Tokens via Env only - NO DEFAULTS
const SERVICE_TOKEN = process.env.VITE_WAWI_SERVICE_TOKEN;
const API_TOKEN = process.env.VITE_WAWI_API_TOKEN;

/**
 * Middleware to protect dashboard and internal routes.
 * Supports Bearer (Service), Token (User/API), and DB Session tokens.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const path = req.path;

    // Allow OPTIONS preflight
    if (req.method === 'OPTIONS') {
        return next();
    }

    if (!authHeader) {
        // Reduced log level for noise
        logger.debug(`[Auth] Missing Authorization header for ${path}`);
        return res.status(401).json({ error: "No authorization header provided" });
    }

    const [type, token] = authHeader.split(' ');

    if (!token) {
        return res.status(401).json({ error: "Malformed authorization header" });
    }

    // Support for dashboard client: 'Token <api_token>' OR Session Token
    if (type === "Token") {
        // 1. Check Static API Token (if configured)
        if (API_TOKEN && token === API_TOKEN) {
            return next();
        }

        // 2. Check Database Session (admin_sessions for Admin Dashboard)
        try {
            // First check admin_sessions table with proper timestamp casting
            const adminSession = await get<any>(
                'SELECT * FROM admin_sessions WHERE token = ? AND expires_at::TIMESTAMP > NOW()',
                [token]
            );

            if (adminSession) {
                // Attach user to request
                (req as any).user = adminSession;
                (req as any).isAdmin = true;
                return next();
            }

            // Then check regular sessions table (User Dashboard)
            const userSession = await get<any>(
                'SELECT s.*, u.id as user_id, u.email, u.username, u.role, u.merchant_id FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at::TIMESTAMP > NOW()',
                [token]
            );

            if (userSession) {
                // Attach user to request
                (req as any).user = userSession;
                (req as any).isAdmin = false;
                return next();
            }

            logger.warn(`[Auth] Session invalid or expired for ${path}`);
        } catch (error) {
            logger.error("[Auth] DB session check failed", error);
        }
    }

    // Support for internal/service: 'Bearer <service_token>'
    else if (type === "Bearer") {
        if (SERVICE_TOKEN && token === SERVICE_TOKEN) {
            return next();
        } else {
            logger.warn(`[Auth] Invalid Service Token for ${path}`);
        }
    }

    else {
        logger.warn(`[Auth] Unsupported auth type '${type}' for ${path}`);
    }

    return res.status(403).json({
        error: "Invalid or unauthorized token"
    });
}

