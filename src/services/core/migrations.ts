import * as fs from 'fs';
import * as path from 'path';
import type { Pool } from 'pg';

const MIGRATIONS_DIR = path.join(process.cwd(), 'db', 'migrations');

export async function runMigrations(pool: Pool): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        if (!fs.existsSync(MIGRATIONS_DIR)) {
            console.warn(`[DB] Migrations directory not found: ${MIGRATIONS_DIR}`);
            return;
        }

        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter((file) => file.endsWith('.sql'))
            .sort();

        const appliedRows = await client.query('SELECT name FROM schema_migrations');
        const applied = new Set(appliedRows.rows.map((row) => row.name));

        for (const file of files) {
            if (applied.has(file)) continue;
            const filePath = path.join(MIGRATIONS_DIR, file);
            const sql = fs.readFileSync(filePath, 'utf-8');

            console.log(`[DB] Applying migration: ${file}`);
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            }
        }
    } finally {
        client.release();
    }
}
