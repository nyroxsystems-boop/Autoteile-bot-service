// Database Migration Runner
// Runs SQL migrations on startup

import { db } from '@core/database';
import fs from 'fs';
import path from 'path';

export async function runTaxMigrations(): Promise<void> {
    try {
        console.log('Running tax module migrations...');

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

        console.log('✅ Tax module migrations completed successfully');
    } catch (error) {
        console.error('[MIGRATION] Failed to run tax migrations:', error);
        throw error;
    }
}
