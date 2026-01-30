/**
 * Migration: Admin Users & Sessions
 * Creates tables for admin authentication (separate from dealer/merchant auth)
 */

import * as db from '../services/core/database';
import { createHash, randomUUID } from 'crypto';

const INITIAL_PASSWORD = 'Test007!';
const ADMIN_USERS = [
    { username: 'Fecat', email: 'fecat.blawat@partsunion.de', fullName: 'Fecat Blawat' },
    { username: 'Elias', email: 'elias.zafar@partsunion.de', fullName: 'Elias Zafar' },
    { username: 'Bardia', email: 'bardia.bagherian@partsunion.de', fullName: 'Bardia Bagherian' },
    { username: 'Aaron', email: 'aaron.vogt@partsunion.de', fullName: 'Aaron Vogt' }
];

function hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
}

export async function runMigration(): Promise<void> {
    console.log('🔄 Running migration: Admin Users & Sessions...');

    // Create admin_users table
    await db.run(`
        CREATE TABLE IF NOT EXISTS admin_users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            full_name TEXT,
            password_hash TEXT NOT NULL,
            must_change_password INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            signature TEXT DEFAULT '',
            imap_password_encrypted TEXT,
            created_at TEXT NOT NULL,
            last_login TEXT
        )
    `);
    console.log('✅ Created admin_users table');

    // Create admin_sessions table
    await db.run(`
        CREATE TABLE IF NOT EXISTS admin_sessions (
            id TEXT PRIMARY KEY,
            admin_id TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            FOREIGN KEY (admin_id) REFERENCES admin_users(id)
        )
    `);
    console.log('✅ Created admin_sessions table');

    // Create password_reset_tokens table
    await db.run(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id TEXT PRIMARY KEY,
            admin_id TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            FOREIGN KEY (admin_id) REFERENCES admin_users(id)
        )
    `);
    console.log('✅ Created password_reset_tokens table');

    // Seed admin users
    const passwordHash = hashPassword(INITIAL_PASSWORD);
    const now = new Date().toISOString();

    for (const admin of ADMIN_USERS) {
        // Check if user already exists
        const existing = await db.get<any>(
            'SELECT id FROM admin_users WHERE username = ?',
            [admin.username]
        );

        if (!existing) {
            const id = randomUUID();
            await db.run(
                `INSERT INTO admin_users (id, username, email, full_name, password_hash, must_change_password, is_active, created_at)
                 VALUES (?, ?, ?, ?, ?, 0, 1, ?)`,
                [id, admin.username, admin.email, admin.fullName, passwordHash, now]
            );
            console.log(`✅ Created admin user: ${admin.username}`);
        } else {
            console.log(`ℹ️ Admin user already exists: ${admin.username}`);
        }
    }

    console.log('✅ Migration complete: Admin Users & Sessions');
}

// Export for direct execution
export default runMigration;
