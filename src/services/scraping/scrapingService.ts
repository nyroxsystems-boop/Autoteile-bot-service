import { insertShopOffers } from "../adapters/supabaseService";
import { ApifyClient } from "../communication/apifyClient";

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
import { ScraperAPIScraper } from "./scrapers/scraperApiScraper";

function buildAdapters(): ShopAdapter[] {
  console.log("[SCRAPE] Using ScraperAPI (Safe for Render)");

  return [
    new ScraperAPIScraper("Autodoc", "autodoc")
  ];
}

function buildAdaptersWithVehicleData(vehicleData?: {
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
}): ShopAdapter[] {
  console.log("[SCRAPE] Using ScraperAPI (Safe for Render)");

  const adapters: ShopAdapter[] = [
    new ScraperAPIScraper("Autodoc", "autodoc")
  ];

  // Add KFZTeile24 if we have vehicle data or just as a general source
  adapters.push(new ScraperAPIScraper("KFZTeile24", "kfzteile24"));

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
      await insertShopOffers(orderId, oemNumber, allOffers);
      console.log("[SCRAPE] done (from inventory)", { orderId, offersSaved: allOffers.length });
      return allOffers;
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
  await insertShopOffers(orderId, oemNumber, allOffers);
  console.log("[SCRAPE] done", { orderId, offersCount: allOffers.length });
  return allOffers;
}

/**
 * 🎯 PREMIUM WAWI-INTEGRATION
 * 
 * Prüft ob das Teil im echten Händler-Lager (InvenTree) vorhanden ist.
 * Returns ein Angebot wenn vorhanden, sonst null.
 * 
 * Nutzt die realInvenTreeAdapter APIs für echten Lagerbestandsabgleich.
 */
async function checkDealerInventory(oemNumber: string): Promise<ScrapedOffer | null> {
  // Import dynamisch für bessere Testbarkeit
  const { findPartByOem, getStockItemForPart } = await import("../adapters/realInvenTreeAdapter");
  const { logger } = await import("@utils/logger");

  const tenantId = process.env.MERCHANT_ID || "public";

  try {
    console.log("[WAWI] Checking inventory for OEM:", oemNumber);

    // 1. Suche Teil in InvenTree nach OEM-Nummer
    const part = await findPartByOem(tenantId, oemNumber);

    if (!part) {
      console.log("[WAWI] Part not found in InvenTree:", oemNumber);
      return null;
    }

    console.log("[WAWI] Part found:", { pk: part.pk, name: part.name });

    // 2. Prüfe Lagerbestand für dieses Teil
    const stockItem = await getStockItemForPart(tenantId, part.pk);

    if (!stockItem || stockItem.quantity <= 0) {
      console.log("[WAWI] Part found but out of stock:", { pk: part.pk, quantity: stockItem?.quantity || 0 });
      return null;
    }

    console.log("[WAWI] ✅ Part in stock!", {
      pk: part.pk,
      name: part.name,
      quantity: stockItem.quantity
    });

    // 3. Berechne Verkaufspreis (aus InvenTree Pricing oder Fallback)
    const sellingPrice = part.pricing?.selling_price
      || part.pricing?.bom_cost
      || part.pricing?.override_min
      || 0;

    // Fallback: Wenn kein Preis definiert, kann nicht verkauft werden
    if (sellingPrice <= 0) {
      console.warn("[WAWI] Part has no selling price defined:", part.pk);
      return null;
    }

    // 4. Erstelle Premium-Angebot aus Lagerbestand
    return {
      shopName: "✨ Eigenes Lager",
      brand: part.manufacturer_part || part.IPN || "OEM Original",
      price: sellingPrice,
      currency: "EUR",
      availability: `${stockItem.quantity}x auf Lager`,
      deliveryTimeDays: 0, // Sofort abholbar!
      productUrl: null,
      imageUrl: part.image || null,
      rating: null,
      isRecommended: true // Eigenes Lager IMMER priorisiert
    };

  } catch (err: any) {
    // Bei Fehler: Log + graceful degradation zu externen Shops
    console.error("[WAWI] Inventory check failed:", err.message);
    logger?.warn?.("WAWI inventory check failed, falling back to external", {
      oem: oemNumber,
      error: err.message
    });
    return null;
  }
}

/**
 * Exportierte Funktion für externe Stock-Checks (z.B. vom Bot)
 */
export async function checkStockForOem(oemNumber: string): Promise<{
  inStock: boolean;
  quantity: number;
  price: number | null;
  partName: string | null;
}> {
  const offer = await checkDealerInventory(oemNumber);

  if (!offer) {
    return { inStock: false, quantity: 0, price: null, partName: null };
  }

  // Parse quantity from availability string
  const qtyMatch = offer.availability?.match(/(\d+)/);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;

  return {
    inStock: true,
    quantity,
    price: offer.price,
    partName: offer.brand || null
  };
}
