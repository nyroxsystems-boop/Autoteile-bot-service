
import { initDb, get, run } from "../src/services/core/database";
import * as crypto from 'crypto';

async function testAuthFlow() {
    console.log("🚀 Starting Auth Verification...");

    // 1. Init DB (Seeds admin)
    await initDb();

    // 2. Test Login Query
    console.log("\nTesting Login Query...");
    const email = "admin@example.com";
    const user = await get<any>(
        'SELECT * FROM users WHERE email = ? AND is_active = 1',
        [email]
    );

    if (!user) {
        console.error("❌ Login failed: User not found");
        process.exit(1);
    }
    console.log("✅ User found:", user.email, user.role);

    // Verify Password
    const password = "password123";
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    if (user.password_hash !== hash) {
        console.error("❌ Password mismatch");
        process.exit(1);
    }
    console.log("✅ Password verified");

    // 3. Test Session Creation
    console.log("\nTesting Session Creation...");
    const sessionId = `session-${crypto.randomUUID()}`;
    const token = `verify-token-${Date.now()}`;
    const expiresAt = new Date(Date.now() + 1000000).toISOString();
    const now = new Date().toISOString();

    await run(
        'INSERT INTO sessions (id, user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
        [sessionId, user.id, token, expiresAt, now]
    );

    // Verify Session Retrieval
    const session = await get<any>(
        'SELECT * FROM sessions WHERE token = ?',
        [token]
    );

    if (!session) {
        console.error("❌ Session lookup failed");
        process.exit(1);
    }
    console.log("✅ Session stored and retrieved:", session.token);

    // 4. Test Get Me (User by ID from Session)
    console.log("\nTesting 'Get Me' Query...");
    const me = await get<any>(
        'SELECT * FROM users WHERE id = ? AND is_active = 1',
        [session.user_id]
    );

    if (!me) {
        console.error("❌ 'Get Me' failed");
        process.exit(1);
    }
    console.log("✅ Current user retrieved:", me.email);

    // 5. Test Logout (Delete Session)
    console.log("\nTesting Logout...");
    await run('DELETE FROM sessions WHERE token = ?', [token]);

    const deletedSession = await get<any>(
        'SELECT * FROM sessions WHERE token = ?',
        [token]
    );

    if (deletedSession) {
        console.error("❌ Logout failed: Session still exists");
        process.exit(1);
    }
    console.log("✅ Session deleted");

    console.log("\n🎉 ALL TESTS PASSED");
}

testAuthFlow().catch(console.error);
