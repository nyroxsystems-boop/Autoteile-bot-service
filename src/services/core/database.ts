// IN-MEMORY DATABASE STORE - SQLite removed for stability on Render
// This allows the Bot to function without native modules while maintaining 
// runtime state needed for ID generation and WAWI sync.

import * as crypto from 'crypto';

const store: Record<string, any[]> = {
    users: [],
    sessions: [],
    // Other tables that might be used
    orders: [],
    messages: [],
    shop_offers: [],
    merchant_settings: [],
    parts: [],
    companies: []
};

// Simple ID generator
const generateId = () => crypto.randomUUID();

export function initDb(): Promise<void> {
    console.log("[DB] Initializing In-Memory database...");

    // Seed Admin User if not exists
    const adminEmail = "admin@example.com";
    const existing = store.users.find(u => u.email === adminEmail);

    if (!existing) {
        const passwordHash = crypto.createHash('sha256').update("password123").digest('hex');
        store.users.push({
            id: generateId(),
            email: adminEmail,
            password_hash: passwordHash,
            username: "admin",
            full_name: "System Admin",
            role: "admin",
            merchant_id: "dealer-demo-001",
            is_active: 1,
            created_at: new Date().toISOString()
        });
        console.log(`[DB] Seeded default user: ${adminEmail} / password123`);
    }

    console.log("[DB] In-Memory database initialized (Safe for Render)");
    return Promise.resolve();
}

export function getDb(): any {
    return null;
}

/**
 * Mocks sqlite3.run
 * Handles INSERT, UPDATE, DELETE
 */
export async function run(sql: string, params: any[] = []): Promise<void> {
    const cleanSql = sql.trim();

    // INSERT
    if (cleanSql.toUpperCase().startsWith("INSERT INTO")) {
        // Example: INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)
        const match = cleanSql.match(/INSERT INTO (\w+)\s*\((.*?)\)\s*VALUES\s*\((.*?)\)/i);
        if (match) {
            const table = match[1];
            const columns = match[2].split(',').map(c => c.trim());

            if (store[table]) {
                const row: any = {};
                columns.forEach((col, idx) => {
                    row[col] = params[idx];
                });
                store[table].push(row);
                // console.log(`[DB] Inserted into ${table}`, row);
            }
        }
        return;
    }

    // UPDATE
    if (cleanSql.toUpperCase().startsWith("UPDATE")) {
        // Example: UPDATE users SET last_login = ? WHERE id = ?
        const match = cleanSql.match(/UPDATE (\w+) SET (.*?) WHERE (.*?)$/i);
        if (match) {
            const table = match[1];
            const setClause = match[2];
            const whereClause = match[3];

            // Simplified WHERE: assumes "col = ?"
            // This is brittle but sufficient for current exact-match queries
            if (store[table]) {
                // Find rows to update - very basic support for "id = ?"
                // We assume the last param is the ID if WHERE clause has one ?
                // The current codebase uses: UPDATE users SET last_login = ? WHERE id = ? -> params: [date, id]

                // For this specific 'auth' use case (UPDATE users SET last_login = ? WHERE id = ?)
                if (table === 'users' && whereClause.includes('id =')) {
                    const userId = params[params.length - 1];
                    const user = store.users.find(u => u.id === userId);
                    if (user) {
                        // Extract what to set? hard to parse generic SET
                        // But we know we are setting last_login which is the first param
                        if (setClause.includes('last_login')) {
                            user.last_login = params[0];
                        }
                    }
                }
            }
        }
        return;
    }

    // DELETE
    if (cleanSql.toUpperCase().startsWith("DELETE FROM")) {
        // Example: DELETE FROM sessions WHERE token = ?
        const match = cleanSql.match(/DELETE FROM (\w+) WHERE (.*?)$/i);
        if (match) {
            const table = match[1];
            const whereClause = match[2]; // e.g. "token = ?"

            if (store[table]) {
                if (whereClause.includes('token =')) {
                    const token = params[0];
                    store[table] = store[table].filter(row => row.token !== token);
                }
            }
        }
        return;
    }

    return Promise.resolve();
}

/**
 * Mocks sqlite3.get
 * Returns single row or undefined
 */
export async function get<T>(sql: string, params: any[] = []): Promise<T | undefined> {
    const rows = await all<T>(sql, params);
    return rows[0];
}

/**
 * Mocks sqlite3.all
 */
export async function all<T>(sql: string, params: any[] = []): Promise<T[]> {
    const cleanSql = sql.trim();
    const tableMatch = cleanSql.match(/FROM\s+(\w+)/i);

    if (!tableMatch) return Promise.resolve([]);

    const table = tableMatch[1];
    let rows = store[table] || []; // default to empty if table not in store

    // Very basic WHERE support
    // Supports:
    // - WHERE id = ?
    // - WHERE email = ?
    // - WHERE customer_contact = ?
    // - WHERE token = ?
    // - WHERE is_customer = ?

    // We strictly assume params are in order of '?' appearance
    if (cleanSql.toUpperCase().includes("WHERE")) {
        const wherePart = cleanSql.split(/WHERE/i)[1].split(/ORDER|LIMIT/i)[0];

        // Split by AND to handle multiple conditions using a simple regex approach
        // This is not a real parser, just a helper for the specific queries we know exist.
        const conditions = wherePart.split(/AND/i).map(c => c.trim());

        let paramIdx = 0;
        rows = rows.filter(row => {
            return conditions.every(cond => {
                // Handle "col = ?"
                if (cond.includes('=')) {
                    const [col] = cond.split('=').map(c => c.trim());
                    const val = params[paramIdx++];

                    // Special handling for boolean stored as 1/0
                    if (val === 1 || val === 0) {
                        return !!row[col] === !!val;
                    }
                    return row[col] === val;
                }
                // Handle "LIKE ?"
                if (cond.toUpperCase().includes('LIKE')) {
                    const [col] = cond.split(/LIKE/i).map(c => c.trim());
                    const val = params[paramIdx++];
                    if (typeof val === 'string' && typeof row[col] === 'string') {
                        // Remove %
                        const search = val.replace(/%/g, '').toLowerCase();
                        return row[col].toString().toLowerCase().includes(search);
                    }
                }
                return true;
            });
        });
    }

    // ORDER BY (Simple DESC/ASC support for created_at or id)
    if (cleanSql.toUpperCase().includes("ORDER BY")) {
        // e.g. ORDER BY created_at DESC
        // We just do a basic sort if it appears
        if (cleanSql.toUpperCase().includes("DESC")) {
            rows = [...rows].reverse();
        }
    }

    // LIMIT
    if (cleanSql.toUpperCase().includes("LIMIT")) {
        // Assume limit 1 or 100
        const limitMatch = cleanSql.match(/LIMIT\s+(\d+)/i);
        if (limitMatch) {
            const limit = parseInt(limitMatch[1]);
            rows = rows.slice(0, limit);
        }
    }

    return Promise.resolve(rows as T[]);
}
