
import { initDb } from '../src/services/database';
// Use the adapter which now wraps the DB calls
import { insertOrder, listOrders } from '../src/services/inventreeAdapter';
import { scrapeOffersForOrder } from '../src/services/scrapingService';
import { createAdminRouter } from '../src/routes/adminRoutes';
import express from 'express';
import request from 'supertest';
import { logger } from '../src/utils/logger';

// Mock logger compatible with Winstons Logger interface (partial)
const mockLogger = {
    info: (msg: string, meta?: any) => console.log(`[INFO] ${msg}`, meta || ''),
    error: (msg: string, meta?: any) => console.error(`[ERROR] ${msg}`, meta || ''),
    warn: (msg: string, meta?: any) => console.warn(`[WARN] ${msg}`, meta || ''),
    debug: (msg: string, meta?: any) => console.debug(`[DEBUG] ${msg}`, meta || ''),
    log: (level: string, msg: string) => console.log(`[${level}] ${msg}`)
};

// Force overwrite for testing context if possible, or just ignore since we want to see output
// logger is imported as const, so we can't easily overwrite it if it's not a var.
// But we actually just want to see the real logs anyway, so let's skip mocking logger 
// and just let it print to stdout (which Winston usually does).

async function runTest() {
    console.log("=== STARTING FULL SYSTEM TEST ===");

    // 1. Database Init
    console.log("\n--- 1. Testing Database Initialization ---");
    try {
        await initDb();
        console.log("✅ Database initialized successfully.");
    } catch (e) {
        console.error("❌ Database init failed:", e);
        // Process might continue if DB is already open/locked, but let's try.
    }

    // 2. Order Creation
    console.log("\n--- 2. Testing CRM/Order Creation ---");
    try {
        // Create a new order via the adapter
        await insertOrder({
            customer_contact: "491511234567",
            status: "oem_lookup",
            order_data: { test: true }
        });

        const orders = await listOrders();
        console.log(`✅ Orders found in DB: ${orders.length}`);

        // Find our test order (most recent)
        // listOrders usually sorts by date desc
        const latest = orders[0];
        if (!latest) throw new Error("No order created");

        console.log("   Latest Order ID:", latest.id);

        // 3. Admin / KPI Check
        console.log("\n--- 3. Testing Admin API / KPIs ---");
        const app = express();
        app.use(express.json());
        app.use('/api/admin', createAdminRouter());

        const res = await request(app).get('/api/admin/kpis');
        console.log("   KPI Response Status:", res.status);
        console.log("   KPI Data:", JSON.stringify(res.body, null, 2));

        if (res.status === 200 && res.body.sales) {
            console.log("✅ Admin KPIs are working and connected to DB.");
        } else {
            console.error("❌ Admin KPIs failed.");
        }

        // 4. Scraping (Puppeteer)
        // We will test with a known OEM: "09.9145.11" (Brembo Brake Disc, common)
        const TEST_OEM = "09.9145.11";
        console.log(`\n--- 4. Testing Puppeteer Scraping (Stealth Mode) for OEM: ${TEST_OEM} ---`);
        console.log("   Please wait, launching headless browser... (this may take 10-20s)");

        // We must ensure the latest.id is passed as string
        const offers = await scrapeOffersForOrder(String(latest.id), TEST_OEM);

        console.log(`\n   Scrape finished. Found ${offers.length} offers.`);
        if (offers.length > 0) {
            console.log("✅ Scraping successful!");
            offers.slice(0, 3).forEach((o, i) => {
                console.log(`   [${i + 1}] ${o.shopName}: ${o.price} ${o.currency} - ${o.brand} (${o.availability})`);
            });
            if (offers.length > 3) console.log(`   ... and ${offers.length - 3} more.`);
        } else {
            console.warn("⚠️  Scraping finished but returned 0 offers.");
            console.log("    (This is possible if cloudflare blocked the request or the part wasn't found in top results)");
        }

    } catch (e) {
        console.error("❌ Test failed with error:", e);
    }

    console.log("\n=== TEST COMPLETE ===");
    process.exit(0);
}

runTest();
