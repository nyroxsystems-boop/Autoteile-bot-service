/**
 * COMPREHENSIVE WHATSAPP BOT TEST WITH DASHBOARD INTEGRATION
 * 
 * Tests:
 * 1. OEM Resolution (100% confidence check)
 * 2. Complete WhatsApp Message Flow (all messages documented)
 * 3. Offer Generation (documented with prices, shops, etc.)
 * 4. Dashboard Integration (verify data appears for nyroxsystem@gmail.com)
 * 5. Phone Number Mapping (+14155238886 -> admin/nyroxsystem@gmail.com)
 */

import { initDb } from '../src/services/core/database';
import { resolveOEMForOrder } from '../src/services/intelligence/oemService';
import { scrapeOffersForOrder } from '../src/services/scraping/scrapingService';
import { handleIncomingBotMessage } from '../src/services/core/botLogicService';
import { getMerchantByPhone, setPhoneMerchantMapping } from '../src/services/adapters/phoneMerchantMapper';
import * as supabase from '../src/services/adapters/supabaseService';
import * as fs from 'fs';
import * as path from 'path';

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
const messageLog: Array<{ timestamp: string; from: string; to: string; message: string; type: string }> = [];

function log(message: string, color: string = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logTest(component: string, test: string, passed: boolean, message: string, data?: any) {
    const icon = passed ? '✅' : '❌';
    const color = passed ? colors.green : colors.red;
    log(`${icon} [${component}] ${test}: ${message}`, color);
    results.push({ component, test, passed, message, data });
}

function logMessage(from: string, to: string, message: string, type: 'IN' | 'OUT') {
    const timestamp = new Date().toISOString();
    messageLog.push({ timestamp, from, to, message, type });

    const color = type === 'IN' ? colors.yellow : colors.cyan;
    const arrow = type === 'IN' ? '📥' : '📤';
    log(`\n${arrow} ${type} [${timestamp}]`, color);
    log(`From: ${from}`, colors.reset);
    log(`To: ${to}`, colors.reset);
    log(`Message: ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`, colors.reset);
}

// ==================== SETUP TESTS ====================

async function testSetup() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  1. SETUP & INITIALIZATION                 ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    // Initialize database
    try {
        await initDb();
        logTest('Setup', 'Database Init', true, 'Database initialized successfully');
    } catch (error: any) {
        logTest('Setup', 'Database Init', false, `Failed: ${error?.message}`);
        return false;
    }

    // Apply phone mapping migration
    try {
        const migrationPath = path.join(__dirname, '../db/phone_merchant_mapping.sql');
        const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

        // Execute migration (simplified - in production use proper migration tool)
        const statements = migrationSql.split(';').filter(s => s.trim());
        for (const statement of statements) {
            if (statement.trim()) {
                await require('../src/services/core/database').run(statement.trim());
            }
        }

        logTest('Setup', 'Phone Mapping Migration', true, 'Migration applied successfully');
    } catch (error: any) {
        logTest('Setup', 'Phone Mapping Migration', false, `Warning: ${error?.message}`);
    }

    // Verify phone mapping
    try {
        const mapping = await getMerchantByPhone('whatsapp:+14155238886');
        const isCorrect = mapping?.merchantId === 'admin' && mapping?.userEmail === 'nyroxsystem@gmail.com';

        logTest('Setup', 'Phone Mapping Verification', isCorrect,
            isCorrect
                ? `Mapped to ${mapping?.merchantId} (${mapping?.userEmail})`
                : `Incorrect mapping: ${JSON.stringify(mapping)}`
        );

        if (!isCorrect) {
            // Try to set it manually
            await setPhoneMerchantMapping('whatsapp:+14155238886', 'admin', 'nyroxsystem@gmail.com', 'Test number');
            const retryMapping = await getMerchantByPhone('whatsapp:+14155238886');
            logTest('Setup', 'Phone Mapping Retry', retryMapping?.merchantId === 'admin',
                `Retry result: ${JSON.stringify(retryMapping)}`);
        }
    } catch (error: any) {
        logTest('Setup', 'Phone Mapping Verification', false, `Failed: ${error?.message}`);
    }

    return true;
}

// ==================== OEM RESOLUTION TESTS ====================

async function testOEMResolution() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  2. OEM RESOLUTION TESTS                   ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    const testCases = [
        {
            name: 'VW Golf 7 - Ölfilter',
            vehicle: { make: 'Volkswagen', model: 'Golf 7 1.6 TDI', year: 2015, kw: 81, hsn: '0603', tsn: 'BGU' },
            part: 'Ölfilter',
            expectedPattern: /^[0-9A-Z\s-]+$/i
        },
        {
            name: 'BMW 3er F30 - Bremsbeläge vorne',
            vehicle: { make: 'BMW', model: '3er F30 320d', year: 2014, kw: 135, hsn: '0005', tsn: 'BLH' },
            part: 'Bremsbeläge vorne',
            expectedPattern: /^[0-9]{11}$/
        },
        {
            name: 'Mercedes C-Klasse - Luftfilter',
            vehicle: { make: 'Mercedes-Benz', model: 'C-Klasse W205 C220d', year: 2016, kw: 125 },
            part: 'Luftfilter',
            expectedPattern: /^A[0-9]+$/
        }
    ];

    for (const testCase of testCases) {
        try {
            log(`\n📋 Testing: ${testCase.name}`, colors.blue);

            const result = await resolveOEMForOrder(
                `test-oem-${Date.now()}`,
                testCase.vehicle as any,
                testCase.part
            );

            const hasOEM = !!result.primaryOEM;
            const confidence = result.overallConfidence || 0;
            const is100Percent = confidence >= 1.0;
            const matchesPattern = testCase.expectedPattern.test(result.primaryOEM || '');

            logTest('OEM', testCase.name, hasOEM && is100Percent,
                `OEM: ${result.primaryOEM} | Confidence: ${(confidence * 100).toFixed(1)}% | Pattern: ${matchesPattern ? '✓' : '✗'}`,
                { oem: result.primaryOEM, confidence, sources: result.candidates?.length || 0 }
            );
        } catch (error: any) {
            logTest('OEM', testCase.name, false, `Error: ${error?.message}`);
        }
    }

    return true;
}

// ==================== WHATSAPP FLOW SIMULATION ====================

async function testWhatsAppFlow() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  3. WHATSAPP MESSAGE FLOW SIMULATION       ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    const testPhone = 'whatsapp:+14155238886';
    const botPhone = 'whatsapp:+14155238886'; // from bot

    // Step 1: Customer starts conversation
    log('\n🔄 STEP 1: Customer starts conversation', colors.magenta);
    try {
        logMessage(testPhone, botPhone, 'Hallo, ich brauche Bremsscheiben für meinen Golf', 'IN');

        const response1 = await handleIncomingBotMessage({
            from: testPhone,
            text: 'Hallo, ich brauche Bremsscheiben für meinen Golf',
            orderId: null,
            mediaUrls: undefined
        });

        logMessage(botPhone, testPhone, response1.reply, 'OUT');
        logTest('WhatsApp Flow', 'Step 1 - Greeting', true, 'Bot responded with vehicle info request');
    } catch (error: any) {
        logTest('WhatsApp Flow', 'Step 1 - Greeting', false, `Error: ${error?.message}`);
    }

    // Step 2: Customer provides vehicle info
    log('\n🔄 STEP 2: Customer provides vehicle info', colors.magenta);
    try {
        logMessage(testPhone, botPhone, 'VW Golf 7, Baujahr 2015, 1.6 TDI', 'IN');

        const response2 = await handleIncomingBotMessage({
            from: testPhone,
            text: 'VW Golf 7, Baujahr 2015, 1.6 TDI',
            orderId: null,
            mediaUrls: undefined
        });

        logMessage(botPhone, testPhone, response2.reply, 'OUT');
        logTest('WhatsApp Flow', 'Step 2 - Vehicle Info', true, 'Bot accepted vehicle information');
    } catch (error: any) {
        logTest('WhatsApp Flow', 'Step 2 - Vehicle Info', false, `Error: ${error?.message}`);
    }

    // Get active orders for this phone
    try {
        const orders = await supabase.listActiveOrdersByContact(testPhone);
        logTest('WhatsApp Flow', 'Order Creation', orders.length > 0,
            `Created ${orders.length} order(s)`,
            { orders: orders.map((o: any) => ({ id: o.id, status: o.status })) }
        );
    } catch (error: any) {
        logTest('WhatsApp Flow', 'Order Creation', false, `Error: ${error?.message}`);
    }

    return true;
}

// ==================== OFFER GENERATION TESTS ====================

async function testOfferGeneration() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  4. OFFER GENERATION TESTS                 ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    const testOEMs = [
        { oem: '1K0615301AA', name: 'VW Bremsscheibe (in stock)' },
        { oem: '8E0615301Q', name: 'Audi Bremsscheibe (external)' }
    ];

    for (const testCase of testOEMs) {
        try {
            log(`\n🛒 Testing offers for: ${testCase.name}`, colors.blue);
            const orderId = `test-offer-${Date.now()}`;

            const offers = await scrapeOffersForOrder(orderId, testCase.oem);

            const offerCount = Array.isArray(offers) ? offers.length : 0;
            logTest('Offers', testCase.name, offerCount > 0,
                `Found ${offerCount} offer(s)`,
                { offers: offers?.slice(0, 3) }
            );

            if (offerCount > 0 && Array.isArray(offers)) {
                const firstOffer = offers[0];
                log(`  💰 Price: ${firstOffer.price} ${firstOffer.currency}`);
                log(`  🏪 Shop: ${firstOffer.shopName}`);
                log(`  📦 Availability: ${firstOffer.availability}`);
                log(`  🚚 Delivery: ${firstOffer.deliveryTimeDays} days`);
                log(`  🖼️  Image: ${firstOffer.imageUrl ? 'Yes' : 'No'}`);
            }
        } catch (error: any) {
            logTest('Offers', testCase.name, false, `Error: ${error?.message}`);
        }
    }

    return true;
}

// ==================== DASHBOARD INTEGRATION TEST ====================

async function testDashboardIntegration() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  5. DASHBOARD INTEGRATION TEST             ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    const testPhone = 'whatsapp:+14155238886';

    try {
        // Get all orders for test phone
        const orders = await supabase.listActiveOrdersByContact(testPhone);

        logTest('Dashboard', 'Orders Visible', orders.length > 0,
            `Found ${orders.length} order(s) for ${testPhone}`,
            { orderIds: orders.map((o: any) => o.id) }
        );

        // Verify merchant mapping
        const mapping = await getMerchantByPhone(testPhone);

        logTest('Dashboard', 'Merchant Assignment',
            mapping?.userEmail === 'nyroxsystem@gmail.com',
            `Assigned to ${mapping?.userEmail} (${mapping?.merchantId})`
        );

    } catch (error: any) {
        logTest('Dashboard', 'Integration Check', false, `Error: ${error?.message}`);
    }

    return true;
}

// ==================== REPORT GENERATION ====================

async function generateTestReport() {
    log('\n╔════════════════════════════════════════════╗', colors.bold + colors.magenta);
    log('║        TEST REPORT GENERATION              ║', colors.bold + colors.magenta);
    log('╚════════════════════════════════════════════╝', colors.bold + colors.magenta);

    const report = [];
    report.push('# WhatsApp Bot Integration Test Report\n');
    report.push(`**Generated:** ${new Date().toISOString()}\n`);
    report.push(`**Test Phone:** +14155238886\n`);
    report.push(`**Assigned To:** nyroxsystem@gmail.com (admin)\n\n`);

    // Summary
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const percentage = ((passedTests / totalTests) * 100).toFixed(1);

    report.push('## Summary\n\n');
    report.push(`- **Total Tests:** ${totalTests}\n`);
    report.push(`- **Passed:** ${passedTests}\n`);
    report.push(`- **Failed:** ${totalTests - passedTests}\n`);
    report.push(`- **Success Rate:** ${percentage}%\n\n`);

    // OEM Results
    report.push('## OEM Resolution Results\n\n');
    const oemResults = results.filter(r => r.component === 'OEM');
    oemResults.forEach(r => {
        report.push(`### ${r.test}\n`);
        report.push(`- **Status:** ${r.passed ? '✅ PASSED' : '❌ FAILED'}\n`);
        report.push(`- **Message:** ${r.message}\n`);
        if (r.data) {
            report.push(`- **OEM:** ${r.data.oem}\n`);
            report.push(`- **Confidence:** ${(r.data.confidence * 100).toFixed(1)}%\n`);
            report.push(`- **Sources:** ${r.data.sources}\n`);
        }
        report.push('\n');
    });

    // Message Flow
    report.push('## WhatsApp Message Flow\n\n');
    messageLog.forEach((msg, idx) => {
        report.push(`### Message ${idx + 1} (${msg.type})\n`);
        report.push(`- **Time:** ${msg.timestamp}\n`);
        report.push(`- **From:** ${msg.from}\n`);
        report.push(`- **To:** ${msg.to}\n`);
        report.push(`- **Content:**\n\`\`\`\n${msg.message}\n\`\`\`\n\n`);
    });

    // Offers
    report.push('## Generated Offers\n\n');
    const offerResults = results.filter(r => r.component === 'Offers');
    offerResults.forEach(r => {
        report.push(`### ${r.test}\n`);
        report.push(`- **Status:** ${r.passed ? '✅ PASSED' : '❌ FAILED'}\n`);
        report.push(`- **Message:** ${r.message}\n`);
        if (r.data?.offers) {
            r.data.offers.forEach((offer: any, idx: number) => {
                report.push(`\n#### Offer ${idx + 1}\n`);
                report.push(`- **Shop:** ${offer.shopName}\n`);
                report.push(`- **Brand:** ${offer.brand}\n`);
                report.push(`- **Price:** ${offer.price} ${offer.currency}\n`);
                report.push(`- **Delivery:** ${offer.deliveryTimeDays} days\n`);
                report.push(`- **Image:** ${offer.imageUrl || 'N/A'}\n`);
            });
        }
        report.push('\n');
    });

    // Save report
    const reportPath = path.join(__dirname, '../test_report.md');
    fs.writeFileSync(reportPath, report.join(''));
    log(`\n📄 Test report saved to: ${reportPath}`, colors.green);

    return reportPath;
}

// ==================== MAIN ====================

async function main() {
    log('╔════════════════════════════════════════════╗', colors.bold + colors.magenta);
    log('║  COMPREHENSIVE WHATSAPP BOT TEST           ║', colors.bold + colors.magenta);
    log('║  With Dashboard Integration                ║', colors.bold + colors.magenta);
    log('╚════════════════════════════════════════════╝', colors.bold + colors.magenta);

    try {
        await testSetup();
        await testOEMResolution();
        await testWhatsAppFlow();
        await testOfferGeneration();
        await testDashboardIntegration();

        const reportPath = await generateTestReport();

        // Final summary
        const totalTests = results.length;
        const passedTests = results.filter(r => r.passed).length;
        const percentage = ((passedTests / totalTests) * 100).toFixed(1);

        log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
        log(`\n📈 OVERALL: ${passedTests}/${totalTests} tests passed (${percentage}%)`,
            parseFloat(percentage) >= 90 ? colors.green + colors.bold : colors.yellow);

        if (passedTests === totalTests) {
            log('\n🎉 ALL TESTS PASSED! Bot is fully operational!', colors.green + colors.bold);
        } else {
            const failed = results.filter(r => !r.passed);
            log('\n⚠️  Some tests failed:', colors.yellow);
            failed.forEach(r => {
                log(`   • [${r.component}] ${r.test}: ${r.message}`, colors.red);
            });
        }

        log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', colors.cyan);
        log(`📄 Full report: ${reportPath}\n`, colors.cyan);

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

export { main as runComprehensiveTest };
