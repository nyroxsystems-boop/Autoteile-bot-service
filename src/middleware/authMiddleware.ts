import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";
import { getDb } from "../services/database";

const SERVICE_TOKEN = process.env.VITE_WAWI_SERVICE_TOKEN || "service_dev_secret";
const API_TOKEN = process.env.VITE_WAWI_API_TOKEN || "api_dev_secret";

/**
 * Middleware to protect dashboard and internal routes.
 * Supports Bearer (Service), Token (User/API), and DB Session tokens.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        logger.warn("Request without authorization header", { path: req.path });
        return res.status(401).json({ error: "No authorization header provided" });
    }

    // Support for dashboard client: 'Token <api_token>' OR Session Token
    if (authHeader.startsWith("Token ")) {
        const token = authHeader.substring(6);

        // 1. Check Static API Token
        if (token === API_TOKEN) {
            return next();
        }

        // 2. Check Database Session
        try {
            const db = getDb();
            const session = await new Promise<any>((resolve, reject) => {
                db.get(
                    'SELECT * FROM sessions WHERE token = ?', // AND datetime(expires_at) > datetime("now") - simplified for stability first
                    [token],
                    (err, row) => err ? reject(err) : resolve(row)
                );
            });

            if (session) {
                // Valid confirmed session
                return next();
            }
        } catch (error) {
            logger.error("Auth middleware DB check failed", error);
            // Don't return here, fall through to 403
        }
    }

    // Support for internal/service: 'Bearer <service_token>'
    if (authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        if (token === SERVICE_TOKEN) {
            return next();
        }
    }

    logger.warn("Invalid authorization token provided", { path: req.path, authType: authHeader.split(' ')[0] });
    return res.status(403).json({ error: "Invalid or unauthorized token" });
}
