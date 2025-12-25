import { Router, type Request, type Response } from "express";
import * as db from "../services/database";
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';

const router = Router();

// Hash password using SHA-256
function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// Generate session token
function generateToken(): string {
    return randomUUID() + '-' + Date.now().toString(36);
}

/**
 * POST /api/auth/login
 * Login endpoint for dashboard
 */
router.post("/login", async (req: Request, res: Response) => {
    const { email, password, tenant } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    try {
        // Find user by email
        const user = await db.get<any>(
            'SELECT * FROM users WHERE email = ? AND is_active = 1',
            [email.toLowerCase().trim()]
        );

        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Verify password
        const passwordHash = hashPassword(password);
        if (user.password_hash !== passwordHash) {
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
        const session = await db.get<any>(
            'SELECT * FROM sessions WHERE token = ? AND datetime(expires_at) > datetime("now")',
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

        return res.status(200).json({
            id: user.id,
            email: user.email,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            merchant_id: user.merchant_id
        });

    } catch (error: any) {
        console.error("Error in GET /api/auth/me:", error);
        return res.status(500).json({
            error: "Failed to get user info",
            details: error?.message ?? String(error)
        });
    }
});

export default router;
