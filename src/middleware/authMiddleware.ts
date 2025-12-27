import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { getDb } from "../services/database";

const SERVICE_TOKEN = process.env.VITE_WAWI_SERVICE_TOKEN || "service_dev_secret";
const API_TOKEN = process.env.VITE_WAWI_API_TOKEN || "api_dev_secret";

/**
 * Middleware to protect dashboard and internal routes.
 * Supports Bearer (Service), Token (User/API), and DB Session tokens.
 */
// Middleware to protect dashboard and internal routes.
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const path = req.path;

    // Allow OPTIONS preflight
    if (req.method === 'OPTIONS') {
        return next();
    }

    if (!authHeader) {
        logger.warn(`[Auth] Missing Authorization header for ${path}`);
        return res.status(401).json({ error: "No authorization header provided" });
    }

    const [type, token] = authHeader.split(' ');

    if (!token) {
        logger.warn(`[Auth] Malformed header for ${path}: ${authHeader}`);
        return res.status(401).json({ error: "Malformed authorization header" });
    }

    // Support for dashboard client: 'Token <api_token>' OR Session Token
    if (type === "Token") {
        // 1. Check Static API Token
        if (token === API_TOKEN) {
            logger.debug(`[Auth] Valid API Token for ${path}`);
            return next();
        }

        // 2. Check Database Session
        try {
            const db = getDb();
            const session = await new Promise<any>((resolve, reject) => {
                db.get(
                    'SELECT * FROM sessions WHERE token = ?',
                    [token],
                    (err, row) => err ? reject(err) : resolve(row)
                );
            });

            if (session) {
                logger.debug(`[Auth] Valid Session Token for ${path} (User: ${session.user_id})`);
                // Attach user to request if needed
                (req as any).user = session;
                return next();
            } else {
                logger.warn(`[Auth] Session invalid or expired for ${path}. Token ending in ...${token.slice(-4)}`);
            }
        } catch (error) {
            logger.error("[Auth] DB session check failed", error);
        }
    }

    // Support for internal/service: 'Bearer <service_token>'
    else if (type === "Bearer") {
        if (token === SERVICE_TOKEN) {
            logger.debug(`[Auth] Valid Service Token for ${path}`);
            return next();
        } else {
            logger.warn(`[Auth] Invalid Service Token for ${path}. Expected: ${SERVICE_TOKEN.slice(0, 3)}... received ending in ...${token.slice(-4)}`);
        }
    }

    else {
        logger.warn(`[Auth] Unsupported auth type '${type}' for ${path}`);
    }

    return res.status(403).json({
        error: "Invalid or unauthorized token",
        details: "Check server logs for reason",
        debug: {
            authType: type,
            path: path
        }
    });
}

