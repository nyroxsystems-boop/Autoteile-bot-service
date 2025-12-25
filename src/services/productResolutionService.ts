import type {
  Order as DomainOrder,
  Supplier,
  SupplierScraperInput,
  SupplierScraperProduct,
  ShopOfferInsert,
} from "../types/models";

type ResolutionOrder = Pick<
  DomainOrder,
  "id" | "language"
> & {
  dealer_id: string;
  country: string;
  requested_oem?: string;
  vehicle_vin?: string;
  vehicle_tecdoc_id?: string;
};

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
}

export interface ApifyClient {
  runActorDataset<I, O>(actorId: string, input: I): Promise<O[]>;
}

export type TecDocOperation =
  | "getAllLanguages"
  | "getAllCountries"
  | "listVehicleTypes"
  | "getManufacturers"
  | "getModels"
  | "getVehicleEngineTypes"
  | "getVehicleDetails"
  | "getCategoryV1"
  | "getCategoryV2"
  | "getCategoryV3"
  | "getArticlesList"
  | "getArticleDetailsById"
  | "searchArticlesByNumber"
  | "searchArticlesByNumberAndSupplier";

export interface TecDocActorInput {
  operation: TecDocOperation;
  payload?: Record<string, any>;
}

export class ProductResolutionService {
  constructor(private readonly db: DbClient, private readonly apifyClient: ApifyClient) {}

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
    // TODO: Implement actual order loading from DB or service
    throw new Error(`TODO: implement loadOrder for ${orderId}`);
  }

  protected async resolveOemNumber(order: ResolutionOrder): Promise<string | null> {
    if (order.requested_oem) {
      return order.requested_oem;
    }

    const langId = this.mapLanguageToTecDocLangId(order.language);
    const countryFilterId = this.mapCountryToTecDocCountryFilterId(order.country);

    // TODO: Echte Suchstrategie implementieren (z.B. VIN/HSN/TSN oder weitere Order-Daten)
    const payload = {
      articleSearchNr: order.requested_oem ?? "",
      langId,
      countryFilterId,
    };

    const input: TecDocActorInput = {
      operation: "searchArticlesByNumber",
      payload,
    };

    const dataset = await this.apifyClient.runActorDataset<TecDocActorInput, any>(
      "making-data-meaningful/tecdoc",
      input
    );

    if (!dataset?.length) {
      return null;
    }

    const first = dataset[0] ?? {};
    // TODO: Adjust extraction to the actual TecDoc actor response shape
    const candidate =
      first.oemNumber ??
      first.articleNumber ??
      first.articleNo ??
      first.oem_number ??
      first?.data?.oemNumber ??
      null;

    return candidate ?? null;
  }

  private mapLanguageToTecDocLangId(language: string | null | undefined): number {
    // TODO: Mapping anpassen, wenn echte TecDoc langId-Werte vorliegen
    switch ((language ?? "en").toLowerCase()) {
      case "de":
        return 10; // Beispielwert
      case "en":
      default:
        return 4; // Beispielwert
    }
  }

  private mapCountryToTecDocCountryFilterId(country: string | null | undefined): number {
    // TODO: Mapping anpassen, wenn echte TecDoc countryFilterId-Werte vorliegen
    switch ((country ?? "DE").toUpperCase()) {
      case "DE":
        return 62; // Beispielwert für Deutschland
      default:
        return 62; // Fallback
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
