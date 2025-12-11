import { insertShopOffers } from "./supabaseService";
import { ApifyClient } from "./apifyClient";
import { ProxyAgent } from "proxy-agent";
import fetch from "node-fetch";

export interface ScrapedOffer {
  shopName: string;
  productName?: string | null;
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
    const searchUrl = `https://en.wikipedia.org/wiki/Oil_filter`;

    return [
      {
        shopName: this.name,
        productName: `ATE Ölfilter (${oem})`,
        brand: "ATE",
        price: 89.99,
        currency: "EUR",
        availability: "In stock",
        deliveryTimeDays: 2,
        productUrl: searchUrl,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6b/Oil_filter.jpg",
        description: `ATE Marken-Teil passend zu OEM ${oem}`,
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
        productUrl: searchUrl,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Brake_disc.jpg",
        description: `Budget-Teil passend zu OEM ${oem}`,
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
    const searchUrl = `https://en.wikipedia.org/wiki/Brake_pad`;
    return [
      {
        shopName: this.name,
        productName: `Brembo Bremsbeläge (${oem})`,
        brand: "Brembo",
        price: 94.5,
        currency: "EUR",
        availability: "In stock",
        deliveryTimeDays: 1,
        productUrl: searchUrl,
        imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1c/Disc_brake_pads_with_caliper.jpg",
        description: `Brembo Marken-Teil passend zu OEM ${oem}`,
        rating: 4.6,
        isRecommended: true
      }
    ];
  }
}

// Proxy-Agent wie im OEM-Resolver/WebFinder – nutzt HTTPS_PROXY/HTTP_PROXY/SCRAPE_PROXY_URL
export const scrapeProxyAgent =
  process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.SCRAPE_PROXY_URL
    ? new ProxyAgent({
        getProxyForUrl: () =>
          process.env.HTTPS_PROXY || process.env.HTTP_PROXY || (process.env.SCRAPE_PROXY_URL as string)
      })
    : undefined;

type ProductMetadata = {
  image?: string | null;
  title?: string | null;
  description?: string | null;
};

// Best-effort: versuche, aus einer Produkt-URL Metadaten zu extrahieren (Titel, Bild, Beschreibung)
async function tryExtractProductMetadata(url: string): Promise<ProductMetadata | null> {
  if (!url || !url.startsWith("http")) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // @ts-ignore proxy agent for node-fetch
      agent: scrapeProxyAgent,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AutoteileBot/1.0; +https://autoteile-assistent.local)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de,en;q=0.9"
      }
    });
    if (!res.ok) return null;
    const html = await res.text();

    const pick = (pattern: RegExp): string | null => {
      const m = html.match(pattern);
      if (m?.[1]) return m[1].trim();
      return null;
    };

    // og:image
    const ogImg = pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    const imgFromOg = ogImg && ogImg.startsWith("http") ? ogImg : null;

    // erstes <img src>
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    let imgFromTag: string | null = null;
    if (imgMatch?.[1]) {
      const src = imgMatch[1];
      if (src.startsWith("http")) {
        imgFromTag = src;
      } else {
        try {
          imgFromTag = new URL(src, url).toString(); // resolve relative Pfad
        } catch {
          /* ignore */
        }
      }
    }

    const titleFromOg = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const titleFromMeta = pick(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i);
    const titleFromH1 = pick(/<h1[^>]*>([^<]+)<\/h1>/i);
    const titleFromTag = pick(/<title[^>]*>([^<]+)<\/title>/i);

    const descriptionFromOg = pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const descriptionFromMeta = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);

    return {
      image: imgFromOg ?? imgFromTag ?? null,
      title: titleFromOg ?? titleFromMeta ?? titleFromH1 ?? titleFromTag ?? null,
      description: descriptionFromOg ?? descriptionFromMeta ?? null
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
  return null;
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
              productName: it.productName ?? it.product_name ?? it.title ?? it.name ?? null,
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

  // Basic validation, de-duplication and sorting for cleaner inserts
  const validOffers = allOffers.filter((o) => Number.isFinite(o.price) && o.price > 0 && !!o.shopName);

  const seen = new Set<string>();
  const deduped: ScrapedOffer[] = [];
  for (const offer of validOffers) {
    const key = `${offer.shopName}::${offer.productUrl ?? offer.brand ?? ""}::${offer.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      ...offer,
      currency: offer.currency || "EUR",
      imageUrl: offer.imageUrl ?? null,
      description: offer.description ?? null,
      productName: offer.productName ?? null
    });
  }

  const sortedByPrice = deduped.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

  // Versuche fehlende Metadaten anzureichern (max 5 Requests, um Rate/Time zu schonen)
  let enrichAttempts = 0;
  for (const offer of sortedByPrice) {
    const needsImage = !offer.imageUrl;
    const needsName = !offer.productName;
    const needsDescription = !offer.description;
    if ((!needsImage && !needsName && !needsDescription) || !offer.productUrl) continue;
    if (enrichAttempts >= 5) break;
    const meta = await tryExtractProductMetadata(offer.productUrl);
    enrichAttempts += 1;
    if (meta?.image && !offer.imageUrl) offer.imageUrl = meta.image;
    if (meta?.title && !offer.productName) offer.productName = meta.title;
    if (meta?.description && !offer.description) offer.description = meta.description;
  }

  // Fallback: stelle sicher, dass es einen Produktnamen gibt (für Dashboard und Kundentexte)
  for (const offer of sortedByPrice) {
    if (!offer.productName) {
      const base = [offer.brand, offer.description?.split("\n")[0], offer.shopName].filter(Boolean).join(" - ");
      offer.productName = base || `${offer.shopName} ${oemNumber}`;
    }
  }

  if (sortedByPrice.length === 0) {
    console.warn("[SCRAPE] no offers found", { orderId, oemNumber });
    return [];
  }

  console.log("[SCRAPE] inserting offers into DB", { orderId, offersCount: sortedByPrice.length });
  const inserted = await insertShopOffers(orderId, oemNumber, sortedByPrice);
  console.log("[SCRAPE] done", { orderId, offersSaved: inserted.length });
  return inserted;
}
