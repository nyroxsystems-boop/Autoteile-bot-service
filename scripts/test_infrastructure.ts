/**
 * SIMPLIFIED WHATSAPP BOT TEST
 * Tests database setup, phone mapping, and infrastructure without OpenAI dependencies
 */

import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
require('dotenv').config();

import { initDb, run, get } from '../src/services/core/database';
import { getMerchantByPhone, setPhoneMerchantMapping } from '../src/services/adapters/phoneMerchantMapper';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    magenta: '\x1b[35m'
};

interface TestResult {
    component: string;
    test: string;
    passed: boolean;
    message: string;
    data?: any;
}

const results: TestResult[] = [];

function log(message: string, color: string = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logTest(component: string, test: string, passed: boolean, message: string, data?: any) {
    const icon = passed ? '✅' : '❌';
    const color = passed ? colors.green : colors.red;
    log(`${icon} [${component}] ${test}: ${message}`, color);
    results.push({ component, test, passed, message, data });
}

// ==================== SETUP TESTS ====================

async function testDatabaseSetup() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  1. DATABASE SETUP                         ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    try {
        await initDb();
        logTest('Database', 'Initialization', true, 'Database initialized successfully');
    } catch (error: any) {
        logTest('Database', 'Initialization', false, `Failed: ${error?.message}`);
        return false;
    }

    // Check if key tables exist
    const tables = ['orders', 'messages', 'shop_offers', 'merchant_settings'];
    for (const table of tables) {
        try {
            const result = await get<any>(`SELECT COUNT(*) as count FROM ${table}`);
            logTest('Database', `Table: ${table}`, true, `Exists with ${result?.count || 0} rows`);
        } catch (error: any) {
            logTest('Database', `Table: ${table}`, false, `Table check failed: ${error?.message}`);
        }
    }

    return true;
}

// ==================== PHONE MAPPING TESTS ====================

async function testPhoneMappingSetup() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  2. PHONE MAPPING SETUP                    ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    // Apply migration
    try {
        const migrationPath = path.join(__dirname, '../db/phone_merchant_mapping.sql');
        const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

        logTest('PhoneMapping', 'Migration File', true, `Found migration at ${migrationPath}`);

        // Execute migration statements
        const statements = migrationSql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
        for (const statement of statements) {
            const trimmed = statement.trim();
            if (trimmed && trimmed.length > 10) { // Skip very short statements
                try {
                    await run(trimmed);
                } catch (err: any) {
                    // Ignore "already exists" errors
                    if (!err.message?.includes('already exists')) {
                        throw err;
                    }
                }
            }
        }

        logTest('PhoneMapping', 'Migration Execution', true, 'Migration applied successfully');
    } catch (error: any) {
        logTest('PhoneMapping', 'Migration Execution', false, `Migration failed: ${error?.message}`);
        return false;
    }

    // Verify test phone mapping
    try {
        const testPhone = 'whatsapp:+14155238886';
        const mapping = await getMerchantByPhone(testPhone);

        logTest('PhoneMapping', 'Test Number Lookup', !!mapping,
            mapping
                ? `Mapped to merchant: ${mapping.merchantId}, email: ${mapping.userEmail}`
                : 'No mapping found'
        );

        // Check if it's the correct mapping
        if (mapping) {
            const isCorrect = mapping.merchantId === 'admin' && mapping.userEmail === 'nyroxsystem@gmail.com';
            logTest('PhoneMapping', 'Correct Assignment', isCorrect,
                isCorrect
                    ? 'Correctly assigned to admin/nyroxsystem@gmail.com'
                    : `Incorrect assignment: ${JSON.stringify(mapping)}`
            );
        }

    } catch (error: any) {
        logTest('PhoneMapping', 'Test Number Lookup', false, `Lookup failed: ${error?.message}`);
    }

    // Test creating a new mapping
    try {
        const newPhone = `whatsapp:+1415${Date.now().toString().slice(-7)}`;
        await setPhoneMerchantMapping(newPhone, 'test-merchant', 'test@example.com', 'Test mapping created by automated tests');

        const newMapping = await getMerchantByPhone(newPhone);
        const isCorrect = newMapping?.merchantId === 'test-merchant' && newMapping?.userEmail === 'test@example.com';

        logTest('PhoneMapping', 'Create New Mapping', isCorrect,
            isCorrect
                ? `Successfully created mapping for ${newPhone}`
                : `Failed to create mapping correctly`
        );
    } catch (error: any) {
        logTest('PhoneMapping', 'Create New Mapping', false, `Creation failed: ${error?.message}`);
    }

    return true;
}

// ==================== TWILIO CONFIG TEST ====================

async function testTwilioConfig() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  3. TWILIO CONFIGURATION                   ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    logTest('Twilio', 'Account SID', !!accountSid,
        accountSid ? `Set: ${accountSid.substring(0, 10)}...` : 'Not configured'
    );

    logTest('Twilio', 'Auth Token', !!authToken,
        authToken ? `Set (${authToken.length} chars)` : 'Not configured'
    );

    logTest('Twilio', 'Phone Number', !!phoneNumber,
        phoneNumber ? `Set: ${phoneNumber}` : 'Not configured'
    );

    return true;
}

// ==================== ENV VARIABLES TEST ====================

async function testEnvironmentVariables() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  4. ENVIRONMENT VARIABLES                  ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    const envVars = [
        { name: 'HTTPS_WEB', required: false },
        { name: 'HTTP_WEB', required: false },
        { name: 'OPENAI_API_KEY', required: false },
        { name: 'DEFAULT_MERCHANT_ID', required: false }
    ];

    for (const envVar of envVars) {
        const value = process.env[envVar.name];
        const isSet = !!value;

        if (envVar.required) {
            logTest('Environment', envVar.name, isSet, isSet ? `Set` : `MISSING (required)`);
        } else {
            logTest('Environment', envVar.name, true, isSet ? `Set` : `Not set (optional)`);
        }
    }

    // Check proxy variables specifically
    const httpsWeb = process.env.HTTPS_WEB;
    const httpWeb = process.env.HTTP_WEB;

    if (httpsWeb || httpWeb) {
        log('\n📡 Proxy Configuration:', colors.blue);
        if (httpsWeb) log(`  HTTPS_WEB: ${httpsWeb.substring(0, 30)}...`, colors.reset);
        if (httpWeb) log(`  HTTP_WEB: ${httpWeb.substring(0, 30)}...`, colors.reset);
    }

    return true;
}

// ==================== DATABASE QUERIES TEST ====================

async function testDatabaseQueries() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  5. DATABASE QUERIES                       ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    try {
        // Test orders query
        const orders = await get<any>('SELECT COUNT(*) as count FROM orders');
        logTest('Queries', 'Orders Count', true, `Found ${orders?.count || 0} orders`);

        // Test messages query
        const messages = await get<any>('SELECT COUNT(*) as count FROM messages');
        logTest('Queries', 'Messages Count', true, `Found ${messages?.count || 0} messages`);

        // Test phone_merchant_mapping query
        try {
            const mappings = await get<any>('SELECT COUNT(*) as count FROM phone_merchant_mapping');
            logTest('Queries', 'Phone Mappings Count', true, `Found ${mappings?.count || 0} mappings`);
        } catch (err: any) {
            logTest('Queries', 'Phone Mappings Count', false, `Table may not exist yet: ${err.message}`);
        }

    } catch (error: any) {
        logTest('Queries', 'Database Queries', false, `Query failed: ${error?.message}`);
    }

    return true;
}

// ==================== GENERATE REPORT ====================

async function generateTestReport() {
    log('\n╔════════════════════════════════════════════╗', colors.bold + colors.magenta);
    log('║        TEST REPORT GENERATION              ║', colors.bold + colors.magenta);
    log('╚════════════════════════════════════════════╝', colors.bold + colors.magenta);

    const report = [];
    report.push('# WhatsApp Bot Infrastructure Test Report\n');
    report.push(`**Generated:** ${new Date().toISOString()}\n`);
    report.push(`**Test Phone:** +14155238886\n`);
    report.push(`**Assigned To:** nyroxsystem@gmail.com (admin)\n\n`);

    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const percentage = ((passedTests / totalTests) * 100).toFixed(1);

    report.push('## Summary\n\n');
    report.push(`- **Total Tests:** ${totalTests}\n`);
    report.push(`- **Passed:** ${passedTests}\n`);
    report.push(`- **Failed:** ${totalTests - passedTests}\n`);
    report.push(`- **Success Rate:** ${percentage}%\n\n`);

    report.push('## Test Results by Component\n\n');

    const components = [...new Set(results.map(r => r.component))];
    for (const component of components) {
        report.push(`### ${component}\n\n`);
        const componentResults = results.filter(r => r.component === component);

        for (const result of componentResults) {
            report.push(`- **${result.test}**: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`);
            report.push(`  - ${result.message}\n`);
            if (result.data) {
                report.push(`  - Data: \`${JSON.stringify(result.data)}\`\n`);
            }
            report.push('\n');
        }
    }

    report.push('## Configuration Summary\n\n');
    report.push(`- **Twilio Account SID:** ${process.env.TWILIO_ACCOUNT_SID?.substring(0, 10) || 'not set'}...\n`);
    report.push(`- **Twilio Phone:** ${process.env.TWILIO_WHATSAPP_NUMBER || 'not set'}\n`);
    report.push(`- **HTTPS_WEB Proxy:** ${process.env.HTTPS_WEB ? 'configured' : 'not set'}\n`);
    report.push(`- **HTTP_WEB Proxy:** ${process.env.HTTP_WEB ? 'configured' : 'not set'}\n`);
    report.push(`- **OpenAI API Key:** ${process.env.OPENAI_API_KEY ? 'configured' : 'not set'}\n`);

    const reportPath = path.join(__dirname, '../test_report_infrastructure.md');
    fs.writeFileSync(reportPath, report.join(''));
    log(`\n📄 Test report saved to: ${reportPath}`, colors.green);

    return reportPath;
}

// ==================== MAIN ====================

async function main() {
    log('╔════════════════════════════════════════════╗', colors.bold + colors.magenta);
    log('║  WHATSAPP BOT INFRASTRUCTURE TEST          ║', colors.bold + colors.magenta);
    log('║  Database, Phone Mapping, Configuration   ║', colors.bold + colors.magenta);
    log('╚════════════════════════════════════════════╝', colors.bold + colors.magenta);

    try {
        await testDatabaseSetup();
        await testPhoneMappingSetup();
        await testTwilioConfig();
        await testEnvironmentVariables();
        await testDatabaseQueries();

        const reportPath = await generateTestReport();

        const totalTests = results.length;
        const passedTests = results.filter(r => r.passed).length;
        const percentage = ((passedTests / totalTests) * 100).toFixed(1);

        log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
        log(`\n📈 OVERALL: ${passedTests}/${totalTests} tests passed (${percentage}%)`,
            parseFloat(percentage) >= 90 ? colors.green + colors.bold : colors.yellow);

        if (passedTests === totalTests) {
            log('\n🎉 ALL INFRASTRUCTURE TESTS PASSED!', colors.green + colors.bold);
        } else {
            const failed = results.filter(r => !r.passed);
            log('\n⚠️  Some tests failed:', colors.yellow);
            failed.forEach(r => {
                log(`   • [${r.component}] ${r.test}: ${r.message}`, colors.red);
            });
        }

        log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', colors.cyan);
        log(`📄 Full report: ${reportPath}\n`, colors.cyan);

        log('\n📋 Next Steps:', colors.blue);
        log('  1. Review the test report above', colors.reset);
        log('  2. For full OEM/Flow tests, ensure OPENAI_API_KEY is set', colors.reset);
        log('  3. Run: npm run smoke:oem (for OEM tests)', colors.reset);
        log('  4. Run: npm run test:system (for full system integration)', colors.reset);

        process.exit(passedTests === totalTests ? 0 : 1);

    } catch (error: any) {
        log(`\n❌ Test suite error: ${error?.message}`, colors.red);
        console.error(error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

export { main as runInfrastructureTest };
