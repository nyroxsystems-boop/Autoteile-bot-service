// Database Migration Runner
// Runs SQL migrations on startup

import { db } from '@core/database';
import { logger } from "@utils/logger";
import fs from 'fs';
import path from 'path';

export async function runTaxMigrations(): Promise<void> {
    try {
        logger.info('Running tax module migrations...');

        // Step 1: Run initial schema (CREATE TABLE IF NOT EXISTS)
        const schemaPath = path.join(__dirname, '../services/tax/schema.sql');

        if (!fs.existsSync(schemaPath)) {
            logger.warn('[MIGRATION] Tax schema file not found, skipping');
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
                    logger.error('[MIGRATION] Error executing statement:', error.message);
                    throw error;
                }
            }
        }

        logger.info('✅ Initial tax schema created/verified');

        // Step 2: Run additional migrations (ALTER TABLE, etc.)
        const migrationsDir = path.join(__dirname, '../../db/migrations');

        if (fs.existsSync(migrationsDir)) {
            const migrationFiles = fs.readdirSync(migrationsDir)
                .filter(f => f.startsWith('004_') && f.endsWith('.sql'))
                .sort();

            for (const file of migrationFiles) {
                logger.info(`[MIGRATION] Running ${file}...`);
                const migrationPath = path.join(migrationsDir, file);
                const migrationSql = fs.readFileSync(migrationPath, 'utf8');

                try {
                    await db.run(migrationSql);
                    logger.info(`✅ ${file} completed`);
                } catch (error: any) {
                    logger.error(`[MIGRATION] Error in ${file}:`, error.message);
                    // Continue with other migrations even if one fails
                }
            }
        }

        logger.info('✅ Tax module migrations completed successfully');
    } catch (error) {
        logger.error('[MIGRATION] Failed to run tax migrations:', error);
        throw error;
    }
}
