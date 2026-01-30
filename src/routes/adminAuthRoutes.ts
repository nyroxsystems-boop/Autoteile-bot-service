/**
 * Admin Authentication Routes
 * Separate auth system for platform administrators
 */

import { Router, type Request, type Response } from "express";
import * as db from "../services/core/database";
import { createHash, randomUUID, randomBytes } from "crypto";
import { sendPasswordResetEmail } from "../services/core/emailService";
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from "../services/core/activityLogger";

const router = Router();

// Hash password using SHA-256
function hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
}

// Generate secure token
function generateToken(): string {
    return randomBytes(48).toString('hex');
}

/**
 * POST /api/admin-auth/login
 * Admin login with username + password
 */
router.post("/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username und Passwort sind erforderlich" });
    }

    try {
        // Find admin by username (case-insensitive)
        const admin = await db.get<any>(
            `SELECT * FROM admin_users WHERE LOWER(username) = LOWER(?) AND is_active = 1`,
            [username]
        );

        if (!admin) {
            return res.status(401).json({ error: "Ungültige Anmeldedaten" });
        }

        // Verify password
        const passwordHash = hashPassword(password);
        if (admin.password_hash !== passwordHash) {
            return res.status(401).json({ error: "Ungültige Anmeldedaten" });
        }

        // Generate session token
        const token = generateToken();
        const sessionId = randomUUID();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

        // Create session
        await db.run(
            `INSERT INTO admin_sessions (id, admin_id, token, created_at, expires_at, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                sessionId,
                admin.id,
                token,
                now.toISOString(),
                expiresAt.toISOString(),
                req.ip || req.socket.remoteAddress,
                req.headers['user-agent'] || ''
            ]
        );

        // Update last login
        await db.run(
            'UPDATE admin_users SET last_login = ? WHERE id = ?',
            [now.toISOString(), admin.id]
        );

        // Log activity
        await logActivity({
            adminUsername: admin.username,
            actionType: ACTION_TYPES.ADMIN_LOGIN,
            entityType: ENTITY_TYPES.ADMIN,
            entityId: admin.id,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent']
        });

        console.log(`✅ Admin logged in: ${admin.username}`);

        return res.json({
            access: token,
            user: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                must_change_password: admin.must_change_password === 1
            }
        });

    } catch (error: any) {
        console.error("Admin login error:", error);
        return res.status(500).json({ error: "Login fehlgeschlagen" });
    }
});

/**
 * POST /api/admin-auth/logout
 * Invalidate admin session
 */
router.post("/logout", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Token ')) {
        const token = authHeader.substring(6);

        try {
            // Get admin for logging
            const session = await db.get<any>(
                'SELECT s.*, a.username FROM admin_sessions s JOIN admin_users a ON s.admin_id = a.id WHERE s.token = ?',
                [token]
            );

            // Delete session
            await db.run('DELETE FROM admin_sessions WHERE token = ?', [token]);

            if (session) {
                await logActivity({
                    adminUsername: session.username,
                    actionType: ACTION_TYPES.ADMIN_LOGOUT,
                    entityType: ENTITY_TYPES.ADMIN,
                    entityId: session.admin_id,
                    ipAddress: req.ip || req.socket.remoteAddress
                });
            }
        } catch (error) {
            console.error("Error during logout:", error);
        }
    }

    return res.json({ success: true });
});

/**
 * GET /api/admin-auth/me
 * Get current admin info
 */
router.get("/me", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Token ')) {
        return res.status(401).json({ error: "Nicht authentifiziert" });
    }

    const token = authHeader.substring(6);

    try {
        // Find valid session
        const session = await db.get<any>(
            `SELECT * FROM admin_sessions WHERE token = ? AND expires_at > datetime('now')`,
            [token]
        );

        if (!session) {
            return res.status(401).json({ error: "Session abgelaufen" });
        }

        // Get admin
        const admin = await db.get<any>(
            'SELECT id, username, email, must_change_password, created_at, last_login FROM admin_users WHERE id = ?',
            [session.admin_id]
        );

        if (!admin) {
            return res.status(401).json({ error: "Admin nicht gefunden" });
        }

        return res.json({
            id: admin.id,
            username: admin.username,
            email: admin.email,
            must_change_password: admin.must_change_password === 1,
            created_at: admin.created_at,
            last_login: admin.last_login
        });

    } catch (error: any) {
        console.error("Error in /me:", error);
        return res.status(500).json({ error: "Fehler beim Abrufen der Benutzerdaten" });
    }
});

/**
 * POST /api/admin-auth/request-reset
 * Request password reset email
 */
router.post("/request-reset", async (req: Request, res: Response) => {
    const { username, email } = req.body;

    if (!username && !email) {
        return res.status(400).json({ error: "Benutzername oder E-Mail erforderlich" });
    }

    try {
        // Find admin
        let admin;
        if (username) {
            admin = await db.get<any>(
                'SELECT * FROM admin_users WHERE LOWER(username) = LOWER(?)',
                [username]
            );
        } else {
            admin = await db.get<any>(
                'SELECT * FROM admin_users WHERE LOWER(email) = LOWER(?)',
                [email]
            );
        }

        // Always return success for security (don't reveal if user exists)
        if (!admin) {
            console.log(`Password reset requested for non-existent user: ${username || email}`);
            return res.json({ success: true, message: "Falls ein Account existiert, wurde eine E-Mail gesendet." });
        }

        // Generate reset token
        const resetToken = generateToken();
        const tokenId = randomUUID();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

        // Store token
        await db.run(
            `INSERT INTO password_reset_tokens (id, admin_id, token, created_at, expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [tokenId, admin.id, resetToken, now.toISOString(), expiresAt.toISOString()]
        );

        // Send email
        const emailSent = await sendPasswordResetEmail(
            admin.email,
            admin.username,
            resetToken
        );

        // Log activity
        await logActivity({
            adminUsername: admin.username,
            actionType: ACTION_TYPES.PASSWORD_RESET_REQUESTED,
            entityType: ENTITY_TYPES.ADMIN,
            entityId: admin.id,
            ipAddress: req.ip || req.socket.remoteAddress
        });

        if (!emailSent) {
            console.warn('Password reset email could not be sent (SMTP not configured)');
        }

        return res.json({
            success: true,
            message: "Falls ein Account existiert, wurde eine E-Mail gesendet."
        });

    } catch (error: any) {
        console.error("Password reset request error:", error);
        return res.status(500).json({ error: "Fehler bei der Anfrage" });
    }
});

/**
 * POST /api/admin-auth/reset-password
 * Set new password with reset token
 */
router.post("/reset-password", async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: "Token und neues Passwort erforderlich" });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ error: "Passwort muss mindestens 8 Zeichen lang sein" });
    }

    try {
        // Find valid token
        const resetToken = await db.get<any>(
            `SELECT * FROM password_reset_tokens 
             WHERE token = ? AND expires_at > datetime('now') AND used = 0`,
            [token]
        );

        if (!resetToken) {
            return res.status(400).json({ error: "Ungültiger oder abgelaufener Token" });
        }

        // Get admin
        const admin = await db.get<any>(
            'SELECT * FROM admin_users WHERE id = ?',
            [resetToken.admin_id]
        );

        if (!admin) {
            return res.status(400).json({ error: "Admin nicht gefunden" });
        }

        // Update password
        const newPasswordHash = hashPassword(newPassword);
        await db.run(
            'UPDATE admin_users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
            [newPasswordHash, admin.id]
        );

        // Mark token as used
        await db.run(
            'UPDATE password_reset_tokens SET used = 1 WHERE id = ?',
            [resetToken.id]
        );

        // Invalidate all existing sessions
        await db.run(
            'DELETE FROM admin_sessions WHERE admin_id = ?',
            [admin.id]
        );

        // Log activity
        await logActivity({
            adminUsername: admin.username,
            actionType: ACTION_TYPES.PASSWORD_CHANGED,
            entityType: ENTITY_TYPES.ADMIN,
            entityId: admin.id,
            ipAddress: req.ip || req.socket.remoteAddress
        });

        console.log(`✅ Password reset for admin: ${admin.username}`);

        return res.json({ success: true, message: "Passwort erfolgreich geändert" });

    } catch (error: any) {
        console.error("Password reset error:", error);
        return res.status(500).json({ error: "Fehler beim Zurücksetzen des Passworts" });
    }
});

export default router;
