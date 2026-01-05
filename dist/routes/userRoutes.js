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
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Apply auth middleware to all routes
router.use(authMiddleware_1.authMiddleware);
// Hash password using SHA-256
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}
/**
 * GET /api/users
 * List all users
 */
router.get("/", async (req, res) => {
    try {
        const users = await db.all(`SELECT id, email, username, full_name, role, merchant_id, is_active, created_at, updated_at, last_login 
       FROM users 
       ORDER BY created_at DESC`);
        return res.status(200).json(users);
    }
    catch (error) {
        console.error("Error in GET /api/users:", error);
        return res.status(500).json({
            error: "Failed to list users",
            details: error?.message ?? String(error)
        });
    }
});
/**
 * GET /api/users/:id
 * Get single user
 */
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const user = await db.get(`SELECT id, email, username, full_name, role, merchant_id, is_active, created_at, updated_at, last_login 
       FROM users 
       WHERE id = ?`, [id]);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.status(200).json(user);
    }
    catch (error) {
        console.error(`Error in GET /api/users/${id}:`, error);
        return res.status(500).json({
            error: "Failed to get user",
            details: error?.message ?? String(error)
        });
    }
});
/**
 * POST /api/users
 * Create new user
 */
router.post("/", async (req, res) => {
    const { email, username, password, full_name, role, merchant_id } = req.body;
    // Validation
    if (!email || !username || !password) {
        return res.status(400).json({
            error: "Email, username, and password are required"
        });
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            error: "Invalid email format"
        });
    }
    // Validate password strength
    if (password.length < 6) {
        return res.status(400).json({
            error: "Password must be at least 6 characters long"
        });
    }
    try {
        // Check if email already exists
        const existingEmail = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
        if (existingEmail) {
            return res.status(400).json({
                error: "Email already exists"
            });
        }
        // Check if username already exists
        const existingUsername = await db.get('SELECT id FROM users WHERE username = ?', [username.toLowerCase().trim()]);
        if (existingUsername) {
            return res.status(400).json({
                error: "Username already exists"
            });
        }
        // Create user
        const userId = `user-${(0, crypto_1.randomUUID)()}`;
        const passwordHash = hashPassword(password);
        const now = new Date().toISOString();
        await db.run(`INSERT INTO users (id, email, username, password_hash, full_name, role, merchant_id, is_active, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`, [
            userId,
            email.toLowerCase().trim(),
            username.toLowerCase().trim(),
            passwordHash,
            full_name || null,
            role || 'staff',
            merchant_id || 'dealer-demo-001',
            now,
            now
        ]);
        // Get created user (without password)
        const user = await db.get(`SELECT id, email, username, full_name, role, merchant_id, is_active, created_at, updated_at 
       FROM users 
       WHERE id = ?`, [userId]);
        console.log(`✅ User created: ${email} (${role || 'staff'})`);
        return res.status(201).json(user);
    }
    catch (error) {
        console.error("Error in POST /api/users:", error);
        return res.status(500).json({
            error: "Failed to create user",
            details: error?.message ?? String(error)
        });
    }
});
/**
 * PUT /api/users/:id
 * Update user
 */
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { email, username, full_name, role, merchant_id, is_active, password } = req.body;
    try {
        // Check if user exists
        const user = await db.get('SELECT id FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const updates = [];
        const values = [];
        if (email !== undefined) {
            // Check if email is already used by another user
            const existing = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email.toLowerCase().trim(), id]);
            if (existing) {
                return res.status(400).json({ error: "Email already exists" });
            }
            updates.push('email = ?');
            values.push(email.toLowerCase().trim());
        }
        if (username !== undefined) {
            // Check if username is already used by another user
            const existing = await db.get('SELECT id FROM users WHERE username = ? AND id != ?', [username.toLowerCase().trim(), id]);
            if (existing) {
                return res.status(400).json({ error: "Username already exists" });
            }
            updates.push('username = ?');
            values.push(username.toLowerCase().trim());
        }
        if (full_name !== undefined) {
            updates.push('full_name = ?');
            values.push(full_name);
        }
        if (role !== undefined) {
            updates.push('role = ?');
            values.push(role);
        }
        if (merchant_id !== undefined) {
            updates.push('merchant_id = ?');
            values.push(merchant_id);
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(is_active ? 1 : 0);
        }
        if (password !== undefined && password.length > 0) {
            if (password.length < 6) {
                return res.status(400).json({
                    error: "Password must be at least 6 characters long"
                });
            }
            updates.push('password_hash = ?');
            values.push(hashPassword(password));
        }
        if (updates.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }
        updates.push('updated_at = ?');
        values.push(new Date().toISOString());
        values.push(id);
        await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
        // Get updated user
        const updatedUser = await db.get(`SELECT id, email, username, full_name, role, merchant_id, is_active, created_at, updated_at, last_login 
       FROM users 
       WHERE id = ?`, [id]);
        console.log(`✅ User updated: ${id}`);
        return res.status(200).json(updatedUser);
    }
    catch (error) {
        console.error(`Error in PUT /api/users/${id}:`, error);
        return res.status(500).json({
            error: "Failed to update user",
            details: error?.message ?? String(error)
        });
    }
});
/**
 * DELETE /api/users/:id
 * Delete user
 */
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        // Check if user exists
        const user = await db.get('SELECT id FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        // Delete user's sessions
        await db.run('DELETE FROM sessions WHERE user_id = ?', [id]);
        // Delete user
        await db.run('DELETE FROM users WHERE id = ?', [id]);
        console.log(`✅ User deleted: ${id}`);
        return res.status(200).json({ success: true });
    }
    catch (error) {
        console.error(`Error in DELETE /api/users/${id}:`, error);
        return res.status(500).json({
            error: "Failed to delete user",
            details: error?.message ?? String(error)
        });
    }
});
exports.default = router;
