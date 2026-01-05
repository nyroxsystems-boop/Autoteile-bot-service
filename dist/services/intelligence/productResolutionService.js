"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductResolutionService = void 0;
exports.refreshOffersForOrder = refreshOffersForOrder;
const oemWebFinder_1 = require("./oemWebFinder");
// TecDoc types removed as we switched to scraping reference
class ProductResolutionService {
    db;
    apifyClient;
    constructor(db, apifyClient) {
        this.db = db;
        this.apifyClient = apifyClient;
    }
    async resolveProductsForOrder(orderId) {
        const order = await this.loadOrder(orderId);
        const oem = await this.resolveOemNumber(order);
        if (!oem) {
            throw new Error(`Unable to resolve OEM number for order ${orderId}`);
        }
        const suppliers = await this.loadActiveSuppliersForDealer(order.dealer_id);
        if (!suppliers.length) {
            return;
        }
        await Promise.all(suppliers.map(async (supplier) => {
            const products = await this.callSupplierScraper(supplier, order, oem);
            if (products.length > 0) {
                await this.saveOffers(order, supplier, products);
            }
        }));
    }
    async loadOrder(orderId) {
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
        const { rows } = await this.db.query(sql, [orderId]);
        const row = rows[0];
        if (!row)
            throw new Error(`Order ${orderId} not found`);
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
    async resolveOemNumber(order) {
        if (order.requested_oem) {
            return order.requested_oem;
        }
        // Use the new Scraper-based Finder
        const ctx = {
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
        const result = await (0, oemWebFinder_1.findBestOemForVehicle)(ctx, true);
        if (result.bestOem) {
            console.log(`[ProductResolution] Found OEM: ${result.bestOem} (Score: ${result.histogram[result.bestOem]})`);
            return result.bestOem;
        }
        console.warn(`[ProductResolution] No OEM found for Order ${order.id}`);
        return null;
    }
    // TecDoc Mappers removed or kept for generic fallback if needed
    mapLanguageToTecDocLangId(language) {
        return 1; // dummy path
    }
    mapCountryToTecDocCountryFilterId(country) {
        return 1; // dummy path
    }
    async loadActiveSuppliersForDealer(dealerId) {
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
        const { rows } = await this.db.query(sql, [dealerId]);
        return rows ?? [];
    }
    buildScraperInput(order, supplier, oem) {
        return {
            oem,
            country: order.country,
            language: order.language ?? "de",
            maxResults: 20,
            variant: supplier.actor_variant ?? undefined,
            config: supplier.actor_config ?? undefined,
        };
    }
    async callSupplierScraper(supplier, order, oem) {
        const input = this.buildScraperInput(order, supplier, oem);
        try {
            return ((await this.apifyClient.runActorDataset(supplier.apify_actor_id, input)) ?? []);
        }
        catch (error) {
            // Continue with other suppliers while surfacing the failure
            // TODO: replace console.error with structured logging
            console.error(`Failed to process supplier ${supplier.name} (${supplier.id}) for order ${order.id}`, error);
            return [];
        }
    }
    async saveOffers(order, supplier, products) {
        for (const product of products) {
            const offer = {
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
            await this.db.query(`
          INSERT INTO shop_offers
            (order_id, supplier_id, product_name, brand, base_price, margin_percent, oem_number, image_url, url, tier, status)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
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
            ]);
        }
    }
}
exports.ProductResolutionService = ProductResolutionService;
// TODO: Wire real dependencies and return actual offers; placeholder to satisfy internal routes.
async function refreshOffersForOrder(orderId) {
    console.warn("[ProductResolutionService] refreshOffersForOrder is not implemented", { orderId });
    return { offers: [] };
}
