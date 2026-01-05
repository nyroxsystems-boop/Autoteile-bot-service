"use strict";
// POSTGRESQL DATABASE - Production-ready with connection pooling
// Replaces in-memory store for investor-ready deployment
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
exports.dbInstance = void 0;
exports.initDb = initDb;
exports.getDb = getDb;
exports.run = run;
exports.get = get;
exports.all = all;
exports.closeDb = closeDb;
const pg_1 = require("pg");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Create connection pool
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('render.com')
        ? { rejectUnauthorized: false }
        : undefined,
    max: 20, // Maximum number of connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});
// Simple ID generator
const generateId = () => crypto.randomUUID();
/**
 * Initialize database - create tables and seed admin user
 */
async function initDb() {
    console.log("[DB] Initializing PostgreSQL database...");
    try {
        // Read and execute schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');
        await pool.query(schema);
        console.log("[DB] Schema initialized successfully");
        // Seed Admin User (if not exists)
        const adminEmail = (process.env.ADMIN_EMAIL || "nyroxsystems@gmail.com").toLowerCase();
        const adminPassword = process.env.ADMIN_PASSWORD || "Test007!";
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (existingUser.rows.length === 0) {
            const passwordHash = crypto.createHash('sha256').update(adminPassword).digest('hex');
            await pool.query(`INSERT INTO users (id, email, username, full_name, password_hash, role, is_active, merchant_id, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
                generateId(),
                adminEmail,
                "admin",
                "Admin User",
                passwordHash,
                "admin",
                1,
                "dealer-demo-001",
                new Date().toISOString()
            ]);
            console.log(`[DB] Seeded admin user: ${adminEmail}`);
        }
        else {
            console.log("[DB] Admin user already exists");
        }
        console.log("[DB] PostgreSQL database initialized successfully");
    }
    catch (error) {
        console.error("[DB] Failed to initialize database:", error);
        throw error;
    }
}
/**
 * Export pool instance for direct queries
 */
function getDb() {
    return pool;
}
/**
 * Compatibility layer: run() - Execute INSERT, UPDATE, DELETE
 */
async function run(sql, params = []) {
    try {
        // Convert SQLite-style placeholders (?) to PostgreSQL ($1, $2, etc.)
        const pgSql = convertPlaceholders(sql);
        await pool.query(pgSql, params);
    }
    catch (error) {
        console.error("[DB] Error in run():", error);
        throw error;
    }
}
/**
 * Compatibility layer: get() - Execute SELECT and return single row
 */
async function get(sql, params = []) {
    try {
        const pgSql = convertPlaceholders(sql);
        const result = await pool.query(pgSql, params);
        return result.rows[0];
    }
    catch (error) {
        console.error("[DB] Error in get():", error);
        throw error;
    }
}
/**
 * Compatibility layer: all() - Execute SELECT and return all rows
 */
async function all(sql, params = []) {
    try {
        const pgSql = convertPlaceholders(sql);
        const result = await pool.query(pgSql, params);
        // Special handling for COUNT(*) queries - PostgreSQL returns 'count' not 'count(*)'
        if (sql.toUpperCase().includes('COUNT(*)') && result.rows.length > 0) {
            return result.rows.map(row => {
                if ('count' in row && !('count(*)' in row)) {
                    return { 'count(*)': parseInt(row.count) };
                }
                return row;
            });
        }
        return result.rows;
    }
    catch (error) {
        console.error("[DB] Error in all():", error);
        throw error;
    }
}
/**
 * Convert SQLite-style placeholders (?) to PostgreSQL-style ($1, $2, etc.)
 */
function convertPlaceholders(sql) {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
}
/**
 * Cleanup: Close all database connections
 */
async function closeDb() {
    await pool.end();
    console.log("[DB] Connection pool closed");
}
// Export db instance for compatibility
exports.dbInstance = {
    run,
    get,
    all
};
