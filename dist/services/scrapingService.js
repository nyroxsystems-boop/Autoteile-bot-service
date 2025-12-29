"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeOffersForOrder = scrapeOffersForOrder;
const supabaseService_1 = require("./supabaseService");
/**
 * Mock-Adapter für einen Shop (z.B. Autodoc).
 * Später werden hier echte Scraper/API-Calls implementiert.
 */
// Realistic Browser Scraper (headless=false, human-like)
const realisticBrowserScraper_1 = require("./scrapers/realisticBrowserScraper");
const kfzteile24VehicleScraper_1 = require("./scrapers/kfzteile24VehicleScraper");
function buildAdapters() {
    console.log("[SCRAPE] Using realistic browser automation (visible browser)");
    console.log("[SCRAPE] Active shops: Autodoc (100% success rate)");
    return [
        new realisticBrowserScraper_1.RealisticBrowserScraper("Autodoc", "autodoc")
    ];
}
function buildAdaptersWithVehicleData(vehicleData) {
    const adapters = [
        new realisticBrowserScraper_1.RealisticBrowserScraper("Autodoc", "autodoc")
    ];
    // Add KFZTeile24 if we have vehicle data
    if (vehicleData && vehicleData.make && vehicleData.model) {
        console.log("[SCRAPE] ✅ Vehicle data available, adding KFZTeile24");
        adapters.push(new kfzteile24VehicleScraper_1.KFZTeile24VehicleScraper(vehicleData));
    }
    else {
        console.log("[SCRAPE] ⚠️  No vehicle data, skipping KFZTeile24");
    }
    return adapters;
}
/**
 * Führt Scraping/Preisabfrage für eine bestimmte Order + OEM durch
 * und speichert die Ergebnisse in der DB.
 *
 * WICHTIG: Prüft ZUERST den Händler-Bestand, bevor externe Shops gescraped werden!
 * Nutzt Fahrzeugdaten für KFZTeile24 wenn verfügbar.
 */
async function scrapeOffersForOrder(orderId, oemNumber, vehicleData) {
    console.log("[SCRAPE] start", { orderId, oemNumber, hasVehicleData: !!vehicleData });
    const allOffers = [];
    // STEP 1: Check dealer's own inventory FIRST
    try {
        console.log("[SCRAPE] Checking dealer inventory first...");
        const inventoryOffer = await checkDealerInventory(oemNumber);
        if (inventoryOffer) {
            console.log("[SCRAPE] ✅ Found in dealer inventory!", { oemNumber, price: inventoryOffer.price });
            allOffers.push(inventoryOffer);
            // If found in stock, save immediately and return (no need to scrape external shops)
            await (0, supabaseService_1.insertShopOffers)(orderId, oemNumber, allOffers);
            console.log("[SCRAPE] done (from inventory)", { orderId, offersSaved: allOffers.length });
            return allOffers;
        }
        else {
            console.log("[SCRAPE] Not in dealer inventory, checking external shops...");
        }
    }
    catch (err) {
        console.warn("[SCRAPE] Inventory check failed, continuing with external shops", { error: err?.message });
    }
    // STEP 2: Build adapters based on available data
    const externalAdapters = buildAdaptersWithVehicleData(vehicleData);
    // STEP 3: Scrape external shops
    for (const adapter of externalAdapters) {
        try {
            console.log("[SCRAPE] calling adapter", { adapter: adapter.name, orderId, oemNumber });
            const offers = await adapter.fetchOffers(oemNumber);
            console.log("[SCRAPE] adapter finished", {
                adapter: adapter.name,
                orderId,
                oemNumber,
                offersCount: offers.length
            });
            allOffers.push(...offers);
        }
        catch (err) {
            console.error("[SCRAPE] error", { adapter: adapter.name, orderId, oemNumber, error: err?.message });
        }
    }
    if (allOffers.length === 0) {
        console.warn("[SCRAPE] no offers found", { orderId, oemNumber });
        return [];
    }
    console.log("[SCRAPE] inserting offers into DB", { orderId, offersCount: allOffers.length });
    await (0, supabaseService_1.insertShopOffers)(orderId, oemNumber, allOffers);
    console.log("[SCRAPE] done", { orderId, offersCount: allOffers.length });
    return allOffers;
}
/**
 * Prüft ob das Teil im Händler-Lager vorhanden ist
 * Returns ein Angebot wenn vorhanden, sonst null
 */
async function checkDealerInventory(oemNumber) {
    // TODO: Hier InvenTree API oder eigene Datenbank abfragen
    // Für jetzt: Mock-Implementierung
    // Beispiel: Wenn OEM-Nummer mit "1K0" beginnt, simuliere dass es auf Lager ist
    if (oemNumber.startsWith("1K0")) {
        return {
            shopName: "Händler-Lager",
            brand: "OEM",
            price: 25.99, // Händler-Preis (günstiger als externe Shops)
            currency: "EUR",
            availability: "Sofort verfügbar",
            deliveryTimeDays: 0, // Sofort abholbar!
            productUrl: null, // Kein externer Link
            imageUrl: "https://via.placeholder.com/400x300/4CAF50/white?text=Bremsscheibe+OEM", // Platzhalter-Bild
            rating: null,
            isRecommended: true
        };
    }
    return null;
}
