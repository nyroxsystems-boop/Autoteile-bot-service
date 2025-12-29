"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const logger_1 = require("../utils/logger");
const database_1 = require("../services/database");
const SERVICE_TOKEN = process.env.VITE_WAWI_SERVICE_TOKEN || "service_dev_secret";
const API_TOKEN = process.env.VITE_WAWI_API_TOKEN || "api_dev_secret";
/**
 * Middleware to protect dashboard and internal routes.
 * Supports Bearer (Service), Token (User/API), and DB Session tokens.
 */
// Middleware to protect dashboard and internal routes.
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    const path = req.path;
    // Allow OPTIONS preflight
    if (req.method === 'OPTIONS') {
        return next();
    }
    if (!authHeader) {
        logger_1.logger.warn(`[Auth] Missing Authorization header for ${path}`);
        return res.status(401).json({ error: "No authorization header provided" });
    }
    const [type, token] = authHeader.split(' ');
    if (!token) {
        logger_1.logger.warn(`[Auth] Malformed header for ${path}: ${authHeader}`);
        return res.status(401).json({ error: "Malformed authorization header" });
    }
    // Support for dashboard client: 'Token <api_token>' OR Session Token
    if (type === "Token") {
        // 1. Check Static API Token
        if (token === API_TOKEN) {
            logger_1.logger.debug(`[Auth] Valid API Token for ${path}`);
            return next();
        }
        // 2. Check Database Session
        try {
            const db = (0, database_1.getDb)();
            const session = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM sessions WHERE token = ?', [token], (err, row) => err ? reject(err) : resolve(row));
            });
            if (session) {
                logger_1.logger.debug(`[Auth] Valid Session Token for ${path} (User: ${session.user_id})`);
                // Attach user to request if needed
                req.user = session;
                return next();
            }
            else {
                logger_1.logger.warn(`[Auth] Session invalid or expired for ${path}. Token ending in ...${token.slice(-4)}`);
            }
        }
        catch (error) {
            logger_1.logger.error("[Auth] DB session check failed", error);
        }
    }
    // Support for internal/service: 'Bearer <service_token>'
    else if (type === "Bearer") {
        if (token === SERVICE_TOKEN) {
            logger_1.logger.debug(`[Auth] Valid Service Token for ${path}`);
            return next();
        }
        else {
            logger_1.logger.warn(`[Auth] Invalid Service Token for ${path}. Expected: ${SERVICE_TOKEN.slice(0, 3)}... received ending in ...${token.slice(-4)}`);
        }
    }
    else {
        logger_1.logger.warn(`[Auth] Unsupported auth type '${type}' for ${path}`);
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
