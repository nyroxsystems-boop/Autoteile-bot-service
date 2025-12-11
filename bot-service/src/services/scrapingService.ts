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
  description?: string | null;
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
class MockAutodocAdapter implements ShopAdapter {
  name = "Autodoc";

  async fetchOffers(oem: string): Promise<ScrapedOffer[]> {
    // MOCK-Daten – später durch echten Scraper ersetzt
    return [
      {
        shopName: this.name,
        brand: "ATE",
        price: 89.99,
        currency: "EUR",
        availability: "In stock",
        deliveryTimeDays: 2,
        productUrl: `https://autodoc.example.com/parts/${encodeURIComponent(oem)}`,
        imageUrl: null,
        description: "Marken-Ölfilter ATE passend zu OEM " + oem,
        rating: 4.7,
        isRecommended: true
      },
      {
        shopName: this.name,
        brand: "NoName",
        price: 59.99,
        currency: "EUR",
        availability: "In stock",
        deliveryTimeDays: 4,
        productUrl: `https://autodoc.example.com/parts/${encodeURIComponent(oem)}?cheap=1`,
        imageUrl: null,
        description: "Budget-Ölfilter passend zu OEM " + oem,
        rating: 3.8,
        isRecommended: false
      }
    ];
  }
}

/**
 * Noch ein Mock-Adapter, z.B. für "KFZTeile24".
 */
class MockKfzteileAdapter implements ShopAdapter {
  name = "KFZTeile24";

  async fetchOffers(oem: string): Promise<ScrapedOffer[]> {
    return [
      {
        shopName: this.name,
        brand: "Brembo",
        price: 94.5,
        currency: "EUR",
        availability: "In stock",
        deliveryTimeDays: 1,
        productUrl: `https://kfzteile24.example.com/search?q=${encodeURIComponent(oem)}`,
        imageUrl: null,
        description: "Brembo-Ölfilter passend zu OEM " + oem,
        rating: 4.6,
        isRecommended: true
      }
    ];
  }
}

// If APIFY_SHOP_ACTORS is set (JSON array of { shopName, actorId }), we create Apify adapters
function buildAdapters(): ShopAdapter[] {
  const configured = process.env.APIFY_SHOP_ACTORS;
  if (configured) {
    try {
      const list = JSON.parse(configured) as Array<{ shopName: string; actorId: string }>;
      const token = process.env.APIFY_TOKEN || "";
      if (!token) {
        console.warn("APIFY_TOKEN not set; falling back to mock adapters");
        return [new MockAutodocAdapter(), new MockKfzteileAdapter()];
      }
      const client = new ApifyClient({ token });

      class ApifyShopAdapter implements ShopAdapter {
        name: string;
        actorId: string;

        constructor(name: string, actorId: string) {
          this.name = name;
          this.actorId = actorId;
        }

        async fetchOffers(oem: string) {
          try {
            const items = await client.runActorDataset<any, any>(this.actorId, { oem });
            // Expect actor to return array of items compatible with ScrapedOffer
            return (items || []).map((it: any) => ({
              shopName: this.name,
              brand: it.brand ?? it.manufacturer ?? null,
              price: Number(it.price ?? 0),
              currency: it.currency ?? "EUR",
              availability: it.availability ?? null,
              deliveryTimeDays: it.deliveryTimeDays ?? it.delivery_time_days ?? null,
              productUrl: it.productUrl ?? it.product_url ?? null,
              imageUrl: it.imageUrl ?? it.image_url ?? null,
              description: it.description ?? it.productDescription ?? it.product_description ?? null,
              rating: it.rating ?? null,
              isRecommended: it.isRecommended ?? it.is_recommended ?? null
            }));
          } catch (err) {
            console.error("[SCRAPE][ApifyAdapter] actor run failed", { actorId: this.actorId, error: (err as any)?.message });
            return [];
          }
        }
      }

      const adapters: ShopAdapter[] = list.map((l) => new ApifyShopAdapter(l.shopName, l.actorId));
      return adapters.length > 0 ? adapters : [new MockAutodocAdapter(), new MockKfzteileAdapter()];
    } catch (err) {
      console.warn("APIFY_SHOP_ACTORS parse failed, falling back to mock adapters", { error: (err as any)?.message });
      return [new MockAutodocAdapter(), new MockKfzteileAdapter()];
    }
  }

  return [new MockAutodocAdapter(), new MockKfzteileAdapter()];
}

const adapters: ShopAdapter[] = buildAdapters();

/**
 * Führt Scraping/Preisabfrage für eine bestimmte Order + OEM durch
 * und speichert die Ergebnisse in der DB.
 */
export async function scrapeOffersForOrder(orderId: string, oemNumber: string) {
  console.log("[SCRAPE] start", { orderId, oemNumber });
  const allOffers: ScrapedOffer[] = [];

  for (const adapter of adapters) {
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
