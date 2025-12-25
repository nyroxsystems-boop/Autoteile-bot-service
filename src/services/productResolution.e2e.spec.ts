// @ts-nocheck
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  ApifyClient,
  DbClient,
  ProductResolutionService,
  ShopOfferInsert,
  Supplier,
  SupplierScraperProduct,
  TecDocActorInput,
} from "./productResolutionService";

/**
 * Sketch for an end-to-end style test covering:
 * OEM lookup via TecDoc actor -> supplier scraper -> shop_offers insert.
 *
 * NOTE: This is a blueprint; replace mocks with your real test DB/apify setups.
 */

describe("ProductResolutionService (E2E sketch)", () => {
  let shopOffers: ShopOfferInsert[];
  let db: DbClient;
  let apifyClient: ApifyClient;

  const dealerId = "dealer-1";
  const supplier: Supplier = {
    id: "supplier-1",
    name: "Autodoc",
    country: "DE",
    apify_actor_id: "supplier-actor-1",
    supports_oem_search: true,
    enabled_global: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const order: any = {
    id: "order-123",
    dealer_id: dealerId,
    vehicle_vin: "WVWZZZ1JZXW000001",
    country: "DE",
    language: "de",
  };

  class TestProductResolutionService extends ProductResolutionService {
    constructor(
      dbClient: DbClient,
      apify: ApifyClient,
      private readonly loadedOrder: any
    ) {
      super(dbClient, apify);
    }

    protected async loadOrder(orderId: string): Promise<Order> {
      if (orderId !== this.loadedOrder.id) {
        throw new Error(`Order not found in test for id ${orderId}`);
      }
      return this.loadedOrder;
    }
  }

  beforeEach(() => {
    shopOffers = [];

    db = {
      query: jest.fn(async (sql: string, params: any[] = []) => {
        if (/FROM dealer_suppliers/i.test(sql)) {
          return {
            rows: [
              {
                ...supplier,
                // Simulate joined columns from suppliers table
              },
            ],
          };
        }

        if (/INSERT INTO shop_offers/i.test(sql)) {
          const [
            order_id,
            supplier_id,
            product_name,
            brand,
            base_price,
            margin_percent,
            oem_number,
            image_url,
            url,
            tier,
            status,
          ] = params;

          shopOffers.push({
            order_id,
            supplier_id,
            product_name,
            brand: brand ?? undefined,
            base_price: base_price ?? undefined,
            margin_percent: margin_percent ?? null,
            oem_number: oem_number ?? undefined,
            image_url: image_url ?? undefined,
            url,
            tier: tier ?? undefined,
            status: status ?? "new",
          });

          return { rows: [] };
        }

        return { rows: [] };
      }),
    };

    apifyClient = {
      runActorDataset: jest.fn(async (actorId: string, input: any) => {
        if (actorId === "making-data-meaningful/tecdoc") {
          const tecdocInput = input as TecDocActorInput;
          expect(tecdocInput.operation).toBe("searchArticlesByNumber");
          return [{ oemNumber: "OEM-12345" }];
        }

        // Supplier scraper response
        const products: SupplierScraperProduct[] = [
          {
            product_name: "ATE Bremsbeläge Vorderachse",
            brand: "ATE",
            base_price: 54.99,
            oem_number: "OEM-12345",
            image_url: "https://example.com/img1",
            url: "https://example.com/p/1",
            tier: "medium",
          },
          {
            product_name: "Bosch Bremsbeläge",
            brand: "Bosch",
            base_price: 62.5,
            oem_number: "OEM-12345",
            image_url: "https://example.com/img2",
            url: "https://example.com/p/2",
            tier: "high",
          },
        ];

        return products;
      }),
    };
  });

  it("resolves OEM via TecDoc actor and stores supplier offers", async () => {
    const service = new TestProductResolutionService(db, apifyClient, order);

    await service.resolveProductsForOrder(order.id);

    // TecDoc actor invoked once, plus once per supplier
    expect(apifyClient.runActorDataset).toHaveBeenCalledWith(
      "making-data-meaningful/tecdoc",
      expect.objectContaining({
        operation: "searchArticlesByNumber",
      })
    );
    expect(apifyClient.runActorDataset).toHaveBeenCalledWith(
      supplier.apify_actor_id,
      expect.objectContaining({
        oem: "OEM-12345",
        country: order.country,
        language: order.language,
      })
    );

    // shop_offers inserts executed for each product
    expect(shopOffers).toHaveLength(2);
    expect(shopOffers[0]).toMatchObject({
      order_id: order.id,
      supplier_id: supplier.id,
      status: "new",
    });
    expect(shopOffers[1].product_name).toContain("Bosch");

    // DB query assertions (optional)
    expect((db.query as jest.Mock).mock.calls.find(([sql]) => /FROM dealer_suppliers/i.test(sql))).toBeTruthy();
  });
});
