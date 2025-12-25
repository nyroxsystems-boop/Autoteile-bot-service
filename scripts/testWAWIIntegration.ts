/**
 * WAWI System Integration Test
 * Tests complete data flow from database to dashboard
 */

import axios from 'axios';
import * as db from '../src/services/database';

const API_BASE_URL = 'http://localhost:3000';
const API_TOKEN = 'api_dev_secret';
const DEALER_ID = 'dealer-demo-001';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
    data?: any;
}

const testResults: TestResult[] = [];

function log(message: string, color: string = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function logTest(name: string, passed: boolean, message: string, data?: any) {
    const icon = passed ? '✅' : '❌';
    const color = passed ? colors.green : colors.red;
    log(`${icon} ${name}: ${message}`, color);
    testResults.push({ name, passed, message, data });
}

async function apiCall(method: string, endpoint: string, data?: any) {
    try {
        const response = await axios({
            method,
            url: `${API_BASE_URL}${endpoint}`,
            headers: {
                'Authorization': `Token ${API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data
        });
        return { success: true, data: response.data, status: response.status };
    } catch (error: any) {
        return {
            success: false,
            error: error.response?.data || error.message,
            status: error.response?.status
        };
    }
}

async function testDatabaseConnection() {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
    log('1. DATABASE CONNECTION TESTS', colors.bold + colors.cyan);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);

    try {
        // Initialize database first
        const { initDb } = await import('../src/services/database');
        await initDb();

        const result = await db.get('SELECT 1 as test');
        logTest('Database Connection', true, 'Database is accessible');
    } catch (error) {
        logTest('Database Connection', false, 'Database connection failed');
        return false;
    }

    // Check if demo data exists
    const orderCount = await db.get<any>('SELECT COUNT(*) as count FROM orders');
    const hasData = orderCount.count > 0;
    logTest('Demo Data Exists', hasData, `Found ${orderCount.count} orders in database`);

    if (!hasData) {
        log('\n⚠️  No demo data found. Please run: npm run generate-demo-data', colors.yellow);
        return false;
    }

    return true;
}

async function testAPIHealth() {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
    log('2. API HEALTH TESTS', colors.bold + colors.cyan);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);

    // Test basic health
    const health = await apiCall('GET', '/health');
    logTest('API Health Check', health.success,
        health.success ? 'API is healthy' : 'API health check failed');

    // Test database health
    const dbHealth = await apiCall('GET', '/health/db');
    logTest('Database Health Check', dbHealth.success,
        dbHealth.success ? 'Database connection is healthy' : 'Database health check failed');

    // Test bot health
    const botHealth = await apiCall('GET', '/api/bot/health');
    logTest('Bot Health Check', botHealth.success,
        botHealth.success ? `Bot uptime: ${botHealth.data?.uptime?.toFixed(2)}s` : 'Bot health check failed');

    return health.success && dbHealth.success && botHealth.success;
}

async function testDashboardEndpoints() {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
    log('3. DASHBOARD ENDPOINT TESTS', colors.bold + colors.cyan);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);

    // Test orders endpoint
    const orders = await apiCall('GET', '/api/dashboard/orders');
    const ordersValid = orders.success && Array.isArray(orders.data) && orders.data.length > 0;
    logTest('Dashboard Orders', ordersValid,
        ordersValid ? `Retrieved ${orders.data.length} orders` : 'Failed to retrieve orders',
        ordersValid ? { count: orders.data.length, sample: orders.data[0] } : null);

    // Test stats endpoint
    const stats = await apiCall('GET', '/api/dashboard/stats');
    const statsValid = stats.success && stats.data?.ordersCount !== undefined;
    logTest('Dashboard Stats', statsValid,
        statsValid ? `Orders: ${stats.data.ordersCount}, Messages: ${stats.data.incomingMessages}` : 'Failed to retrieve stats',
        stats.data);

    // Test merchant settings
    const settings = await apiCall('GET', `/api/dashboard/merchant/settings/${DEALER_ID}`);
    const settingsValid = settings.success && settings.data?.dealerName !== undefined;
    logTest('Merchant Settings', settingsValid,
        settingsValid ? `Dealer: ${settings.data.dealerName}` : 'Failed to retrieve merchant settings',
        settings.data);

    return ordersValid && statsValid && settingsValid;
}

async function testOrderDetails() {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
    log('4. ORDER DETAILS TESTS', colors.bold + colors.cyan);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);

    // Get first order
    const orders = await apiCall('GET', '/api/dashboard/orders');
    if (!orders.success || !orders.data || orders.data.length === 0) {
        logTest('Order Details', false, 'No orders available to test');
        return false;
    }

    const firstOrder = orders.data[0];
    const orderId = firstOrder.id;

    // Test single order retrieval
    const orderDetail = await apiCall('GET', `/api/dashboard/orders/${orderId}`);
    const detailValid = orderDetail.success && orderDetail.data?.id === orderId;
    logTest('Order Detail Retrieval', detailValid,
        detailValid ? `Retrieved order ${orderId}` : 'Failed to retrieve order details',
        orderDetail.data);

    // Test order has required fields
    if (detailValid) {
        const order = orderDetail.data;
        const hasRequiredFields =
            order.id !== undefined &&
            order.status !== undefined &&
            order.created_at !== undefined;

        logTest('Order Data Structure', hasRequiredFields,
            hasRequiredFields ? 'Order has all required fields' : 'Order missing required fields',
            { id: order.id, status: order.status, hasVehicle: !!order.vehicle });
    }

    return detailValid;
}

async function testOffersIntegration() {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
    log('5. OFFERS INTEGRATION TESTS', colors.bold + colors.cyan);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);

    // Get all offers
    const offers = await apiCall('GET', '/api/offers');
    const offersValid = offers.success && Array.isArray(offers.data);
    logTest('Offers Retrieval', offersValid,
        offersValid ? `Retrieved ${offers.data.length} offers` : 'Failed to retrieve offers',
        offersValid ? { count: offers.data.length } : null);

    // Check offer data structure
    if (offersValid && offers.data.length > 0) {
        const sampleOffer = offers.data[0];
        const hasRequiredFields =
            sampleOffer.shopName !== undefined &&
            sampleOffer.price !== undefined &&
            sampleOffer.orderId !== undefined;

        logTest('Offer Data Structure', hasRequiredFields,
            hasRequiredFields ? 'Offers have correct structure' : 'Offers missing required fields',
            sampleOffer);
    }

    return offersValid;
}

async function testSuppliersIntegration() {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
    log('6. SUPPLIERS INTEGRATION TESTS', colors.bold + colors.cyan);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);

    const suppliers = await apiCall('GET', '/api/suppliers');
    const suppliersValid = suppliers.success && Array.isArray(suppliers.data) && suppliers.data.length > 0;
    logTest('Suppliers Retrieval', suppliersValid,
        suppliersValid ? `Retrieved ${suppliers.data.length} suppliers` : 'Failed to retrieve suppliers',
        suppliersValid ? { suppliers: suppliers.data.map((s: any) => s.name) } : null);

    return suppliersValid;
}

async function testWWSConnections() {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
    log('7. WWS CONNECTIONS TESTS', colors.bold + colors.cyan);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);

    const connections = await apiCall('GET', '/api/wws-connections');
    const connectionsValid = connections.success && Array.isArray(connections.data);
    logTest('WWS Connections', connectionsValid,
        connectionsValid ? `Retrieved ${connections.data.length} connections` : 'Failed to retrieve connections',
        connections.data);

    return connectionsValid;
}

async function testDataConsistency() {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
    log('8. DATA CONSISTENCY TESTS', colors.bold + colors.cyan);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);

    // Compare database counts with API counts
    const dbOrderCount = await db.get<any>('SELECT COUNT(*) as count FROM orders');
    const apiOrders = await apiCall('GET', '/api/dashboard/orders');

    const countsMatch = apiOrders.success && apiOrders.data.length === dbOrderCount.count;
    logTest('Order Count Consistency', countsMatch,
        countsMatch
            ? `Database and API both report ${dbOrderCount.count} orders`
            : `Mismatch: DB has ${dbOrderCount.count}, API returned ${apiOrders.data?.length || 0}`,
        { database: dbOrderCount.count, api: apiOrders.data?.length || 0 });

    // Check if stats match database
    const stats = await apiCall('GET', '/api/dashboard/stats');
    const statsMatch = stats.success && stats.data.ordersCount === dbOrderCount.count;
    logTest('Stats Consistency', statsMatch,
        statsMatch
            ? `Stats endpoint reports correct order count: ${stats.data.ordersCount}`
            : `Stats mismatch: expected ${dbOrderCount.count}, got ${stats.data?.ordersCount || 0}`);

    return countsMatch && statsMatch;
}

async function testCompleteWorkflow() {
    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
    log('9. COMPLETE WORKFLOW TEST', colors.bold + colors.cyan);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);

    // Get an order with status 'show_offers' or 'done'
    const orders = await apiCall('GET', '/api/dashboard/orders');
    if (!orders.success || !orders.data) {
        logTest('Workflow Test', false, 'No orders available');
        return false;
    }

    const completedOrder = orders.data.find((o: any) =>
        o.status === 'show_offers' || o.status === 'done'
    );

    if (!completedOrder) {
        logTest('Workflow Test', false, 'No completed orders found');
        return false;
    }

    // Check if order has all workflow data
    const hasVehicle = completedOrder.vehicle !== null && completedOrder.vehicle !== undefined;
    const hasOEM = completedOrder.oem_number !== null && completedOrder.oem_number !== undefined;

    logTest('Order Has Vehicle Data', hasVehicle,
        hasVehicle
            ? `Vehicle: ${completedOrder.vehicle?.make} ${completedOrder.vehicle?.model}`
            : 'Order missing vehicle data');

    logTest('Order Has OEM Number', hasOEM,
        hasOEM
            ? `OEM: ${completedOrder.oem_number}`
            : 'Order missing OEM number');

    // Check if order has offers
    const dbOffers = await db.all<any>(
        'SELECT * FROM shop_offers WHERE order_id = ?',
        [completedOrder.id]
    );

    const hasOffers = dbOffers.length > 0;
    logTest('Order Has Offers', hasOffers,
        hasOffers
            ? `Found ${dbOffers.length} offers for order`
            : 'Order has no offers');

    return hasVehicle && hasOEM && hasOffers;
}

async function printSummary() {
    log('\n╔════════════════════════════════════════════╗', colors.bold);
    log('║          TEST SUMMARY                      ║', colors.bold);
    log('╚════════════════════════════════════════════╝', colors.bold);

    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);

    log(`\n📊 Total Tests: ${totalTests}`, colors.cyan);
    log(`✅ Passed: ${passedTests}`, colors.green);
    log(`❌ Failed: ${failedTests}`, failedTests > 0 ? colors.red : colors.green);
    log(`📈 Success Rate: ${successRate}%`,
        parseFloat(successRate) >= 90 ? colors.green : colors.yellow);

    if (failedTests > 0) {
        log('\n❌ Failed Tests:', colors.red);
        testResults.filter(r => !r.passed).forEach(r => {
            log(`   • ${r.name}: ${r.message}`, colors.red);
        });
    }

    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (passedTests === totalTests) {
        log('🎉 ALL TESTS PASSED! WAWI System is fully operational!', colors.green + colors.bold);
        log('✅ Dashboard is ready for dealer use at: http://localhost:5173', colors.green);
    } else {
        log('⚠️  Some tests failed. Please review the errors above.', colors.yellow);
    }

    return passedTests === totalTests;
}

async function main() {
    log('╔════════════════════════════════════════════╗', colors.bold + colors.cyan);
    log('║   WAWI SYSTEM INTEGRATION TEST             ║', colors.bold + colors.cyan);
    log('║   Complete Dashboard & Backend Test        ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.bold + colors.cyan);

    try {
        // Run all tests
        const dbOk = await testDatabaseConnection();
        if (!dbOk) {
            log('\n❌ Database tests failed. Stopping test suite.', colors.red);
            process.exit(1);
        }

        await testAPIHealth();
        await testDashboardEndpoints();
        await testOrderDetails();
        await testOffersIntegration();
        await testSuppliersIntegration();
        await testWWSConnections();
        await testDataConsistency();
        await testCompleteWorkflow();

        // Print summary
        const allPassed = await printSummary();

        process.exit(allPassed ? 0 : 1);

    } catch (error) {
        log(`\n❌ Test suite error: ${error}`, colors.red);
        console.error(error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

export { main as runIntegrationTests };
