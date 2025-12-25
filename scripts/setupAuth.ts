/**
 * Create Users Table and Demo User
 * Sets up authentication system with demo login credentials
 */

import * as db from '../src/services/database';
import * as crypto from 'crypto';

// Hash password using SHA-256
function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

async function createUsersTable() {
    console.log('📋 Creating users table...');

    // Drop existing table to ensure clean setup
    await db.run('DROP TABLE IF EXISTS users');

    await db.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      role TEXT DEFAULT 'dealer',
      merchant_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login TEXT
    )
  `);

    console.log('✅ Users table created');
}

async function createSessionsTable() {
    console.log('📋 Creating sessions table...');

    await db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

    console.log('✅ Sessions table created');
}

async function createDemoUsers() {
    console.log('\n👤 Creating demo users...');

    const users = [
        {
            id: 'user-admin-001',
            email: 'admin@autoteile-mueller.de',
            username: 'admin',
            password: 'demo123',
            full_name: 'Admin Müller',
            role: 'admin',
            merchant_id: 'dealer-demo-001'
        },
        {
            id: 'user-dealer-001',
            email: 'haendler@autoteile-mueller.de',
            username: 'haendler',
            password: 'mueller2024',
            full_name: 'Hans Müller',
            role: 'dealer',
            merchant_id: 'dealer-demo-001'
        },
        {
            id: 'user-staff-001',
            email: 'mitarbeiter@autoteile-mueller.de',
            username: 'mitarbeiter',
            password: 'staff123',
            full_name: 'Maria Schmidt',
            role: 'staff',
            merchant_id: 'dealer-demo-001'
        }
    ];

    for (const user of users) {
        const passwordHash = hashPassword(user.password);
        const now = new Date().toISOString();

        try {
            await db.run(
                `INSERT OR REPLACE INTO users 
         (id, email, username, password_hash, full_name, role, merchant_id, is_active, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
                [
                    user.id,
                    user.email,
                    user.username,
                    passwordHash,
                    user.full_name,
                    user.role,
                    user.merchant_id,
                    now,
                    now
                ]
            );

            console.log(`✅ Created user: ${user.username} (${user.email})`);
        } catch (error) {
            console.error(`❌ Error creating user ${user.username}:`, error);
        }
    }
}

async function printLoginCredentials() {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║         LOGIN CREDENTIALS                  ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('\n🔐 Demo Login-Daten:\n');

    console.log('1️⃣  ADMIN-ZUGANG:');
    console.log('   Email:    admin@autoteile-mueller.de');
    console.log('   Username: admin');
    console.log('   Password: demo123');
    console.log('   Role:     Administrator\n');

    console.log('2️⃣  HÄNDLER-ZUGANG:');
    console.log('   Email:    haendler@autoteile-mueller.de');
    console.log('   Username: haendler');
    console.log('   Password: mueller2024');
    console.log('   Role:     Dealer\n');

    console.log('3️⃣  MITARBEITER-ZUGANG:');
    console.log('   Email:    mitarbeiter@autoteile-mueller.de');
    console.log('   Username: mitarbeiter');
    console.log('   Password: staff123');
    console.log('   Role:     Staff\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📍 Dashboard URL: http://localhost:5173');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

async function main() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   User Authentication Setup                ║');
    console.log('║   AutoTeile Müller GmbH                    ║');
    console.log('╚════════════════════════════════════════════╝\n');

    try {
        // Initialize database
        const { initDb } = await import('../src/services/database');
        await initDb();
        console.log('✅ Database initialized\n');

        // Create tables
        await createUsersTable();
        await createSessionsTable();

        // Create demo users
        await createDemoUsers();

        // Print credentials
        await printLoginCredentials();

        console.log('✅ Authentication system setup completed!\n');

    } catch (error) {
        console.error('❌ Error setting up authentication:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

export { main as setupAuth };
