import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import * as bcrypt from 'bcrypt';
import * as db from "../services/core/database";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

// Protect all admin routes
router.use(authMiddleware);

// --- Users / Vertrieb Team ---

router.get("/users", async (req: Request, res: Response) => {
    try {
        const users = await db.all("SELECT * FROM users ORDER BY created_at DESC");
        return res.json(users);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

import { createHash } from "crypto";

// Hash password using bcrypt (matching authRoutes.ts)
async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

router.post("/users", async (req: Request, res: Response) => {
    const { name, email, role, password, tenant_id, username: providedUsername } = req.body;
    if (!email) {
        return res.status(400).json({ error: "Email is required." });
    }

    // ── User Limit Check ──────────────────────────────────────
    if (tenant_id) {
        try {
            await ensureTenantSettingsTable();
            const settings = await db.get<any>(
                'SELECT max_users FROM tenant_settings WHERE tenant_id = ?',
                [String(tenant_id)]
            );
            const maxUsers = settings?.max_users || 10;

            const currentCount = await db.get<any>(
                'SELECT COUNT(*) as count FROM users WHERE merchant_id = ? AND is_active = 1',
                [String(tenant_id)]
            );

            if ((currentCount?.count || 0) >= maxUsers) {
                return res.status(403).json({
                    error: "USER_LIMIT_REACHED",
                    message: "Benutzerlimit erreicht. Kontaktieren Sie Ihren Verkäufer für weitere Zugänge.",
                    current_users: currentCount?.count || 0,
                    max_users: maxUsers,
                    code: "USER_LIMIT_REACHED"
                });
            }
        } catch { /* limit check is best-effort */ }
    }

    const id = randomUUID();
    const createdAt = new Date().toISOString();

    let passwordHash = null;
    if (password) {
        passwordHash = await hashPassword(password);
    } else {
        const defaultPassword = generateSecurePassword();
        passwordHash = await hashPassword(defaultPassword);
    }

    const username = providedUsername || email.split('@')[0];
    const userName = name || username;

    try {
        const sql = `INSERT INTO users (id, name, email, role, created_at, password_hash, is_active, username, merchant_id) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`;
        await db.run(sql, [id, userName, email, role || "sales_rep", createdAt, passwordHash, username, tenant_id || null]);

        return res.json({ id, name: userName, email, role: role || "sales_rep", created_at: createdAt, username });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Reset a user's password (fixes users created with wrong hash)
 */
router.post("/users/:id/reset-password", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    try {
        // Verify user exists
        const user = await db.get<any>('SELECT id, email, username FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Hash with bcrypt (matching authRoutes.ts login verification)
        const passwordHash = await hashPassword(newPassword);

        await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);

        console.log(`✅ Password reset for user: ${user.username || user.email} (${id})`);

        return res.json({
            success: true,
            message: `Password reset for ${user.username || user.email}`,
            user: { id: user.id, username: user.username, email: user.email }
        });
    } catch (err: any) {
        console.error("Password reset error:", err);
        return res.status(500).json({ error: err.message });
    }
});

// --- Devices (real data from user_sessions table) ---

router.get("/tenants/:id/devices", async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        // Query active sessions for users of this tenant
        const devices = await db.all(
            `SELECT s.id, s.device_id, u.name as user, s.last_seen, s.ip_address as ip
             FROM user_sessions s
             JOIN users u ON s.user_id = u.id
             WHERE u.merchant_id = ? AND s.is_active = 1
             ORDER BY s.last_seen DESC`,
            [String(id)]
        );
        return res.json(devices || []);
    } catch (err: any) {
        // Table might not exist yet — return empty
        return res.json([]);
    }
});

router.delete("/tenants/:id/devices/:deviceId", async (req: Request, res: Response) => {
    const { id, deviceId } = req.params;
    try {
        await db.run(
            `UPDATE user_sessions SET is_active = 0 WHERE device_id = ? AND user_id IN (SELECT id FROM users WHERE merchant_id = ?)`,
            [deviceId, String(id)]
        );
        return res.json({ success: true });
    } catch (err: any) {
        return res.json({ success: true }); // Graceful fallback
    }
});

// --- KPIs ---

// --- Tenants / Händler (InvenTree Companies) ---

import { getCompanies, createCompany, InvenTreeCompany } from "@adapters/realInvenTreeAdapter";

// Helper: ensure tenant_settings table exists
async function ensureTenantSettingsTable() {
    await db.run(`
        CREATE TABLE IF NOT EXISTS tenant_settings (
            tenant_id TEXT PRIMARY KEY,
            max_users INTEGER DEFAULT 10,
            max_devices INTEGER DEFAULT 5,
            onboarding_status TEXT DEFAULT 'pending',
            payment_status TEXT DEFAULT 'trial',
            whatsapp_number TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

async function getTenantLimits(tenantId: string): Promise<{ max_users: number, max_devices: number, onboarding_status: string, payment_status: string, whatsapp_number: string | null }> {
    await ensureTenantSettingsTable();
    const row = await db.get<any>('SELECT * FROM tenant_settings WHERE tenant_id = ?', [tenantId]);
    return {
        max_users: row?.max_users || 10,
        max_devices: row?.max_devices || 5,
        onboarding_status: row?.onboarding_status || 'pending',
        payment_status: row?.payment_status || 'trial',
        whatsapp_number: row?.whatsapp_number || null,
    };
}

async function setTenantLimits(tenantId: string, limits: { max_users?: number, max_devices?: number }) {
    await ensureTenantSettingsTable();
    await db.run(
        `INSERT INTO tenant_settings (tenant_id, max_users, max_devices) VALUES (?, ?, ?)
         ON CONFLICT(tenant_id) DO UPDATE SET max_users = ?, max_devices = ?`,
        [tenantId, limits.max_users || 10, limits.max_devices || 5, limits.max_users || 10, limits.max_devices || 5]
    );
}

router.get("/tenants", async (req: Request, res: Response) => {
    try {
        // Tenants are "Companies" in InvenTree (Customers)
        const companies = await getCompanies({ is_customer: true });

        // Map to Dashboard Tenant Format with real data
        const tenants = await Promise.all(companies.map(async (c: any) => {
            const tenantId = String(c.pk);
            const limits = await getTenantLimits(tenantId);

            // Real user count from SQLite
            const userCountResult = await db.get<any>(
                'SELECT COUNT(*) as count FROM users WHERE merchant_id = ?',
                [tenantId]
            );

            return {
                id: c.pk,
                name: c.name,
                slug: c.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                user_count: userCountResult?.count || 0,
                max_users: limits.max_users,
                device_count: 0, // Will be real once user_sessions table exists
                max_devices: limits.max_devices,
                is_active: c.active,
                onboarding_status: limits.onboarding_status,
                payment_status: limits.payment_status,
                whatsapp_number: limits.whatsapp_number || c.phone || '',
                logo_url: c.website || ''
            };
        }));

        return res.json(tenants);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

router.patch("/tenants/:id/limits", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { max_users, max_devices } = req.body;

        await setTenantLimits(id, {
            max_users: Number(max_users) || 10,
            max_devices: Number(max_devices) || 5,
        });

        return res.json({ success: true, id, max_users, max_devices });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

router.post("/tenants", async (req: Request, res: Response) => {
    try {
        const { name, email, website, phone, password, whatsapp_number, logo_url } = req.body;

        // --- Validation ---
        if (!name || !email) {
            return res.status(400).json({ error: "Name and Email are required." });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format." });
        }

        // WhatsApp number validation (if provided)
        if (whatsapp_number) {
            const cleaned = whatsapp_number.replace(/[\s\-()]/g, '');
            if (!/^\+?\d{10,15}$/.test(cleaned)) {
                return res.status(400).json({ error: "Invalid WhatsApp number. Must be 10-15 digits with optional + prefix." });
            }
        }

        // Password strength validation
        if (password && password.length < 8) {
            return res.status(400).json({ error: "Password must be at least 8 characters." });
        }

        // --- Duplicate Check ---
        try {
            const existingCompanies = await getCompanies({ is_customer: true });
            const duplicate = existingCompanies.find((c: any) =>
                c.name.toLowerCase() === name.toLowerCase() || c.email === email
            );

            if (duplicate) {
                return res.status(409).json({
                    error: "A company with this name or email already exists.",
                    existing: { id: duplicate.pk, name: duplicate.name, email: duplicate.email }
                });
            }
        } catch (checkErr: any) {
            console.error("Duplicate check failed:", checkErr.message);
        }

        // Also check SQLite for duplicate email
        const existingUser = await db.get<any>('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(409).json({ error: "A user with this email already exists." });
        }

        // --- Create Company in InvenTree ---
        const payload: InvenTreeCompany = {
            name,
            email: email || null,
            website: logo_url || website || "",
            phone: whatsapp_number || phone || "",
            is_customer: true,
            is_supplier: false,
            active: true,
            description: `Dealer created via Admin Dashboard on ${new Date().toISOString().split('T')[0]}`,
            currency: "EUR"
        };

        let createdCompany;
        try {
            createdCompany = await createCompany(payload);
        } catch (createErr: any) {
            console.error("Failed to create company in WAWI:", {
                message: createErr.message,
                response: createErr.response?.data,
                status: createErr.response?.status,
            });

            if (createErr.response?.data) {
                return res.status(createErr.response.status || 500).json({
                    error: "Failed to create company in WAWI",
                    details: createErr.response.data
                });
            }
            throw createErr;
        }

        const merchantId = String(createdCompany.pk);

        // --- Generate secure initial password ---
        const initialPassword = password || generateSecurePassword();
        const passwordHash = await hashPassword(initialPassword);

        // --- Create Admin User for this Company ---
        const userId = randomUUID();
        const createdAt = new Date().toISOString();
        const username = email.split('@')[0];

        const sql = `INSERT INTO users (id, name, email, role, created_at, password_hash, merchant_id, is_active, username) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`;
        await db.run(sql, [userId, name, email, "merchant", createdAt, passwordHash, merchantId, username]);

        // --- Create tenant settings ---
        await ensureTenantSettingsTable();
        await db.run(
            `INSERT OR IGNORE INTO tenant_settings (tenant_id, whatsapp_number, onboarding_status, payment_status) VALUES (?, ?, 'pending', 'trial')`,
            [merchantId, whatsapp_number || null]
        );

        console.log(`✅ Tenant created: ${name} (ID: ${merchantId}, User: ${username})`);

        // Return result — password only shown once, never stored in plaintext
        return res.json({
            id: createdCompany.pk,
            name: createdCompany.name,
            email: email,
            user_created: {
                id: userId,
                username: username,
                email: email,
                role: "merchant",
                // Only return initial password if it was auto-generated
                // so the admin can share it with the dealer
                initial_password: !password ? initialPassword : undefined,
                password_was_set: !!password
            }
        });
    } catch (err: any) {
        console.error("Tenant creation failed:", err.message);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * Generate a secure random password
 */
function generateSecurePassword(): string {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const bytes = require('crypto').randomBytes(12);
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars[bytes[i] % chars.length];
    }
    return password;
}

router.get("/kpis", async (req: Request, res: Response) => {
    try {
        // All queries in parallel — was sequential before, causing lag
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const [
            tenants,
            totalOrdersResult,
            ordersTodayResult,
            revenueResult,
            doneOrdersResult,
            resolvedOemResult,
            activeUsersResult,
            messagesResult,
        ] = await Promise.all([
            getCompanies({ is_customer: true }),
            db.get<any>("SELECT COUNT(*) as count FROM orders"),
            db.get<any>("SELECT COUNT(*) as count FROM orders WHERE created_at > ?", [yesterday]),
            db.get<any>("SELECT SUM(CAST(total AS REAL)) as revenue FROM orders WHERE status IN ('done', 'completed')"),
            db.get<any>("SELECT COUNT(*) as count FROM orders WHERE status IN ('done', 'completed')"),
            db.get<any>("SELECT COUNT(*) as count FROM orders WHERE oem_number IS NOT NULL AND oem_number != ''"),
            db.get<any>("SELECT COUNT(*) as count FROM users"),
            db.get<any>("SELECT COUNT(*) as count FROM messages"),
        ]);

        const totalOrders = totalOrdersResult?.count || 0;
        const ordersToday = ordersTodayResult?.count || 0;
        const revenue = revenueResult?.revenue || 0;
        const doneOrdersCount = doneOrdersResult?.count || 0;
        const conversionRate = totalOrders > 0 ? Math.round((doneOrdersCount / totalOrders) * 100) : 0;
        const resolvedOemCount = resolvedOemResult?.count || 0;
        const activeUsers = activeUsersResult?.count || 0;
        const messagesSent = messagesResult?.count || 0;

        // Mock history data for charts (last 6 months)
        const history = [
            { name: 'Aug', orders: Math.max(0, totalOrders - 50), revenue: Math.max(0, revenue - 5000) },
            { name: 'Sep', orders: Math.max(0, totalOrders - 40), revenue: Math.max(0, revenue - 4000) },
            { name: 'Okt', orders: Math.max(0, totalOrders - 30), revenue: Math.max(0, revenue - 3000) },
            { name: 'Nov', orders: Math.max(0, totalOrders - 20), revenue: Math.max(0, revenue - 2000) },
            { name: 'Dez', orders: Math.max(0, totalOrders - 10), revenue: Math.max(0, revenue - 1000) },
            { name: 'Jan', orders: totalOrders, revenue: revenue }
        ];

        return res.json({
            sales: {
                totalOrders,
                ordersToday,
                revenue,
                conversionRate
            },
            team: {
                activeUsers,
                callsMade: 0, // Not tracked yet
                messagesSent
            },
            oem: {
                resolvedCount: resolvedOemCount,
                successRate: totalOrders > 0 ? Math.round((resolvedOemCount / totalOrders) * 100) : 0
            },
            history
        });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// --- Onboarding Wizard (Phase 11) ---

import * as onboarding from "../services/core/onboardingService";

router.post("/onboarding/initialize", async (req: Request, res: Response) => {
    try {
        const { name, email } = req.body;
        if (!name || !email) return res.status(400).json({ error: "Name and Email required" });
        const result = await onboarding.initializeOnboarding(name, email);
        return res.json(result);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

router.post("/onboarding/twilio", async (req: Request, res: Response) => {
    try {
        const { sessionId, phoneNumber, sid, token } = req.body;
        const result = await onboarding.configureTwilio(sessionId, phoneNumber, sid, token);
        return res.json(result);
    } catch (err: any) {
        return res.status(400).json({ error: err.message });
    }
});

router.post("/onboarding/import", async (req: Request, res: Response) => {
    try {
        const { sessionId, csvData } = req.body;
        const result = await onboarding.importInventory(sessionId, csvData);
        return res.json(result);
    } catch (err: any) {
        return res.status(400).json({ error: err.message });
    }
});

router.post("/onboarding/shop", async (req: Request, res: Response) => {
    try {
        const { sessionId, shopType, apiKey, shopUrl } = req.body;
        const result = await onboarding.connectShop(sessionId, shopType, apiKey, shopUrl);
        return res.json(result);
    } catch (err: any) {
        return res.status(400).json({ error: err.message });
    }
});

// --- OEM Database Management (Seeder Controls) ---

import { spawn } from "child_process";
import * as path from "path";

// Get OEM Database Stats
router.get("/oem-database/stats", async (_req: Request, res: Response) => {
    try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '../../oem-data/oem-database.sqlite');

        // Check if database exists
        const fs = require('fs');
        if (!fs.existsSync(dbPath)) {
            return res.json({
                exists: false,
                totalRecords: 0,
                sizeBytes: 0,
                brands: []
            });
        }

        const oemDb = new Database(dbPath, { readonly: true });

        const total = oemDb.prepare('SELECT COUNT(*) as count FROM oem_records').get();
        const brands = oemDb.prepare('SELECT brand, COUNT(*) as count FROM oem_records GROUP BY brand ORDER BY count DESC').all();
        const categories = oemDb.prepare('SELECT part_category, COUNT(*) as count FROM oem_records GROUP BY part_category ORDER BY count DESC LIMIT 5').all();

        const stats = fs.statSync(dbPath);

        oemDb.close();

        return res.json({
            exists: true,
            totalRecords: total.count,
            sizeBytes: stats.size,
            sizeMB: (stats.size / 1024 / 1024).toFixed(2),
            brands,
            categories
        });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// Active seeder processes
const activeSeederJobs = new Map<string, { pid: number; status: string; output: string[]; startTime: Date }>();

// Trigger OEM Seeder Script
router.post("/oem-database/seed", async (req: Request, res: Response) => {
    try {
        const { script = 'massive' } = req.body;

        const scriptMap: Record<string, string> = {
            'massive': 'seedOemMassive.js',
            'remaining': 'addRemainingOems.js',
            'standalone': 'seedOemDatabaseStandalone.js'
        };

        const scriptFile = scriptMap[script];
        if (!scriptFile) {
            return res.status(400).json({ error: `Unknown script: ${script}. Use: massive, remaining, standalone` });
        }

        const scriptPath = path.join(__dirname, '../scripts', scriptFile);
        const jobId = `seed-${Date.now()}`;

        // Start the seeder process
        const child = spawn('node', [scriptPath], {
            cwd: path.join(__dirname, '..'),
            stdio: ['ignore', 'pipe', 'pipe']
        });

        const job = {
            pid: child.pid || 0,
            status: 'running',
            output: [] as string[],
            startTime: new Date()
        };

        activeSeederJobs.set(jobId, job);

        child.stdout.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter(l => l.trim());
            job.output.push(...lines.slice(-50)); // Keep last 50 lines
            if (job.output.length > 100) job.output = job.output.slice(-50);
        });

        child.stderr.on('data', (data: Buffer) => {
            job.output.push(`[ERROR] ${data.toString()}`);
        });

        child.on('close', (code: number) => {
            job.status = code === 0 ? 'completed' : 'failed';
        });

        return res.json({
            success: true,
            jobId,
            message: `Started ${scriptFile}`,
            pid: child.pid
        });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// Check seeder job status
router.get("/oem-database/seed/:jobId", async (req: Request, res: Response) => {
    const { jobId } = req.params;
    const job = activeSeederJobs.get(jobId);

    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    return res.json({
        jobId,
        status: job.status,
        pid: job.pid,
        startTime: job.startTime,
        output: job.output.slice(-20) // Last 20 lines
    });
});

// Quick seed - add specific number of records
router.post("/oem-database/quick-seed", async (req: Request, res: Response) => {
    try {
        const { brand = 'VOLKSWAGEN', count = 1000 } = req.body;

        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '../../oem-data/oem-database.sqlite');
        const db = new Database(dbPath);

        const categories = ['brake', 'filter', 'suspension', 'cooling', 'engine', 'electrical'];
        const prefixes = ['5Q0', '3G0', '1K0', '7E0', '06L', '04E'];
        const parts = ['615301', '615601', '698151', '129620', '819653', '121111'];
        const suffixes = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

        const insert = db.prepare(`
            INSERT OR IGNORE INTO oem_records (oem, brand, part_category, part_description, confidence, sources)
            VALUES (?, ?, ?, ?, 0.7, '["quick-seed"]')
        `);

        const insertBatch = db.transaction(() => {
            for (let i = 0; i < count; i++) {
                const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
                const part = parts[Math.floor(Math.random() * parts.length)];
                const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
                const category = categories[Math.floor(Math.random() * categories.length)];

                insert.run(`${prefix}${part}${suffix}`, brand, category, `${brand} ${category} part`);
            }
        });

        insertBatch();

        const total = db.prepare('SELECT COUNT(*) as count FROM oem_records').get();
        db.close();

        return res.json({
            success: true,
            added: count,
            brand,
            totalRecords: total.count
        });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// --- OEM Registry CRUD (Search, View, Edit, Delete) ---

// List/Search OEM Records with pagination and filters
router.get("/oem-records", async (req: Request, res: Response) => {
    try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '../../oem-data/oem-database.sqlite');

        const fs = require('fs');
        if (!fs.existsSync(dbPath)) {
            return res.json({ records: [], total: 0 });
        }

        const db = new Database(dbPath, { readonly: true });

        // Query params
        const page = parseInt(req.query.page as string) || 1;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
        const offset = (page - 1) * limit;
        const search = req.query.search as string || '';
        const brand = req.query.brand as string || '';
        const category = req.query.category as string || '';
        const sortBy = req.query.sortBy as string || 'oem';
        const sortOrder = req.query.sortOrder === 'desc' ? 'DESC' : 'ASC';

        // Build query
        let whereClause = '1=1';
        const params: any[] = [];

        if (search) {
            whereClause += ' AND (oem LIKE ? OR part_description LIKE ? OR model LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (brand) {
            whereClause += ' AND brand = ?';
            params.push(brand);
        }

        if (category) {
            whereClause += ' AND part_category = ?';
            params.push(category);
        }

        // Get total count
        const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM oem_records WHERE ${whereClause}`);
        const total = totalStmt.get(...params).count;

        // Get records
        const allowedSortFields = ['oem', 'brand', 'part_category', 'confidence', 'created_at'];
        const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'oem';

        const recordsStmt = db.prepare(`
            SELECT id, oem, brand, part_category, part_description, model, confidence, sources, created_at
            FROM oem_records 
            WHERE ${whereClause}
            ORDER BY ${sortField} ${sortOrder}
            LIMIT ? OFFSET ?
        `);

        const records = recordsStmt.all(...params, limit, offset);

        // Get unique brands for filter
        const brands = db.prepare('SELECT DISTINCT brand FROM oem_records WHERE brand IS NOT NULL ORDER BY brand').all();
        const categories = db.prepare('SELECT DISTINCT part_category FROM oem_records WHERE part_category IS NOT NULL ORDER BY part_category').all();

        db.close();

        return res.json({
            records,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            filters: {
                brands: brands.map((b: any) => b.brand),
                categories: categories.map((c: any) => c.part_category)
            }
        });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// Get single OEM record
router.get("/oem-records/:id", async (req: Request, res: Response) => {
    try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '../../oem-data/oem-database.sqlite');
        const db = new Database(dbPath, { readonly: true });

        const record = db.prepare('SELECT * FROM oem_records WHERE id = ?').get(req.params.id);
        db.close();

        if (!record) {
            return res.status(404).json({ error: 'OEM record not found' });
        }

        return res.json(record);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// Update OEM record
router.put("/oem-records/:id", async (req: Request, res: Response) => {
    try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '../../oem-data/oem-database.sqlite');
        const db = new Database(dbPath);

        const { oem, brand, part_category, part_description, model, confidence } = req.body;

        const stmt = db.prepare(`
            UPDATE oem_records 
            SET oem = COALESCE(?, oem),
                brand = COALESCE(?, brand),
                part_category = COALESCE(?, part_category),
                part_description = COALESCE(?, part_description),
                model = COALESCE(?, model),
                confidence = COALESCE(?, confidence),
                sources = json_insert(COALESCE(sources, '[]'), '$[#]', 'manual-edit')
            WHERE id = ?
        `);

        const result = stmt.run(oem, brand, part_category, part_description, model, confidence, req.params.id);
        db.close();

        if (result.changes === 0) {
            return res.status(404).json({ error: 'OEM record not found' });
        }

        return res.json({ success: true, updated: result.changes });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// Create new OEM record
router.post("/oem-records", async (req: Request, res: Response) => {
    try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '../../oem-data/oem-database.sqlite');
        const db = new Database(dbPath);

        const { oem, brand, part_category, part_description, model, confidence = 0.9 } = req.body;

        if (!oem || !brand) {
            return res.status(400).json({ error: 'OEM and brand are required' });
        }

        const stmt = db.prepare(`
            INSERT INTO oem_records (oem, brand, part_category, part_description, model, confidence, sources)
            VALUES (?, ?, ?, ?, ?, ?, '["manual-entry"]')
        `);

        const result = stmt.run(oem, brand, part_category, part_description, model, confidence);
        db.close();

        return res.json({ success: true, id: result.lastInsertRowid });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// Delete OEM record
router.delete("/oem-records/:id", async (req: Request, res: Response) => {
    try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '../../oem-data/oem-database.sqlite');
        const db = new Database(dbPath);

        const result = db.prepare('DELETE FROM oem_records WHERE id = ?').run(req.params.id);
        db.close();

        if (result.changes === 0) {
            return res.status(404).json({ error: 'OEM record not found' });
        }

        return res.json({ success: true, deleted: result.changes });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// Bulk delete OEM records
router.post("/oem-records/bulk-delete", async (req: Request, res: Response) => {
    try {
        const Database = require('better-sqlite3');
        const dbPath = path.join(__dirname, '../../oem-data/oem-database.sqlite');
        const db = new Database(dbPath);

        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'ids array is required' });
        }

        const deleteMany = db.transaction((idsToDelete: number[]) => {
            const stmt = db.prepare('DELETE FROM oem_records WHERE id = ?');
            let deleted = 0;
            for (const id of idsToDelete) {
                deleted += stmt.run(id).changes;
            }
            return deleted;
        });

        const deleted = deleteMany(ids);
        db.close();

        return res.json({ success: true, deleted });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// Run validator script
router.post("/oem-database/validate", async (req: Request, res: Response) => {
    try {
        const { fix = false } = req.body;

        const scriptPath = path.join(__dirname, '../scripts/validateOems.js');
        const args = fix ? ['--fix'] : [];

        const child = spawn('node', [scriptPath, ...args], {
            cwd: path.join(__dirname, '..'),
            stdio: ['ignore', 'pipe', 'pipe']
        });

        const jobId = `validate-${Date.now()}`;

        const job = {
            pid: child.pid || 0,
            status: 'running',
            output: [] as string[],
            startTime: new Date()
        };

        activeSeederJobs.set(jobId, job);

        child.stdout.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter(l => l.trim());
            job.output.push(...lines.slice(-50));
            if (job.output.length > 100) job.output = job.output.slice(-50);
        });

        child.stderr.on('data', (data: Buffer) => {
            job.output.push(`[ERROR] ${data.toString()}`);
        });

        child.on('close', (code: number) => {
            job.status = code === 0 ? 'completed' : 'failed';
        });

        return res.json({
            success: true,
            jobId,
            message: `Validator started ${fix ? '(FIX mode)' : '(CHECK mode)'}`,
            pid: child.pid
        });
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

// ============================================================================
// OEM Feedback — Dealer confirmation / correction loop (APEX Phase 4)
// ============================================================================
router.post("/oem-feedback", async (req: Request, res: Response) => {
    try {
        const { processOemFeedback } = await import("../services/intelligence/oemFeedbackService");
        const { orderId, oemNumber, isCorrect, correctedOem, vehicleBrand, vehicleModel, vehicleYear, partDescription } = req.body;

        if (!orderId || !oemNumber) {
            return res.status(400).json({ error: "orderId and oemNumber are required" });
        }

        const result = await processOemFeedback({
            orderId,
            oemNumber,
            isCorrect: !!isCorrect,
            correctedOem: correctedOem || undefined,
            vehicleBrand: vehicleBrand || undefined,
            vehicleModel: vehicleModel || undefined,
            vehicleYear: vehicleYear ? Number(vehicleYear) : undefined,
            partDescription: partDescription || undefined,
            dealerId: (req as any).merchantId || "admin",
        });

        return res.json(result);
    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
});

export function createAdminRouter() {
    return router;
}

