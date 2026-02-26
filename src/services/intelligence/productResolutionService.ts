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

  // Enhanced fields for scraping
  vehicle_brand?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  part_text?: string;
};

import { resolveOEMForOrder } from "./oemService";

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
}

export interface ApifyClient {
  runActorDataset<I, O>(actorId: string, input: I): Promise<O[]>;
}



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

    // BUG C FIX: Use the modern unified resolver (15 sources, consensus, validation)
    // instead of the legacy findBestOemForVehicle which bypasses all quality layers
    console.log(`[ProductResolution] Resolving OEM via unified resolver for Order ${order.id}...`);

    try {
      const result = await resolveOEMForOrder(
        order.id,
        {
          make: order.vehicle_brand ?? null,
          model: order.vehicle_model ?? null,
          year: order.vehicle_year ?? null,
          engine: null,
          engineKw: null,
          vin: order.vehicle_vin ?? null,
          hsn: null,
          tsn: null,
        },
        order.part_text || "Ersatzteil"
      );

      if (result.primaryOEM) {
        console.log(`[ProductResolution] Found OEM: ${result.primaryOEM} (Confidence: ${result.overallConfidence})`);
        return result.primaryOEM;
      }

      console.warn(`[ProductResolution] No OEM found for Order ${order.id}`);
      return null;
    } catch (err: any) {
      console.error(`[ProductResolution] Unified resolver failed for Order ${order.id}`, err?.message);
      return null;
    }
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
