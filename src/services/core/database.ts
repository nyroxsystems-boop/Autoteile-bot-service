// POSTGRESQL DATABASE - Production-ready with connection pooling
// Replaces in-memory store for investor-ready deployment

import { Pool, PoolClient } from 'pg';
import * as crypto from 'crypto';
import { runMigrations } from './migrations';
import { seedDemoData } from './seedDemoData';

// Create connection pool
const pool = new Pool({
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
export async function initDb(): Promise<void> {
    console.log("[DB] Initializing PostgreSQL database...");

    try {
        await runMigrations(pool);
        console.log("[DB] Migrations completed successfully");

        // Seed Admin User (if not exists)
        const adminEmail = (process.env.ADMIN_EMAIL || "nyroxsystems@gmail.com").toLowerCase();
        const adminPassword = process.env.ADMIN_PASSWORD || "Test007!";

        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [adminEmail]
        );

        if (existingUser.rows.length === 0) {
            const passwordHash = crypto.createHash('sha256').update(adminPassword).digest('hex');

            await pool.query(
                `INSERT INTO users (id, email, username, full_name, password_hash, role, is_active, merchant_id, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    generateId(),
                    adminEmail,
                    "admin",
                    "Admin User",
                    passwordHash,
                    "admin",
                    1,
                    "dealer-demo-001",
                    new Date().toISOString()
                ]
            );
            console.log(`[DB] Seeded admin user: ${adminEmail}`);
        } else {
            console.log("[DB] Admin user already exists");
        }

        // Seed demo data (orders, products) if enabled
        if (process.env.SEED_DEMO_DATA !== 'false') {
            await seedDemoData();
        }

        console.log("[DB] PostgreSQL database initialized successfully");
    } catch (error) {
        console.error("[DB] Failed to initialize database:", error);
        throw error;
    }
}

/**
 * Export pool instance for direct queries
 */
export function getDb(): Pool {
    return pool;
}

/**
 * Compatibility layer: run() - Execute INSERT, UPDATE, DELETE
 */
export async function run(sql: string, params: any[] = []): Promise<void> {
    try {
        // Convert SQLite-style placeholders (?) to PostgreSQL ($1, $2, etc.)
        const pgSql = convertPlaceholders(sql);
        await pool.query(pgSql, params);
    } catch (error) {
        console.error("[DB] Error in run():", error);
        throw error;
    }
}

/**
 * Compatibility layer: get() - Execute SELECT and return single row
 */
export async function get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    try {
        const pgSql = convertPlaceholders(sql);
        const result = await pool.query(pgSql, params);
        return result.rows[0] as T | undefined;
    } catch (error) {
        console.error("[DB] Error in get():", error);
        throw error;
    }
}

/**
 * Compatibility layer: all() - Execute SELECT and return all rows
 */
export async function all<T>(sql: string, params: any[] = []): Promise<T[]> {
    try {
        const pgSql = convertPlaceholders(sql);
        const result = await pool.query(pgSql, params);

        // Special handling for COUNT(*) queries - PostgreSQL returns 'count' not 'count(*)'
        if (sql.toUpperCase().includes('COUNT(*)') && result.rows.length > 0) {
            return result.rows.map(row => {
                if ('count' in row && !('count(*)' in row)) {
                    return { 'count(*)': parseInt(row.count) } as any;
                }
                return row;
            }) as T[];
        }

        return result.rows as T[];
    } catch (error) {
        console.error("[DB] Error in all():", error);
        throw error;
    }
}

/**
 * Convert SQLite-style placeholders (?) to PostgreSQL-style ($1, $2, etc.)
 */
function convertPlaceholders(sql: string): string {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
}

/**
 * Cleanup: Close all database connections
 */
export async function closeDb(): Promise<void> {
    await pool.end();
    console.log("[DB] Connection pool closed");
}

// Export db instance for compatibility
export const db = {
    run,
    get,
    all
};

export const dbInstance = {
    run,
    get,
    all
};

