import { scrapeOffersForOrder } from '../src/services/scrapingService';
import { logger } from '../src/utils/logger';

// Test with a REAL, common OEM number
const TEST_CASES = [
    { oem: '1K0615301AA', description: 'VW/Audi Bremsscheibe (sehr häufig)' },
    { oem: '8E0615301Q', description: 'Audi A4 Bremsscheibe' },
    { oem: '51712155358', description: 'BMW Stoßstange' }
];

async function testScraperAPI() {
    console.log("=== SCRAPER API TEST ===\n");

    for (const testCase of TEST_CASES) {
        console.log(`\n--- Testing OEM: ${testCase.oem} (${testCase.description}) ---`);

        try {
            const offers = await scrapeOffersForOrder('test-order', testCase.oem);

            if (offers.length > 0) {
                console.log(`✅ SUCCESS! Found ${offers.length} offers:`);
                offers.slice(0, 3).forEach((o, i) => {
                    console.log(`  [${i + 1}] ${o.shopName}: ${o.brand} - ${o.price}€ (${o.availability})`);
                });
                break; // Stop after first success
            } else {
                console.log(`⚠️  No offers found for ${testCase.oem}`);
            }
        } catch (e: any) {
            console.error(`❌ Error: ${e.message}`);
        }
    }

    console.log("\n=== TEST COMPLETE ===");
    process.exit(0);
}

testScraperAPI();
