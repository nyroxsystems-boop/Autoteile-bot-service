/**
 * COMPREHENSIVE SYSTEM INTEGRATION TEST
 * Tests: CRM, Dashboard, Bot-Service & InvenTree Integration
 */

import axios from 'axios';
import * as db from '../src/services/database';

const API_BASE_URL = 'http://localhost:3000';
const API_TOKEN = 'api_dev_secret';
const DASHBOARD_URL = 'http://localhost:5173';

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

async function apiCall(endpoint: string, options: any = {}) {
    try {
        const response = await axios({
            method: options.method || 'GET',
            url: `${API_BASE_URL}${endpoint}`,
            headers: {
                'Authorization': `Token ${API_TOKEN}`,
                'Content-Type': 'application/json',
                ...options.headers
            },
            data: options.data
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

// ==================== CRM SYSTEM TESTS ====================

async function testCRMDatabase() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  1. CRM DATABASE TESTS                     ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    try {
        const { initDb } = await import('../src/services/database');
        await initDb();
        logTest('CRM', 'Database Connection', true, 'Database initialized successfully');
    } catch (error) {
        logTest('CRM', 'Database Connection', false, 'Failed to initialize database');
        return false;
    }

    // Test tables exist
    const tables = ['orders', 'messages', 'shop_offers', 'merchant_settings', 'users', 'sessions'];
    for (const table of tables) {
        try {
            await db.get(`SELECT COUNT(*) as count FROM ${table}`);
            logTest('CRM', `Table: ${table}`, true, 'Table exists and is accessible');
        } catch (error) {
            logTest('CRM', `Table: ${table}`, false, 'Table not found or inaccessible');
        }
    }

    // Test data integrity
    const orderCount = await db.get<any>('SELECT COUNT(*) as count FROM orders');
    logTest('CRM', 'Orders Data', orderCount.count > 0, `Found ${orderCount.count} orders`);

    const userCount = await db.get<any>('SELECT COUNT(*) as count FROM users');
    logTest('CRM', 'Users Data', userCount.count > 0, `Found ${userCount.count} users`);

    return true;
}

// ==================== BOT SERVICE TESTS ====================

async function testBotService() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  2. BOT SERVICE TESTS                      ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    // Health check
    const health = await apiCall('/health');
    logTest('Bot-Service', 'Health Check', health.success,
        health.success ? 'Service is healthy' : 'Service health check failed');

    // Database health
    const dbHealth = await apiCall('/health/db');
    logTest('Bot-Service', 'Database Health', dbHealth.success,
        dbHealth.success ? 'Database connection healthy' : 'Database connection failed');

    // Bot health
    const botHealth = await apiCall('/api/bot/health');
    logTest('Bot-Service', 'Bot Health', botHealth.success,
        botHealth.success ? `Uptime: ${botHealth.data?.uptime?.toFixed(2)}s` : 'Bot health check failed');

    // Authentication
    const loginTest = await apiCall('/api/auth/login', {
        method: 'POST',
        data: { email: 'admin@autoteile-mueller.de', password: 'demo123' }
    });
    logTest('Bot-Service', 'Authentication', loginTest.success,
        loginTest.success ? 'Login successful' : 'Login failed');

    return health.success && dbHealth.success;
}

// ==================== API ENDPOINTS TESTS ====================

async function testAPIEndpoints() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  3. API ENDPOINTS TESTS                    ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    const endpoints = [
        { path: '/api/dashboard/orders', name: 'Dashboard Orders' },
        { path: '/api/dashboard/stats', name: 'Dashboard Stats' },
        { path: '/api/orders', name: 'Orders API' },
        { path: '/api/suppliers', name: 'Suppliers API' },
        { path: '/api/offers', name: 'Offers API' },
        { path: '/api/wws-connections', name: 'WWS Connections' },
        { path: '/api/users', name: 'User Management' },
        { path: '/api/bot/health', name: 'Bot Health' }
    ];

    for (const endpoint of endpoints) {
        const result = await apiCall(endpoint.path);
        logTest('API', endpoint.name, result.success,
            result.success ? `${endpoint.path} accessible` : `${endpoint.path} failed`);
    }

    return true;
}

// ==================== DASHBOARD INTEGRATION TESTS ====================

async function testDashboardIntegration() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  4. DASHBOARD INTEGRATION TESTS            ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    try {
        const response = await axios.get(DASHBOARD_URL);
        logTest('Dashboard', 'Frontend Accessible', response.status === 200,
            response.status === 200 ? 'Dashboard is running' : 'Dashboard not accessible');
    } catch (error) {
        logTest('Dashboard', 'Frontend Accessible', false, 'Dashboard not reachable');
    }

    // Test API integration from dashboard perspective
    const ordersFromDashboard = await apiCall('/api/dashboard/orders');
    logTest('Dashboard', 'Orders Integration', ordersFromDashboard.success,
        ordersFromDashboard.success ? `Retrieved ${ordersFromDashboard.data?.length || 0} orders` : 'Failed to retrieve orders');

    const statsFromDashboard = await apiCall('/api/dashboard/stats');
    logTest('Dashboard', 'Stats Integration', statsFromDashboard.success,
        statsFromDashboard.success ? `Orders: ${statsFromDashboard.data?.ordersCount}` : 'Failed to retrieve stats');

    return true;
}

// ==================== INVENTREE INTEGRATION TESTS ====================

async function testInvenTreeIntegration() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  5. INVENTREE INTEGRATION TESTS            ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    // Test InvenTree adapter functions
    try {
        const { listOrders, getMerchantSettings } = await import('../src/services/inventreeAdapter');

        const orders = await listOrders();
        logTest('InvenTree', 'List Orders', orders.length >= 0,
            `Retrieved ${orders.length} orders from adapter`);

        const settings = await getMerchantSettings('dealer-demo-001');
        logTest('InvenTree', 'Merchant Settings', !!settings,
            settings ? `Dealer: ${settings.dealerName}` : 'No settings found');

    } catch (error: any) {
        logTest('InvenTree', 'Adapter Functions', false, `Error: ${error.message}`);
    }

    return true;
}

// ==================== END-TO-END WORKFLOW TESTS ====================

async function testEndToEndWorkflow() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  6. END-TO-END WORKFLOW TESTS              ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    // 1. Create new order
    const newOrder = await apiCall('/api/orders', {
        method: 'POST',
        data: {
            requestedPartName: 'Test Bremsscheiben',
            customerName: 'Test Kunde',
            customerContact: '+491234567890'
        }
    });
    logTest('Workflow', 'Create Order', newOrder.success,
        newOrder.success ? `Order created: ${newOrder.data?.id}` : 'Failed to create order');

    if (!newOrder.success) return false;

    const orderId = newOrder.data.id;

    // 2. Scrape offers for order
    const scrapeResult = await apiCall(`/api/orders/${orderId}/scrape-offers`, {
        method: 'POST',
        data: { oem: '1K0615301AA' }
    });
    logTest('Workflow', 'Scrape Offers', scrapeResult.success,
        scrapeResult.success ? `Found ${scrapeResult.data?.offers?.length || 0} offers` : 'Failed to scrape offers');

    // 3. Retrieve order details
    const orderDetails = await apiCall(`/api/dashboard/orders/${orderId}`);
    logTest('Workflow', 'Retrieve Order', orderDetails.success,
        orderDetails.success ? 'Order details retrieved' : 'Failed to retrieve order');

    // 4. WhatsApp simulation
    const whatsappSim = await apiCall('/simulate/whatsapp', {
        method: 'POST',
        data: {
            from: 'whatsapp:+491234567890',
            text: 'Test Nachricht für Integration'
        }
    });
    logTest('Workflow', 'WhatsApp Simulation', whatsappSim.success,
        whatsappSim.success ? 'Message processed' : 'Failed to process message');

    return true;
}

// ==================== USER MANAGEMENT TESTS ====================

async function testUserManagement() {
    log('\n╔════════════════════════════════════════════╗', colors.cyan);
    log('║  7. USER MANAGEMENT TESTS                  ║', colors.bold + colors.cyan);
    log('╚════════════════════════════════════════════╝', colors.cyan);

    // List users
    const users = await apiCall('/api/users');
    logTest('User-Mgmt', 'List Users', users.success,
        users.success ? `Found ${users.data?.length || 0} users` : 'Failed to list users');

    // Create test user
    const testEmail = `test-${Date.now()}@example.com`;
    const createUser = await apiCall('/api/users', {
        method: 'POST',
        data: {
            email: testEmail,
            username: `testuser${Date.now()}`,
            password: 'test123456',
            full_name: 'Test User',
            role: 'staff'
        }
    });
    logTest('User-Mgmt', 'Create User', createUser.success,
        createUser.success ? `User created: ${createUser.data?.id}` : 'Failed to create user');

    if (createUser.success) {
        const userId = createUser.data.id;

        // Update user
        const updateUser = await apiCall(`/api/users/${userId}`, {
            method: 'PUT',
            data: { role: 'admin' }
        });
        logTest('User-Mgmt', 'Update User', updateUser.success,
            updateUser.success ? 'User updated to admin' : 'Failed to update user');

        // Delete user
        const deleteUser = await apiCall(`/api/users/${userId}`, {
            method: 'DELETE'
        });
        logTest('User-Mgmt', 'Delete User', deleteUser.success,
            deleteUser.success ? 'User deleted' : 'Failed to delete user');
    }

    return true;
}

// ==================== SYSTEM SUMMARY ====================

async function printSystemSummary() {
    log('\n╔════════════════════════════════════════════╗', colors.bold + colors.magenta);
    log('║        SYSTEM INTEGRATION SUMMARY          ║', colors.bold + colors.magenta);
    log('╚════════════════════════════════════════════╝', colors.bold + colors.magenta);

    const components = ['CRM', 'Bot-Service', 'API', 'Dashboard', 'InvenTree', 'Workflow', 'User-Mgmt'];

    for (const component of components) {
        const componentResults = results.filter(r => r.component === component);
        const passed = componentResults.filter(r => r.passed).length;
        const total = componentResults.length;
        const percentage = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

        const color = parseFloat(percentage) >= 90 ? colors.green :
            parseFloat(percentage) >= 70 ? colors.yellow : colors.red;

        log(`\n📊 ${component}:`, colors.cyan);
        log(`   Tests: ${passed}/${total} passed (${percentage}%)`, color);
    }

    const totalTests = results.length;
    const totalPassed = results.filter(r => r.passed).length;
    const totalPercentage = ((totalPassed / totalTests) * 100).toFixed(1);

    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
    log(`\n📈 OVERALL: ${totalPassed}/${totalTests} tests passed (${totalPercentage}%)`,
        parseFloat(totalPercentage) >= 90 ? colors.green + colors.bold : colors.yellow);

    if (totalPassed === totalTests) {
        log('\n🎉 ALL SYSTEMS OPERATIONAL! Full integration verified!', colors.green + colors.bold);
    } else {
        const failed = results.filter(r => !r.passed);
        log('\n⚠️  Some tests failed:', colors.yellow);
        failed.forEach(r => {
            log(`   • [${r.component}] ${r.test}: ${r.message}`, colors.red);
        });
    }

    log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', colors.cyan);

    return totalPassed === totalTests;
}

// ==================== MAIN ====================

async function main() {
    log('╔════════════════════════════════════════════╗', colors.bold + colors.magenta);
    log('║  COMPREHENSIVE SYSTEM INTEGRATION TEST     ║', colors.bold + colors.magenta);
    log('║  CRM • Dashboard • Bot-Service • InvenTree ║', colors.bold + colors.magenta);
    log('╚════════════════════════════════════════════╝', colors.bold + colors.magenta);

    try {
        await testCRMDatabase();
        await testBotService();
        await testAPIEndpoints();
        await testDashboardIntegration();
        await testInvenTreeIntegration();
        await testEndToEndWorkflow();
        await testUserManagement();

        const allPassed = await printSystemSummary();

        process.exit(allPassed ? 0 : 1);

    } catch (error) {
        log(`\n❌ Test suite error: ${error}`, colors.red);
        console.error(error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

export { main as runSystemIntegrationTest };
