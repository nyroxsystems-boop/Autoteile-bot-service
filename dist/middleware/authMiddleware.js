"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const logger_1 = require("@utils/logger");
// Import 'get' directly as it is async, matching the unified Promise interface
const database_1 = require("../services/core/database");
// Secure Tokens via Env only - NO DEFAULTS
const SERVICE_TOKEN = process.env.VITE_WAWI_SERVICE_TOKEN;
const API_TOKEN = process.env.VITE_WAWI_API_TOKEN;
/**
 * Middleware to protect dashboard and internal routes.
 * Supports Bearer (Service), Token (User/API), and DB Session tokens.
 */
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    const path = req.path;
    // Allow OPTIONS preflight
    if (req.method === 'OPTIONS') {
        return next();
    }
    if (!authHeader) {
        // Reduced log level for noise
        logger_1.logger.debug(`[Auth] Missing Authorization header for ${path}`);
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
        // 2. Check Database Session
        try {
            // Updated to use await with the promise-based db.get
            const session = await (0, database_1.get)('SELECT * FROM sessions WHERE token = ?', [token]);
            if (session) {
                // Attach user to request if needed
                req.user = session;
                return next();
            }
            else {
                logger_1.logger.warn(`[Auth] Session invalid or expired for ${path}`);
            }
        }
        catch (error) {
            logger_1.logger.error("[Auth] DB session check failed", error);
        }
    }
    // Support for internal/service: 'Bearer <service_token>'
    else if (type === "Bearer") {
        if (SERVICE_TOKEN && token === SERVICE_TOKEN) {
            return next();
        }
        else {
            logger_1.logger.warn(`[Auth] Invalid Service Token for ${path}`);
        }
    }
    else {
        logger_1.logger.warn(`[Auth] Unsupported auth type '${type}' for ${path}`);
    }
    return res.status(403).json({
        error: "Invalid or unauthorized token"
    });
}
