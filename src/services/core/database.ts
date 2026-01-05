// IN-MEMORY DATABASE STORE - SQLite removed for stability on Render
// This allows the Bot to function without native modules while maintaining 
// runtime state needed for ID generation and WAWI sync.

import * as crypto from 'crypto';

const store: Record<string, any[]> = {
    users: [],
    sessions: [],
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

    // Seed Admin User if not exists - SECURE: Only if empty and strictly for initial setup
    const adminEmail = "admin@example.com";
    const existing = store.users.find(u => u.email === adminEmail);

    if (!existing && process.env.VITE_WAWI_SERVICE_TOKEN) { // Only seed if we have a secure environment context or explicit flag
        // We do NOT seed a default password anymore. User must be created via Admin API or console.
        // Or if we must, we log a warning. For now: NO DEFAULT BACKDOOR.
        console.log(`[DB] No default admin user seeded. Create one via API or shell.`);
    }

    console.log("[DB] In-Memory database initialized (Safe for Render)");
    return Promise.resolve();
}

// Emulate sqlite3 db object interface
export const dbInstance = {
    run: (sql: string, params: any[] = []) => run(sql, params),
    get: (sql: string, params: any[] = []) => get(sql, params),
    all: (sql: string, params: any[] = []) => all(sql, params)
};

export function getDb(): any {
    return dbInstance;
}

/**
 * Mocks sqlite3.run
 * Handles INSERT, UPDATE, DELETE
 */
export async function run(sql: string, params: any[] = []): Promise<void> {
    const cleanSql = sql.trim();

    // INSERT
    if (cleanSql.toUpperCase().startsWith("INSERT INTO")) {
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
            }
        }
        return;
    }

    // UPDATE
    if (cleanSql.toUpperCase().startsWith("UPDATE")) {
        // Generic UPDATE support: UPDATE table SET col1=?, col2=? WHERE col3=? AND ...
        const match = cleanSql.match(/UPDATE (\w+) SET (.*?) WHERE (.*?)$/i);
        if (match) {
            const table = match[1];
            const setClause = match[2];
            const whereClause = match[3];

            if (store[table]) {
                const setParts = setClause.split(',').map(s => s.trim());
                // We assume params order: SET params..., then WHERE params...
                const numSetParams = setParts.length; // Approximate, assuming 1 param per set part (col = ?)

                const whereConditions = parseWhere(whereClause);
                const whereParams = params.slice(numSetParams);
                const setParams = params.slice(0, numSetParams);

                store[table].forEach(row => {
                    if (matchesWhere(row, whereConditions, whereParams)) {
                        setParts.forEach((part, idx) => {
                            const [col] = part.split('=').map(c => c.trim());
                            row[col] = setParams[idx];
                        });
                    }
                });
            }
        }
        return;
    }

    // DELETE
    if (cleanSql.toUpperCase().startsWith("DELETE FROM")) {
        const match = cleanSql.match(/DELETE FROM (\w+) WHERE (.*?)$/i);
        if (match) {
            const table = match[1];
            const whereClause = match[2];

            if (store[table]) {
                const conditions = parseWhere(whereClause);
                // Keep rows that DO NOT match
                store[table] = store[table].filter(row => !matchesWhere(row, conditions, params));
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
    // Handle COUNT(*) specially if returned by all
    if (rows && rows.length > 0) return rows[0];
    return undefined;
}

/**
 * Mocks sqlite3.all
 */
export async function all<T>(sql: string, params: any[] = []): Promise<T[]> {
    const cleanSql = sql.trim();

    // Check for SELECT COUNT(*) FROM table
    const countMatch = cleanSql.match(/SELECT COUNT\(\*\)\s+(?:AS\s+\w+\s+)?FROM\s+(\w+)(?:\s+WHERE\s+(.*))?/i);
    if (countMatch) {
        const table = countMatch[1];
        const whereClause = countMatch[2];

        let rows = store[table] || [];
        if (whereClause) {
            const conditions = parseWhere(whereClause);
            rows = rows.filter(row => matchesWhere(row, conditions, params));
        }
        return [{ 'count(*)': rows.length }] as any;
    }

    const tableMatch = cleanSql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) return Promise.resolve([]);

    const table = tableMatch[1];
    let rows = store[table] || [];

    if (cleanSql.toUpperCase().includes("WHERE")) {
        const wherePart = cleanSql.split(/WHERE/i)[1].split(/ORDER|LIMIT/i)[0];
        const conditions = parseWhere(wherePart);
        rows = rows.filter(row => matchesWhere(row, conditions, params));
    }

    // ORDER BY
    if (cleanSql.toUpperCase().includes("ORDER BY")) {
        if (cleanSql.toUpperCase().includes("DESC")) {
            rows = [...rows].reverse();
        }
    }

    // LIMIT
    if (cleanSql.toUpperCase().includes("LIMIT")) {
        const limitMatch = cleanSql.match(/LIMIT\s+(\d+)/i);
        if (limitMatch) {
            const limit = parseInt(limitMatch[1]);
            rows = rows.slice(0, limit);
        }
    }

    return Promise.resolve(rows as T[]);
}

// --- Helpers ---

function parseWhere(whereClause: string): string[] {
    // Split by AND, rudimentary
    return whereClause.split(/AND/i).map(c => c.trim());
}

function matchesWhere(row: any, conditions: string[], params: any[]): boolean {
    let paramIdx = 0;
    return conditions.every(cond => {
        // col = ?
        if (cond.includes('=')) {
            const [col] = cond.split('=').map(c => c.trim());
            const val = params[paramIdx++];
            // Loose equality for numbers/strings mismatch
            // eslint-disable-next-line eqeqeq
            return row[col] == val;
        }
        // col LIKE ?
        if (cond.toUpperCase().includes('LIKE')) {
            const [col] = cond.split(/LIKE/i).map(c => c.trim());
            const val = params[paramIdx++];
            if (typeof val === 'string' && typeof row[col] === 'string') {
                const search = val.replace(/%/g, '').toLowerCase();
                return row[col].toString().toLowerCase().includes(search);
            }
        }
        return true;
    });
}
