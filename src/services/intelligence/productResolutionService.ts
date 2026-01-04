import type {
  Order as DomainOrder,
  Supplier,
  SupplierScraperInput,
  SupplierScraperProduct,
  ShopOfferInsert,
} from "../../types/models";

type ResolutionOrder = Pick<
  DomainOrder,
  "id" | "language"
> & {
  dealer_id: string;
  country: string;
  requested_oem?: string;
  vehicle_vin?: string;
  vehicle_tecdoc_id?: string;
  // Enhanced fields for scraping
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  part_text?: string;
};

import { findBestOemForVehicle, type SearchContext } from "./oemWebFinder";

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
}

export interface ApifyClient {
  runActorDataset<I, O>(actorId: string, input: I): Promise<O[]>;
}

// TecDoc types removed as we switched to scraping reference

export class ProductResolutionService {
  constructor(private readonly db: DbClient, private readonly apifyClient: ApifyClient) { }

  public async resolveProductsForOrder(orderId: string): Promise<void> {
    const order = await this.loadOrder(orderId);
    const oem = await this.resolveOemNumber(order);

    if (!oem) {
      throw new Error(`Unable to resolve OEM number for order ${orderId}`);
    }

    const suppliers = await this.loadActiveSuppliersForDealer(order.dealer_id);
    if (!suppliers.length) {
      return;
    }

    await Promise.all(
      suppliers.map(async (supplier) => {
        const products = await this.callSupplierScraper(supplier, order, oem);
        if (products.length > 0) {
          await this.saveOffers(order, supplier, products);
        }
      })
    );
  }

  protected async loadOrder(orderId: string): Promise<ResolutionOrder> {
    const sql = `
      SELECT
        o.id,
        o.language,
        o.dealer_id,
        o.country,
        o.oem_number as requested_oem,
        v.vin as vehicle_vin,
        v.make as vehicle_brand,
        v.model as vehicle_model,
        v.year as vehicle_year,
        od.part_description as part_text
      FROM orders o
      LEFT JOIN vehicles v ON v.order_id = o.id
      LEFT JOIN order_data od ON od.order_id = o.id
      WHERE o.id = $1
    `;
    const { rows } = await this.db.query<any>(sql, [orderId]);
    const row = rows[0];
    if (!row) throw new Error(`Order ${orderId} not found`);

    return {
      id: row.id,
      language: row.language,
      dealer_id: row.dealer_id,
      country: row.country ?? 'DE',
      requested_oem: row.requested_oem,
      vehicle_vin: row.vehicle_vin,
      vehicle_brand: row.vehicle_brand,
      vehicle_model: row.vehicle_model,
      vehicle_year: row.vehicle_year,
      part_text: row.part_text
    };
  }

  protected async resolveOemNumber(order: ResolutionOrder): Promise<string | null> {
    if (order.requested_oem) {
      return order.requested_oem;
    }

    // Use the new Scraper-based Finder
    const ctx: SearchContext = {
      vehicle: {
        vin: order.vehicle_vin || undefined,
        brand: order.vehicle_brand || undefined,
        model: order.vehicle_model || undefined,
        year: order.vehicle_year || undefined,
      },
      userQuery: order.part_text || "Ersatzteil"
    };

    console.log(`[ProductResolution] Resolving OEM via Scraping for Order ${order.id}...`, ctx);

    // We try to find the best OEM using our multi-source scraper
    const result = await findBestOemForVehicle(ctx, true);

    if (result.bestOem) {
      console.log(`[ProductResolution] Found OEM: ${result.bestOem} (Score: ${result.histogram[result.bestOem]})`);
      return result.bestOem;
    }

    console.warn(`[ProductResolution] No OEM found for Order ${order.id}`);
    return null;
  }

  // TecDoc Mappers removed or kept for generic fallback if needed
  private mapLanguageToTecDocLangId(language: string | null | undefined): number {
    return 1; // dummy path
  }
  private mapCountryToTecDocCountryFilterId(country: string | null | undefined): number {
    return 1; // dummy path
  }

  protected async loadActiveSuppliersForDealer(dealerId: string): Promise<Supplier[]> {
    const sql = `
      SELECT
        s.id,
        s.name,
        s.country,
        s.apify_actor_id,
        s.actor_variant,
        s.actor_config,
        s.supports_oem_search,
        s.enabled_global,
        s.created_at,
        s.updated_at
      FROM dealer_suppliers ds
      JOIN suppliers s ON s.id = ds.supplier_id
      WHERE ds.dealer_id = $1
        AND ds.enabled = true
        AND s.enabled_global = true
      ORDER BY ds.priority ASC
    `;

    const { rows } = await this.db.query<Supplier>(sql, [dealerId]);
    return rows ?? [];
  }

  private buildScraperInput(
    order: ResolutionOrder,
    supplier: Supplier,
    oem: string
  ): SupplierScraperInput {
    return {
      oem,
      country: order.country,
      language: order.language ?? "de",
      maxResults: 20,
      variant: supplier.actor_variant ?? undefined,
      config: supplier.actor_config ?? undefined,
    };
  }

  protected async callSupplierScraper(
    supplier: Supplier,
    order: ResolutionOrder,
    oem: string
  ): Promise<SupplierScraperProduct[]> {
    const input = this.buildScraperInput(order, supplier, oem);

    try {
      return (
        (await this.apifyClient.runActorDataset<SupplierScraperInput, SupplierScraperProduct>(
          supplier.apify_actor_id,
          input
        )) ?? []
      );
    } catch (error) {
      // Continue with other suppliers while surfacing the failure
      // TODO: replace console.error with structured logging
      console.error(
        `Failed to process supplier ${supplier.name} (${supplier.id}) for order ${order.id}`,
        error
      );
      return [];
    }
  }

  protected async saveOffers(
    order: ResolutionOrder,
    supplier: Supplier,
    products: SupplierScraperProduct[]
  ): Promise<void> {
    for (const product of products) {
      const offer: ShopOfferInsert = {
        order_id: order.id,
        supplier_id: supplier.id,
        product_name: product.product_name,
        brand: product.brand,
        base_price: product.base_price,
        margin_percent: undefined, // TODO: replace with real margin calculation
        oem_number: product.oem_number,
        image_url: product.image_url,
        url: product.url,
        tier: product.tier,
        status: "new",
      };

      await this.db.query(
        `
          INSERT INTO shop_offers
            (order_id, supplier_id, product_name, brand, base_price, margin_percent, oem_number, image_url, url, tier, status)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          offer.order_id,
          offer.supplier_id,
          offer.product_name,
          offer.brand ?? null,
          offer.base_price ?? null,
          offer.margin_percent ?? null,
          offer.oem_number ?? null,
          offer.image_url ?? null,
          offer.url,
          offer.tier ?? null,
          offer.status ?? "new",
        ]
      );
    }
  }
}

// TODO: Wire real dependencies and return actual offers; placeholder to satisfy internal routes.
export async function refreshOffersForOrder(orderId: string): Promise<{ offers: any[] }> {
  console.warn("[ProductResolutionService] refreshOffersForOrder is not implemented", { orderId });
  return { offers: [] };
}
