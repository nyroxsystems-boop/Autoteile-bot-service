import { Router, type Request, type Response } from "express";
import * as db from "../services/core/database";
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';

const router = Router();

// Generate session token
function generateToken(): string {
    return randomUUID() + '-' + Date.now().toString(36);
}

/**
 * POST /api/auth/login
 * Login endpoint for dashboard
 */
router.post("/login", async (req: Request, res: Response) => {
    const { email, username, password, tenant } = req.body;
    // Accept 'email' or 'username' field, or a combined 'login' field if the frontend sends that.
    // Dashboard sends 'email' field currently even if it's a username in the UI placeholder.
    const loginIdentifier = email || username;

    if (!loginIdentifier || !password) {
        return res.status(400).json({ error: "Email/Username and password are required" });
    }

    try {
        // Find user by email OR username
        // We compare lowercase for email, and strict or lowercase for username?
        // Let's safe-bet: check both.
        const user = await db.get<any>(
            'SELECT * FROM users WHERE (email = ? OR username = ?) AND is_active = 1',
            [loginIdentifier.toLowerCase().trim(), loginIdentifier.trim()]
        );

        if (!user) {
            return res.status(401).json({ error: "Invalid email/username or password" });
        }

        // Verify password using bcrypt (matches how passwords are stored)
        const passwordValid = await bcrypt.compare(password, user.password_hash);

        if (!passwordValid) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Create session
        const sessionId = `session-${randomUUID()}`;
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const now = new Date().toISOString();

        await db.run(
            'INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
            [sessionId, user.id, token, expiresAt.toISOString(), now]
        );

        // Update last login
        await db.run(
            'UPDATE users SET last_login = ? WHERE id = ?',
            [now, user.id]
        );

        // Return session data
        const response = {
            access: token,
            refresh: token, // Using same token for simplicity
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            },
            tenant: {
                id: user.merchant_id || 'dealer-demo-001',
                name: 'AutoTeile Müller GmbH',
                role: user.role
            }
        };

        console.log(`✅ User logged in: ${user.email} (${user.role})`);
        return res.status(200).json(response);

    } catch (error: any) {
        console.error("Error in POST /api/auth/login:", error);
        return res.status(500).json({
            error: "Login failed",
            details: error?.message ?? String(error)
        });
    }
});

/**
 * POST /api/auth/logout
 * Logout endpoint
 */
router.post("/logout", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Token ')) {
        const token = authHeader.substring(6);

        try {
            // Delete session
            await db.run('DELETE FROM sessions WHERE token = ?', [token]);
            console.log('✅ User logged out');
        } catch (error) {
            console.error("Error deleting session:", error);
        }
    }

    return res.status(200).json({ success: true });
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
        // Find session
        console.log(`[Auth/Me] Checking session token (Length: ${token.length})`);

        const session = await db.get<any>(
            'SELECT * FROM sessions WHERE token = ?',
            [token]
        );

        if (!session) {
            console.log(`[Auth/Me] Session not found in DB.`);
            return res.status(401).json({ error: "Invalid or expired session" });
        }

        const now = new Date().toISOString();
        if (session.expires_at < now) {
            console.log(`[Auth/Me] Session expired. Exp: ${session.expires_at}, Now: ${now}`);
            return res.status(401).json({ error: "Invalid or expired session" });
        }

        console.log(`[Auth/Me] Session valid for user ${session.user_id}`);

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
        console.error("Error in GET /api/auth/me:", error);
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
        // Find session
        const session = await db.get<any>(
            'SELECT * FROM sessions WHERE token = ?',
            [token]
        );

        if (!session) {
            return res.status(401).json({ error: "Invalid or expired session" });
        }

        const now = new Date().toISOString();
        if (session.expires_at < now) {
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
        // For now, return single tenant based on user's merchant_id
        const tenants = [{
            id: 1,
            tenant: user.merchant_id || 1,
            tenant_name: 'AutoTeile Müller GmbH',
            tenant_slug: user.merchant_id || 'dealer-demo-001',
            role: user.role,
            is_active: true
        }];

        return res.status(200).json(tenants);

    } catch (error: any) {
        console.error("Error in GET /api/auth/me/tenants:", error);
        return res.status(500).json({
            error: "Failed to get tenants",
            details: error?.message ?? String(error)
        });
    }
});

router.post("/change-password", async (req: Request, res: Response) => {
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
        const session = await db.get<any>(
            'SELECT * FROM sessions WHERE token = ?',
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

export default router;
