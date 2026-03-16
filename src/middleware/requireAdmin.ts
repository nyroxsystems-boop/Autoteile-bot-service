/**
 * 🛡️ Admin Authorization Middleware
 * 
 * Must be used AFTER authMiddleware. Checks that the authenticated
 * user is an admin (via admin_sessions table) and rejects with 403
 * if they are a regular tenant user.
 */
import { Request, Response, NextFunction } from "express";
import { logger } from "@utils/logger";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    // authMiddleware sets (req as any).isAdmin = true for admin_sessions tokens
    if ((req as any).isAdmin === true) {
        return next();
    }

    logger.warn("[Auth] Non-admin user attempted admin action", {
        path: req.path,
        method: req.method,
        userId: (req as any).user?.user_id || (req as any).user?.id || "unknown",
    });

    res.status(403).json({
        error: "Forbidden",
        message: "Admin access required. This action is restricted to platform administrators.",
    });
}
