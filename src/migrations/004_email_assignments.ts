/**
 * Migration: Email Assignments
 * Track which admin is handling which email
 */

import * as db from '../services/core/database';

export async function runMigration(): Promise<void> {
    console.log('🔄 Running migration: Email Assignments...');

    // Create email_assignments table
    await db.run(`
        CREATE TABLE IF NOT EXISTS email_assignments (
            message_id TEXT PRIMARY KEY,
            mailbox TEXT NOT NULL,
            assigned_to TEXT,
            status TEXT DEFAULT 'open',
            notes TEXT,
            assigned_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL
        )
    `);
    console.log('✅ Created email_assignments table');

    // Create index for faster lookups
    await db.run(`
        CREATE INDEX IF NOT EXISTS idx_email_assignments_mailbox 
        ON email_assignments(mailbox)
    `);
    console.log('✅ Created mailbox index');

    await db.run(`
        CREATE INDEX IF NOT EXISTS idx_email_assignments_assigned_to 
        ON email_assignments(assigned_to)
    `);
    console.log('✅ Created assigned_to index');

    console.log('✅ Migration complete: Email Assignments');
}

export default runMigration;
