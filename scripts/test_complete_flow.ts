import { scrapeOffersForOrder } from '../src/services/scrapingService';
import { initDb } from '../src/services/database';

async function testCompleteFlow() {
    console.log("🧪 === COMPLETE FLOW TEST ===\n");

    await initDb();

    // Test 1: OEM-Nummer die im Händler-Lager ist (1K0...)
    console.log("📦 TEST 1: Teil im Händler-Lager");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const inventoryOffers = await scrapeOffersForOrder('test-order-1', '1K0615301AA');

    console.log(`✅ Gefundene Angebote: ${inventoryOffers.length}\n`);

    if (inventoryOffers.length > 0) {
        const offer = inventoryOffers[0];
        console.log("📋 ANGEBOT FÜR KUNDE:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`🏷️  Marke: ${offer.brand}`);
        console.log(`💰 Preis: ${offer.price} ${offer.currency}`);
        console.log(`📦 Verfügbarkeit: ${offer.availability}`);
        console.log(`🚚 Lieferzeit: ${offer.deliveryTimeDays} Tage`);
        console.log(`🖼️  Bild: ${offer.imageUrl ? '✅ Vorhanden' : '❌ Fehlt'}`);
        console.log(`🔗 Link: ${offer.productUrl || 'Kein Link (Händler-Lager)'}`);

        console.log("\n📱 WHATSAPP-NACHRICHT AN KUNDE:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        const isInStock = offer.shopName === "Händler-Lager";
        const stockInfo = isInStock ? "📦 *Sofort abholbereit!*" : `🚚 *Lieferzeit:* ${offer.deliveryTimeDays} Tage`;

        const message =
            `✅ *Perfektes Angebot gefunden!*\n\n` +
            `🏷️ *Marke:* ${offer.brand}\n` +
            `💰 *Preis:* ${offer.price} ${offer.currency}\n` +
            `${stockInfo}\n\n` +
            `⚠️ HINWEIS: Mit deiner Bestätigung gibst du ein\n` +
            `verbindliches Kaufangebot bei deinem Händler ab.\n\n` +
            `Jetzt verbindlich bestellen?`;

        console.log(message);
        console.log(`\n[Produktbild wird gesendet: ${offer.imageUrl}]`);
        console.log("\n[Buttons: Ja, jetzt bestellen | Nein, andere suchen]\n");
    }

    // Test 2: OEM-Nummer die NICHT im Lager ist (externe Shops)
    console.log("\n\n🌐 TEST 2: Teil nicht im Lager (externe Shops)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("⏳ Starte Scraping von Autodoc & KFZTeile24...");
    console.log("   (Dies kann 30-60 Sekunden dauern)\n");

    const externalOffers = await scrapeOffersForOrder('test-order-2', '8E0615301Q');

    console.log(`✅ Gefundene Angebote: ${externalOffers.length}\n`);

    if (externalOffers.length > 0) {
        const offer = externalOffers[0];
        console.log("📋 ANGEBOT FÜR KUNDE:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`🏷️  Marke: ${offer.brand}`);
        console.log(`💰 Preis: ${offer.price} ${offer.currency}`);
        console.log(`📦 Verfügbarkeit: ${offer.availability}`);
        console.log(`🚚 Lieferzeit: ${offer.deliveryTimeDays} Tage`);
        console.log(`🖼️  Bild: ${offer.imageUrl ? '✅ Vorhanden' : '❌ Fehlt'}`);
        console.log(`🔗 Link (nur für Händler): ${offer.productUrl || 'N/A'}`);

        console.log("\n📱 WHATSAPP-NACHRICHT AN KUNDE:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        const stockInfo = `🚚 *Lieferzeit:* ${offer.deliveryTimeDays} Tage`;

        const message =
            `✅ *Perfektes Angebot gefunden!*\n\n` +
            `🏷️ *Marke:* ${offer.brand}\n` +
            `💰 *Preis:* ${offer.price} ${offer.currency}\n` +
            `${stockInfo}\n\n` +
            `⚠️ HINWEIS: Mit deiner Bestätigung gibst du ein\n` +
            `verbindliches Kaufangebot bei deinem Händler ab.\n\n` +
            `Jetzt verbindlich bestellen?`;

        console.log(message);
        console.log(`\n[Produktbild wird gesendet: ${offer.imageUrl}]`);
        console.log("\n[Buttons: Ja, jetzt bestellen | Nein, andere suchen]\n");

        // Zeige was Händler sieht
        console.log("\n💼 HÄNDLER-DASHBOARD:");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`🏪 Shop: ${offer.shopName}`);
        console.log(`🔗 Bestell-Link: ${offer.productUrl}`);
        console.log(`💰 Einkaufspreis: ${offer.price} EUR`);
        console.log(`📊 Empfohlener Verkaufspreis: ${(offer.price * 1.3).toFixed(2)} EUR (+30%)`);
    }

    console.log("\n\n✅ === TEST ABGESCHLOSSEN ===\n");
    process.exit(0);
}

testCompleteFlow().catch(e => {
    console.error("❌ Test failed:", e);
    process.exit(1);
});
