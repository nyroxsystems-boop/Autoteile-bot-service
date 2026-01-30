/**
 * Migration: Admin Activity Log
 * Tracks all administrative actions for audit purposes
 */

import * as db from '../services/core/database';

export async function runMigration(): Promise<void> {
    console.log('🔄 Running migration: Admin Activity Log...');

    // Create admin_activity_log table
    await db.run(`
        CREATE TABLE IF NOT EXISTS admin_activity_log (
            id TEXT PRIMARY KEY,
            admin_username TEXT NOT NULL,
            action_type TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT,
            entity_name TEXT,
            old_value TEXT,
            new_value TEXT,
            ip_address TEXT,
            user_agent TEXT,
            timestamp TEXT NOT NULL
        )
    `);
    console.log('✅ Created admin_activity_log table');

    // Create index for faster queries
    await db.run(`
        CREATE INDEX IF NOT EXISTS idx_activity_timestamp 
        ON admin_activity_log(timestamp DESC)
    `);
    console.log('✅ Created timestamp index');

    await db.run(`
        CREATE INDEX IF NOT EXISTS idx_activity_admin 
        ON admin_activity_log(admin_username)
    `);
    console.log('✅ Created admin username index');

    console.log('✅ Migration complete: Admin Activity Log');
}

// Export for direct execution
export default runMigration;
