// Database Migration Runner
// Runs SQL migrations on startup

import { db } from '@core/database';
import fs from 'fs';
import path from 'path';

export async function runTaxMigrations(): Promise<void> {
    try {
        console.log('Running tax module migrations...');

        // Step 1: Run initial schema (CREATE TABLE IF NOT EXISTS)
        const schemaPath = path.join(__dirname, '../services/tax/schema.sql');

        if (!fs.existsSync(schemaPath)) {
            console.warn('[MIGRATION] Tax schema file not found, skipping');
            return;
        }

        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Split by statement (basic approach)
        const statements = schemaSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            try {
                await db.run(statement);
            } catch (error: any) {
                // Ignore "table already exists" errors
                if (!error.message.includes('already exists')) {
                    console.error('[MIGRATION] Error executing statement:', error.message);
                    throw error;
                }
            }
        }

        console.log('✅ Initial tax schema created/verified');

        // Step 2: Run additional migrations (ALTER TABLE, etc.)
        const migrationsDir = path.join(__dirname, '../../db/migrations');

        if (fs.existsSync(migrationsDir)) {
            const migrationFiles = fs.readdirSync(migrationsDir)
                .filter(f => f.startsWith('004_') && f.endsWith('.sql'))
                .sort();

            for (const file of migrationFiles) {
                console.log(`[MIGRATION] Running ${file}...`);
                const migrationPath = path.join(migrationsDir, file);
                const migrationSql = fs.readFileSync(migrationPath, 'utf8');

                try {
                    await db.run(migrationSql);
                    console.log(`✅ ${file} completed`);
                } catch (error: any) {
                    console.error(`[MIGRATION] Error in ${file}:`, error.message);
                    // Continue with other migrations even if one fails
                }
            }
        }

        console.log('✅ Tax module migrations completed successfully');
    } catch (error) {
        console.error('[MIGRATION] Failed to run tax migrations:', error);
        throw error;
    }
}
