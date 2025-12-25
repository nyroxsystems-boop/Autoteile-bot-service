import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

const SERVICE_TOKEN = process.env.VITE_WAWI_SERVICE_TOKEN || "service_dev_secret";
const API_TOKEN = process.env.VITE_WAWI_API_TOKEN || "api_dev_secret";

/**
 * Middleware to protect dashboard and internal routes.
 * Supports Bearer (Service) and Token (User/API) auth.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        logger.warn("Request without authorization header", { path: req.path });
        return res.status(401).json({ error: "No authorization header provided" });
    }

    // Support for dashboard client: 'Token <api_token>'
    if (authHeader.startsWith("Token ")) {
        const token = authHeader.substring(6);
        if (token === API_TOKEN) {
            return next();
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
