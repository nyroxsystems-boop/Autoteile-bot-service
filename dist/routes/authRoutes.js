"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db = __importStar(require("../services/core/database"));
const crypto = __importStar(require("crypto"));
const crypto_1 = require("crypto");
const router = (0, express_1.Router)();
// Hash password using SHA-256
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}
// Generate session token
function generateToken() {
    return (0, crypto_1.randomUUID)() + '-' + Date.now().toString(36);
}
/**
 * POST /api/auth/login
 * Login endpoint for dashboard
 */
router.post("/login", async (req, res) => {
    const { email, password, tenant } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }
    try {
        // Find user by email
        const user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email.toLowerCase().trim()]);
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        // Verify password
        const passwordHash = hashPassword(password);
        if (user.password_hash !== passwordHash) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        // Create session
        const sessionId = `session-${(0, crypto_1.randomUUID)()}`;
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        const now = new Date().toISOString();
        await db.run('INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)', [sessionId, user.id, token, expiresAt.toISOString(), now]);
        // Update last login
        await db.run('UPDATE users SET last_login = ? WHERE id = ?', [now, user.id]);
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
    }
    catch (error) {
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
router.post("/logout", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Token ')) {
        const token = authHeader.substring(6);
        try {
            // Delete session
            await db.run('DELETE FROM sessions WHERE token = ?', [token]);
            console.log('✅ User logged out');
        }
        catch (error) {
            console.error("Error deleting session:", error);
        }
    }
    return res.status(200).json({ success: true });
});
/**
 * GET /api/auth/me
 * Get current user info
 */
router.get("/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Token ')) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    const token = authHeader.substring(6);
    try {
        // Find session
        console.log(`[Auth/Me] Checking session token (Length: ${token.length})`);
        const session = await db.get('SELECT * FROM sessions WHERE token = ?', [token]);
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
        const user = await db.get('SELECT * FROM users WHERE id = ? AND is_active = 1', [session.user_id]);
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
    }
    catch (error) {
        console.error("Error in GET /api/auth/me:", error);
        return res.status(500).json({
            error: "Failed to get user info",
            details: error?.message ?? String(error)
        });
    }
});
router.post("/change-password", async (req, res) => {
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
        const session = await db.get('SELECT * FROM sessions WHERE token = ?', [token]);
        if (!session)
            return res.status(401).json({ error: "Invalid session" });
        const user = await db.get('SELECT * FROM users WHERE id = ?', [session.user_id]);
        if (!user)
            return res.status(404).json({ error: "User not found" });
        // Verify old password
        const oldHash = hashPassword(oldPassword);
        if (user.password_hash !== oldHash) {
            return res.status(400).json({ error: "Incorrect old password" });
        }
        // Set new password
        const newHash = hashPassword(newPassword);
        await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id]);
        return res.json({ success: true, message: "Passwort erfolgreich geändert" });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.default = router;
