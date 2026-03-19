import { Router, type Request, type Response } from "express";
import { logger } from "@utils/logger";
import { validate } from '../middleware/validate';
import { loginSchema, changePasswordSchema } from '../middleware/schemas';
import { jwtService } from '../services/auth/jwtService';
import { z } from 'zod';

// Flexible login: accepts email OR username
const flexLoginSchema = z.object({
    email: z.string().max(255).optional(),
    username: z.string().max(64).optional(),
    password: z.string().min(1, 'Passwort erforderlich').max(128),
    tenant: z.string().max(255).optional(),
    device_id: z.string().max(128).optional(),
    device_name: z.string().max(128).optional(),
}).refine(d => d.email || d.username, { message: 'E-Mail oder Benutzername erforderlich' });
import * as db from "../services/core/database";
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

const router = Router();

// Generate session token
function generateToken(): string {
    return randomUUID() + '-' + Date.now().toString(36);
}

// Ensure user_sessions table exists for device tracking
async function ensureUserSessionsTable() {
    await db.run(`
        CREATE TABLE IF NOT EXISTS user_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            device_id TEXT NOT NULL,
            token TEXT,
            ip_address TEXT,
            user_agent TEXT,
            last_seen TEXT DEFAULT CURRENT_TIMESTAMP,
            is_active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

/**
 * POST /api/auth/login
 * Login endpoint for dashboard with device limit enforcement
 */
router.post("/login", validate(flexLoginSchema), async (req: Request, res: Response) => {
    const { email, username, password, tenant, device_id } = req.body;
    const loginIdentifier = email || username;
    const deviceId = device_id || req.headers['x-device-id'] || `unknown-${Date.now()}`;

    if (!loginIdentifier || !password) {
        return res.status(400).json({ error: "Email/Username and password are required" });
    }

    try {
        // Find user by email OR username
        const user = await db.get<any>(
            'SELECT * FROM users WHERE (email = ? OR username = ?) AND is_active = 1',
            [loginIdentifier.toLowerCase().trim(), loginIdentifier.trim()]
        );

        if (!user) {
            return res.status(401).json({ error: "Invalid email/username or password" });
        }

        // Verify password using bcrypt
        const passwordValid = await bcrypt.compare(password, user.password_hash);
        if (!passwordValid) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // ── Device Limit Check ──────────────────────────────────────
        await ensureUserSessionsTable();

        const merchantId = user.merchant_id;

        if (merchantId) {
            // Get tenant limits
            let maxDevices = 2; // default
            try {
                const settings = await db.get<any>(
                    'SELECT max_devices FROM tenant_settings WHERE tenant_id = ?',
                    [String(merchantId)]
                );
                if (settings) maxDevices = settings.max_devices || 2;
            } catch (err) { logger.warn('[Auth] Table check error', { error: err }); }

            // Count active devices for this tenant (excluding this device if already registered)
            const activeDevicesResult = await db.get<any>(
                `SELECT COUNT(DISTINCT device_id) as count FROM user_sessions
                 WHERE user_id IN (SELECT id FROM users WHERE merchant_id = ?)
                 AND is_active = 1 AND device_id != ?`,
                [String(merchantId), deviceId]
            );
            const activeDeviceCount = activeDevicesResult?.count || 0;

            // If this device is NEW and would exceed the limit → block
            const existingDevice = await db.get<any>(
                'SELECT id FROM user_sessions WHERE device_id = ? AND is_active = 1',
                [deviceId]
            );

            if (!existingDevice && activeDeviceCount >= maxDevices) {
                logger.info(`⛔ Device limit reached for tenant ${merchantId}: ${activeDeviceCount}/${maxDevices}`);
                return res.status(403).json({
                    error: "DEVICE_LIMIT_REACHED",
                    message: "Gerätelimit erreicht. Kontaktieren Sie Ihren Verkäufer für weitere Zugänge.",
                    current_devices: activeDeviceCount,
                    max_devices: maxDevices,
                    code: "DEVICE_LIMIT_REACHED"
                });
            }
        }

        // ── Create Session ──────────────────────────────────────────
        const sessionId = `session-${randomUUID()}`;
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const now = new Date().toISOString();

        await db.run(
            'INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
            [sessionId, user.id, token, expiresAt.toISOString(), now]
        );

        // ── Track Device ────────────────────────────────────────────
        try {
            // Upsert device session
            await db.run(
                `INSERT INTO user_sessions (id, user_id, device_id, token, ip_address, user_agent, last_seen, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                 ON CONFLICT(id) DO UPDATE SET last_seen = ?, is_active = 1, token = ?`,
                [
                    `ds-${deviceId}`,
                    user.id,
                    deviceId,
                    token,
                    req.ip || '',
                    req.headers['user-agent'] || '',
                    now,
                    now,
                    token
                ]
            );
        } catch (err) {
            // Device tracking is best-effort, don't fail login
            logger.warn('Device tracking failed:', err);
        }

        // Update last login
        await db.run('UPDATE users SET last_login = ? WHERE id = ?', [now, user.id]);

        // Get tenant name from company (not hardcoded)
        let tenantName = 'Dashboard';
        try {
            const companyUsers = await db.all<any>(
                'SELECT DISTINCT name FROM users WHERE merchant_id = ? LIMIT 1',
                [String(merchantId)]
            );
            if (companyUsers && companyUsers.length > 0) {
                tenantName = companyUsers[0]?.name || tenantName;
            }
        } catch (err) { logger.warn('[Auth] Tenant lookup error', { error: err }); }

        // Issue JWT tokens alongside legacy session
        const jwtTokens = jwtService.generateTokenPair({
            id: user.id,
            email: user.email,
            role: user.role,
            merchantId: user.merchant_id || '',
        });

        // Return session data + JWT tokens
        const response = {
            access: token,
            refresh: token,
            // JWT tokens (new clients should use these)
            jwt: {
                accessToken: jwtTokens.accessToken,
                refreshToken: jwtTokens.refreshToken,
                expiresIn: jwtTokens.expiresIn,
                tokenType: jwtTokens.tokenType,
            },
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            },
            tenant: {
                id: user.merchant_id || 'dealer-demo-001',
                name: tenantName,
                role: user.role
            }
        };

        logger.info(`✅ User logged in: ${user.email} (${user.role}) on device ${deviceId}`);
        return res.status(200).json(response);

    } catch (error: any) {
        logger.error("Error in POST /api/auth/login:", error);
        return res.status(500).json({
            error: "Login failed",
            details: error?.message ?? String(error)
        });
    }
});

/**
 * POST /api/auth/logout
 * Logout endpoint — also deactivates device session
 */
router.post("/logout", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    // Also blacklist JWT if present
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const bearerToken = authHeader.substring(7);
        await jwtService.blacklistToken(bearerToken);
    }

    if (authHeader && authHeader.startsWith('Token ')) {
        const token = authHeader.substring(6);

        try {
            // Delete session
            await db.run('DELETE FROM sessions WHERE token = ?', [token]);

            // Deactivate device session
            try {
                await db.run('UPDATE user_sessions SET is_active = 0 WHERE token = ?', [token]);
            } catch (err) { logger.warn('[Auth] Password migration error', { error: err }); }

            logger.info('✅ User logged out, device session deactivated');
        } catch (error) {
            logger.error("Error deleting session:", error);
        }
    }

    return res.status(200).json({ success: true });
});

/**
 * POST /api/auth/refresh
 * Rotate JWT refresh token → new access + refresh pair
 */
router.post("/refresh", async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ error: "refreshToken is required" });
    }

    const newTokens = await jwtService.rotateRefreshToken(refreshToken);
    if (!newTokens) {
        return res.status(401).json({ error: "Invalid or expired refresh token" });
    }

    return res.json({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: newTokens.expiresIn,
        tokenType: newTokens.tokenType,
    });
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get("/me", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Token ')) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const token = authHeader.substring(6);

    try {
        // Find session with proper PostgreSQL timestamp comparison
        logger.info(`[Auth/Me] Checking session token (Length: ${token.length})`);

        const session = await db.get<any>(
            'SELECT * FROM sessions WHERE token = ? AND expires_at > NOW()',
            [token]
        );

        if (!session) {
            logger.info(`[Auth/Me] Session not found or expired.`);
            return res.status(401).json({ error: "Invalid or expired session" });
        }

        logger.info(`[Auth/Me] Session valid for user ${session.user_id}`);

        // Get user
        const user = await db.get<any>(
            'SELECT * FROM users WHERE id = ? AND is_active = 1',
            [session.user_id]
        );

        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        // Extract first and last name from full_name
        const nameParts = (user.full_name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        return res.status(200).json({
            id: user.id,
            email: user.email,
            username: user.username,
            first_name: firstName,
            last_name: lastName,
            full_name: user.full_name,
            role: user.role,
            merchant_id: user.merchant_id,
            is_owner: user.role === 'owner'
        });

    } catch (error: any) {
        logger.error("Error in GET /api/auth/me:", error);
        return res.status(500).json({
            error: "Failed to get user info",
            details: error?.message ?? String(error)
        });
    }
});

/**
 * GET /api/auth/me/tenants
 * Get tenant memberships for current user
 */
router.get("/me/tenants", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Token ')) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const token = authHeader.substring(6);

    try {
        // Find session with proper PostgreSQL timestamp comparison
        const session = await db.get<any>(
            'SELECT * FROM sessions WHERE token = ? AND expires_at > NOW()',
            [token]
        );

        if (!session) {
            return res.status(401).json({ error: "Invalid or expired session" });
        }

        // Get user
        const user = await db.get<any>(
            'SELECT * FROM users WHERE id = ? AND is_active = 1',
            [session.user_id]
        );

        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        // Return tenant memberships
        // Use user's company name (name field) as tenant name
        let tenantName = user.name || user.full_name || 'Dashboard';

        const tenants = [{
            id: 1,
            tenant: user.merchant_id || 1,
            tenant_name: tenantName,
            tenant_slug: user.merchant_id || 'dealer-demo-001',
            role: user.role,
            is_active: true
        }];

        return res.status(200).json(tenants);

    } catch (error: any) {
        logger.error("Error in GET /api/auth/me/tenants:", error);
        return res.status(500).json({
            error: "Failed to get tenants",
            details: error?.message ?? String(error)
        });
    }
});

router.post("/change-password", validate(z.object({
    oldPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
})), async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const { oldPassword, newPassword } = req.body;

    if (!authHeader || !authHeader.startsWith('Token ')) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: "Old and new password required" });
    }

    const token = authHeader.substring(6);

    try {
        // Find session with proper PostgreSQL timestamp comparison
        const session = await db.get<any>(
            'SELECT * FROM sessions WHERE token = ? AND expires_at > NOW()',
            [token]
        );

        if (!session) return res.status(401).json({ error: "Invalid session" });

        const user = await db.get<any>(
            'SELECT * FROM users WHERE id = ?',
            [session.user_id]
        );

        if (!user) return res.status(404).json({ error: "User not found" });

        // Verify old password using bcrypt
        const oldPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
        if (!oldPasswordValid) {
            return res.status(400).json({ error: "Incorrect old password" });
        }

        // Set new password using bcrypt
        const newHash = await bcrypt.hash(newPassword, 10);
        await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);

        return res.json({ success: true, message: "Passwort erfolgreich geändert" });

    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/auth/team/
 * Get team members for current user's tenant
 */
router.get("/team/", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Token ')) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const token = authHeader.substring(6);

    try {
        // Find session
        const session = await db.get<any>(
            'SELECT * FROM sessions WHERE token = ? AND expires_at > NOW()',
            [token]
        );

        if (!session) {
            return res.status(401).json({ error: "Invalid or expired session" });
        }

        // Get user to find their merchant_id
        const user = await db.get<any>(
            'SELECT * FROM users WHERE id = ? AND is_active = 1',
            [session.user_id]
        );

        if (!user) {
            return res.status(401).json({ error: "User not found" });
        }

        // Get all team members with same merchant_id
        const teamMembers = await db.all<any>(
            'SELECT id, email, username, full_name, role, created_at FROM users WHERE merchant_id = ? AND is_active = 1',
            [user.merchant_id]
        );

        return res.status(200).json(teamMembers);

    } catch (error: any) {
        logger.error("Error in GET /api/auth/team:", error);
        return res.status(500).json({
            error: "Failed to get team",
            details: error?.message ?? String(error)
        });
    }
});

export default router;
