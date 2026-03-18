/**
 * Admin Authentication Routes
 * Separate auth system for platform administrators
 */

import { Router, type Request, type Response } from "express";
import { logger } from "@utils/logger";
import { validate } from '../middleware/validate';
import { adminLoginSchema, requestResetSchema, resetPasswordSchema, updateEmailSchema, adminChangePasswordSchema, updateSignatureSchema } from '../middleware/schemas';
import * as db from "../services/core/database";
import { randomUUID, randomBytes } from "crypto";
import * as bcrypt from 'bcrypt';
import { sendPasswordResetEmail } from "../services/core/emailService";
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from "../services/core/activityLogger";

const router = Router();

const BCRYPT_ROUNDS = 10;

// Hash password using bcrypt (secure)
async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Check if a hash is an old SHA-256 hash (64 hex chars) vs bcrypt ($2b$...)
function isLegacySha256Hash(hash: string): boolean {
    return /^[a-f0-9]{64}$/.test(hash);
}

// Verify password against hash (supports both legacy SHA-256 and bcrypt)
async function verifyPassword(password: string, hash: string): Promise<boolean> {
    if (isLegacySha256Hash(hash)) {
        // Legacy SHA-256 check (for migration)
        const { createHash } = await import('crypto');
        const sha256Hash = createHash('sha256').update(password).digest('hex');
        return sha256Hash === hash;
    }
    // Modern bcrypt check
    return bcrypt.compare(password, hash);
}

// Generate secure token
function generateToken(): string {
    return randomBytes(48).toString('hex');
}

/**
 * POST /api/admin-auth/login
 * Admin login with username + password
 */
router.post("/login", validate(adminLoginSchema), async (req: Request, res: Response) => {
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

        // Verify password (supports both SHA-256 legacy and bcrypt)
        const passwordValid = await verifyPassword(password, admin.password_hash);
        if (!passwordValid) {
            return res.status(401).json({ error: "Ungültige Anmeldedaten" });
        }

        // Auto-upgrade: if still using SHA-256, migrate to bcrypt transparently
        if (isLegacySha256Hash(admin.password_hash)) {
            const newHash = await hashPassword(password);
            await db.run(
                'UPDATE admin_users SET password_hash = ? WHERE id = ?',
                [newHash, admin.id]
            );
            logger.info(`🔐 Auto-upgraded password hash to bcrypt for admin: ${admin.username}`);
        }

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

        logger.info(`✅ Admin logged in: ${admin.username}`);

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
        logger.error("Admin login error:", error);
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
            logger.error("Error during logout:", error);
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
            `SELECT * FROM admin_sessions WHERE token = ? AND expires_at::TIMESTAMP > NOW()`,
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
        logger.error("Error in /me:", error);
        return res.status(500).json({ error: "Fehler beim Abrufen der Benutzerdaten" });
    }
});

/**
 * POST /api/admin-auth/request-reset
 * Request password reset email
 */
router.post("/request-reset", validate(requestResetSchema), async (req: Request, res: Response) => {
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
            logger.info(`Password reset requested for non-existent user: ${username || email}`);
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
            logger.warn('Password reset email could not be sent (SMTP not configured)');
        }

        return res.json({
            success: true,
            message: "Falls ein Account existiert, wurde eine E-Mail gesendet."
        });

    } catch (error: any) {
        logger.error("Password reset request error:", error);
        return res.status(500).json({ error: "Fehler bei der Anfrage" });
    }
});

/**
 * POST /api/admin-auth/reset-password
 * Set new password with reset token
 */
router.post("/reset-password", validate(resetPasswordSchema), async (req: Request, res: Response) => {
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
             WHERE token = ? AND expires_at::TIMESTAMP > NOW() AND used = 0`,
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

        // Update password with bcrypt
        const newPasswordHash = await hashPassword(newPassword);
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

        logger.info(`✅ Password reset for admin: ${admin.username}`);

        return res.json({ success: true, message: "Passwort erfolgreich geändert" });

    } catch (error: any) {
        logger.error("Password reset error:", error);
        return res.status(500).json({ error: "Fehler beim Zurücksetzen des Passworts" });
    }
});

/**
 * PATCH /api/admin-auth/update-email
 * Update current admin's email address (for password reset capability)
 */
router.patch("/update-email", validate(updateEmailSchema), async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const { email } = req.body;

    if (!authHeader || !authHeader.startsWith('Token ')) {
        return res.status(401).json({ error: "Nicht authentifiziert" });
    }

    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: "Gültige E-Mail-Adresse erforderlich" });
    }

    const token = authHeader.substring(6);

    try {
        // Find valid session
        const session = await db.get<any>(
            `SELECT * FROM admin_sessions WHERE token = ? AND expires_at::TIMESTAMP > NOW()`,
            [token]
        );

        if (!session) {
            return res.status(401).json({ error: "Session abgelaufen" });
        }

        // Update email
        await db.run(
            'UPDATE admin_users SET email = ? WHERE id = ?',
            [email.toLowerCase().trim(), session.admin_id]
        );

        // Get updated admin
        const admin = await db.get<any>(
            'SELECT username FROM admin_users WHERE id = ?',
            [session.admin_id]
        );

        logger.info(`✅ Email updated for admin: ${admin?.username} -> ${email}`);

        return res.json({
            success: true,
            message: "E-Mail-Adresse aktualisiert",
            email: email.toLowerCase().trim()
        });

    } catch (error: any) {
        logger.error("Update email error:", error);
        return res.status(500).json({ error: "Fehler beim Aktualisieren der E-Mail" });
    }
});

/**
 * POST /api/admin-auth/fix-emails (one-time migration helper)
 * Updates all admin emails to correct addresses
 */
router.post("/fix-emails", async (_req: Request, res: Response) => {
    const emailMap: Record<string, string> = {
        'Elias': 'elias.zafar@partsunion.de',
        'Aaron': 'aaron.vogt@partsunion.de',
        'Fecat': 'fecat.blawat@partsunion.de',
        'Bardia': 'bardia.bagherian@partsunion.de'
    };

    try {
        for (const [username, email] of Object.entries(emailMap)) {
            await db.run(
                'UPDATE admin_users SET email = ? WHERE username = ?',
                [email, username]
            );
            logger.info(`✅ Fixed email for ${username}: ${email}`);
        }

        return res.json({ success: true, message: "Admin-E-Mails aktualisiert" });
    } catch (error: any) {
        logger.error("Fix emails error:", error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/admin-auth/change-password
 * Change current admin's password
 */
router.post("/change-password", validate(adminChangePasswordSchema), async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const { currentPassword, newPassword } = req.body;

    if (!authHeader || !authHeader.startsWith('Token ')) {
        return res.status(401).json({ error: "Nicht authentifiziert" });
    }

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Aktuelles und neues Passwort erforderlich" });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ error: "Neues Passwort muss mindestens 8 Zeichen haben" });
    }

    const token = authHeader.substring(6);

    try {
        // Find valid session
        const session = await db.get<any>(
            `SELECT s.*, a.password_hash FROM admin_sessions s 
             JOIN admin_users a ON s.admin_id = a.id 
             WHERE s.token = ? AND s.expires_at::TIMESTAMP > NOW()`,
            [token]
        );

        if (!session) {
            return res.status(401).json({ error: "Session abgelaufen" });
        }

        // Verify current password (supports both hash formats)
        const currentValid = await verifyPassword(currentPassword, session.password_hash);
        if (!currentValid) {
            return res.status(400).json({ error: "Aktuelles Passwort ist falsch" });
        }

        // Update password with bcrypt
        const newHash = await hashPassword(newPassword);
        await db.run(
            'UPDATE admin_users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
            [newHash, session.admin_id]
        );

        logger.info(`✅ Password changed for admin ID: ${session.admin_id}`);

        return res.json({ success: true, message: "Passwort erfolgreich geändert" });

    } catch (error: any) {
        logger.error("Change password error:", error);
        return res.status(500).json({ error: "Fehler beim Ändern des Passworts" });
    }
});

/**
 * PATCH /api/admin-auth/update-signature
 * Update current admin's email signature
 */
router.patch("/update-signature", validate(updateSignatureSchema), async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const { signature } = req.body;

    if (!authHeader || !authHeader.startsWith('Token ')) {
        return res.status(401).json({ error: "Nicht authentifiziert" });
    }

    const token = authHeader.substring(6);

    try {
        // Find valid session
        const session = await db.get<any>(
            `SELECT * FROM admin_sessions WHERE token = ? AND expires_at::TIMESTAMP > NOW()`,
            [token]
        );

        if (!session) {
            return res.status(401).json({ error: "Session abgelaufen" });
        }

        // Update signature
        await db.run(
            'UPDATE admin_users SET signature = ? WHERE id = ?',
            [signature || '', session.admin_id]
        );

        return res.json({ success: true, message: "Signatur aktualisiert" });

    } catch (error: any) {
        logger.error("Update signature error:", error);
        return res.status(500).json({ error: "Fehler beim Aktualisieren der Signatur" });
    }
});

/**
 * GET /api/admin-auth/list-admins
 * List all admin users (for debugging/management)
 */
router.get("/list-admins", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Token ')) {
        return res.status(401).json({ error: "Nicht authentifiziert" });
    }

    try {
        const admins = await db.all<any>(
            `SELECT id, username, email, full_name, created_at FROM admin_users ORDER BY id`
        );

        return res.json({ admins });
    } catch (error: any) {
        logger.error("List admins error:", error);
        return res.status(500).json({ error: "Fehler beim Abrufen der Admins" });
    }
});

/**
 * PUT /api/admin-auth/update-email
 * Update an admin user's email address
 */
router.put("/update-email", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const { adminId, email } = req.body;

    if (!authHeader || !authHeader.startsWith('Token ')) {
        return res.status(401).json({ error: "Nicht authentifiziert" });
    }

    if (!adminId || !email) {
        return res.status(400).json({ error: "Admin ID und E-Mail erforderlich" });
    }

    try {
        await db.run(
            'UPDATE admin_users SET email = ? WHERE id = ?',
            [email, adminId]
        );

        logger.info(`[Admin] Updated email for admin ${adminId} to ${email}`);
        return res.json({ success: true, message: `E-Mail aktualisiert auf ${email}` });

    } catch (error: any) {
        logger.error("Update email error:", error);
        return res.status(500).json({ error: "Fehler beim Aktualisieren der E-Mail" });
    }
});

/**
 * GET /api/admin-auth/profile
 * Get current admin's profile including signature
 */
router.get("/profile", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Token ')) {
        return res.status(401).json({ error: "Nicht authentifiziert" });
    }

    const token = authHeader.substring(6);

    try {
        logger.info(`[Admin/Profile] Checking token (length: ${token.length})`);

        const session = await db.get<any>(
            `SELECT * FROM admin_sessions WHERE token = ? AND expires_at::TIMESTAMP > NOW()`,
            [token]
        );

        logger.info(`[Admin/Profile] Session found: ${!!session}`);

        if (!session) {
            logger.info(`[Admin/Profile] No valid session found for token`);
            return res.status(401).json({ error: "Session abgelaufen" });
        }

        const admin = await db.get<any>(
            `SELECT id, username, email, full_name, signature, 
             CASE WHEN imap_password_encrypted IS NOT NULL THEN true ELSE false END as has_imap_setup, 
             created_at, last_login 
             FROM admin_users WHERE id = ?`,
            [session.admin_id]
        );

        if (!admin) {
            return res.status(404).json({ error: "Admin nicht gefunden" });
        }

        return res.json(admin);

    } catch (error: any) {
        logger.error("[Admin/Profile] Error:", error.message);
        return res.status(500).json({ error: "Fehler beim Abrufen des Profils", details: error.message });
    }
});

export default router;
