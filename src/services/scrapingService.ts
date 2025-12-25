import { insertShopOffers } from "./supabaseService";
import { ApifyClient } from "./apifyClient";

export interface ScrapedOffer {
  shopName: string;
  brand?: string | null;
  price: number;
  currency?: string;
  availability?: string | null;
  deliveryTimeDays?: number | null;
  productUrl?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  isRecommended?: boolean | null;
}

export interface ShopAdapter {
  name: string;
  fetchOffers(oem: string): Promise<ScrapedOffer[]>;
}

/**
 * Mock-Adapter für einen Shop (z.B. Autodoc).
 * Später werden hier echte Scraper/API-Calls implementiert.
 */
// Realistic Browser Scraper (headless=false, human-like)
import { RealisticBrowserScraper } from "./scrapers/realisticBrowserScraper";
import { KFZTeile24VehicleScraper } from "./scrapers/kfzteile24VehicleScraper";

function buildAdapters(): ShopAdapter[] {
  console.log("[SCRAPE] Using realistic browser automation (visible browser)");
  console.log("[SCRAPE] Active shops: Autodoc (100% success rate)");

  return [
    new RealisticBrowserScraper("Autodoc", "autodoc")
  ];
}

function buildAdaptersWithVehicleData(vehicleData?: {
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
}): ShopAdapter[] {
  const adapters: ShopAdapter[] = [
    new RealisticBrowserScraper("Autodoc", "autodoc")
  ];

  // Add KFZTeile24 if we have vehicle data
  if (vehicleData && vehicleData.make && vehicleData.model) {
    console.log("[SCRAPE] ✅ Vehicle data available, adding KFZTeile24");
    adapters.push(new KFZTeile24VehicleScraper(vehicleData));
  } else {
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
export async function scrapeOffersForOrder(
  orderId: string,
  oemNumber: string,
  vehicleData?: {
    make?: string;
    model?: string;
    year?: number;
    engine?: string;
  }
) {
  console.log("[SCRAPE] start", { orderId, oemNumber, hasVehicleData: !!vehicleData });
  const allOffers: ScrapedOffer[] = [];

  // STEP 1: Check dealer's own inventory FIRST
  try {
    console.log("[SCRAPE] Checking dealer inventory first...");
    const inventoryOffer = await checkDealerInventory(oemNumber);
    if (inventoryOffer) {
      console.log("[SCRAPE] ✅ Found in dealer inventory!", { oemNumber, price: inventoryOffer.price });
      allOffers.push(inventoryOffer);

      // If found in stock, save immediately and return (no need to scrape external shops)
      const inserted = await insertShopOffers(orderId, oemNumber, allOffers);
      console.log("[SCRAPE] done (from inventory)", { orderId, offersSaved: inserted.length });
      return inserted;
    } else {
      console.log("[SCRAPE] Not in dealer inventory, checking external shops...");
    }
  } catch (err) {
    console.warn("[SCRAPE] Inventory check failed, continuing with external shops", { error: (err as any)?.message });
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
    } catch (err) {
      console.error("[SCRAPE] error", { adapter: adapter.name, orderId, oemNumber, error: (err as any)?.message });
    }
  }

  if (allOffers.length === 0) {
    console.warn("[SCRAPE] no offers found", { orderId, oemNumber });
    return [];
  }

  console.log("[SCRAPE] inserting offers into DB", { orderId, offersCount: allOffers.length });
  const inserted = await insertShopOffers(orderId, oemNumber, allOffers);
  console.log("[SCRAPE] done", { orderId, offersSaved: inserted.length });
  return inserted;
}

/**
 * Prüft ob das Teil im Händler-Lager vorhanden ist
 * Returns ein Angebot wenn vorhanden, sonst null
 */
async function checkDealerInventory(oemNumber: string): Promise<ScrapedOffer | null> {
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
