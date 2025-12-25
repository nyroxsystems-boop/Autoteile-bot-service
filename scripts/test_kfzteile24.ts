import { RealisticBrowserScraper } from '../src/services/scrapers/realisticBrowserScraper';

async function testKFZTeile24() {
    console.log("🧪 Testing KFZTeile24 with different OEM numbers...\n");

    const scraper = new RealisticBrowserScraper('KFZTeile24', 'kfzteile24');

    const testNumbers = [
        '1K0615301AA',  // VW/Audi Bremsscheibe (sehr häufig)
        '5Q0615301G',   // VW Golf 7 Bremsscheibe
        '1J0615301C'    // VW Golf 4 Bremsscheibe
    ];

    for (const oem of testNumbers) {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Testing OEM: ${oem}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        const offers = await scraper.fetchOffers(oem);

        console.log(`\n✅ Found ${offers.length} offers\n`);

        if (offers.length > 0) {
            console.log("📋 First 3 offers:");
            offers.slice(0, 3).forEach((o, i) => {
                console.log(`  ${i + 1}. ${o.brand} - ${o.price}€ (${o.deliveryTimeDays} days)`);
            });
            break; // Stop after first success
        }
    }

    await RealisticBrowserScraper.cleanup();
    console.log("\n✅ Test complete!");
    process.exit(0);
}

testKFZTeile24().catch(e => {
    console.error("❌ Error:", e);
    process.exit(1);
});
