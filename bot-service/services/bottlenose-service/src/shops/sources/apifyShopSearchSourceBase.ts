import { createApifyClient } from "../../integrations/apify/apifyClient";

export interface VehicleDescriptor {
  vin?: string;
  hsnTsn?: string;
  brand?: string;
  make?: string;
  model?: string;
  year?: number;
  engineCode?: string;
}

export interface ShopSearchInput {
  vehicle?: VehicleDescriptor;
  query: string;
  locale?: string;
  countryCode?: string;
}

export interface ShopProduct {
  id: string;
  shopName: string;
  title: string;
  brand?: string;
  sku?: string;
  price?: number;
  currency?: string;
  oemNumbers: string[];
  url?: string;
  raw?: any;
}

export interface ShopSearchSource {
  name: string;
  search(input: ShopSearchInput): Promise<ShopProduct[]>;
}

type OemExtractor = (product: any) => string[];

function normalizeOem(value: string | undefined | null): string | null {
  if (!value) return null;
  const cleaned = value.toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const stripped = cleaned.replace(/^OE/, "");
  return stripped || null;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function splitPossibleList(val: string): string[] {
  return val
    .split(/[;,|\n\/]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function defaultExtractOems(product: any): string[] {
  const candidates: string[] = [];
  const fields = [
    "oemNumbers",
    "oeNumbers",
    "referenceOem",
    "referenceNumber",
    "referenceNumbers",
    "references",
    "oem",
    "oe",
    "replacementNumbers",
    "crossRefs"
  ];

  fields.forEach((key) => {
    const val = product?.[key];
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach((v) => {
        if (typeof v === "string") candidates.push(...splitPossibleList(v));
        else if (v) candidates.push(String(v));
      });
    } else if (typeof val === "string") {
      candidates.push(...splitPossibleList(val));
    } else {
      candidates.push(String(val));
    }
  });

  // attributes/metadata scanning
  const attrs = product?.attributes;
  if (Array.isArray(attrs)) {
    attrs.forEach((a) => {
      const key = (a?.name || a?.label || a?.key || "").toString().toLowerCase();
      const val = a?.value ?? a?.values;
      if (key.includes("oe") || key.includes("reference")) {
        if (Array.isArray(val)) {
          val.forEach((v) => {
            if (typeof v === "string") candidates.push(...splitPossibleList(v));
          });
        } else if (typeof val === "string") {
          candidates.push(...splitPossibleList(val));
        }
      }
    });
  }

  // meta object: scan keys that look like OE info
  const meta = product?.meta;
  if (meta && typeof meta === "object") {
    Object.entries(meta).forEach(([k, v]) => {
      if (k.toLowerCase().includes("oe") || k.toLowerCase().includes("reference")) {
        if (typeof v === "string") candidates.push(...splitPossibleList(v));
        else if (Array.isArray(v)) {
          v.forEach((item) => {
            if (typeof item === "string") candidates.push(...splitPossibleList(item));
          });
        }
      }
    });
  }

  return unique(
    candidates
      .map((c) => normalizeOem(c))
      .filter((c): c is string => Boolean(c))
  );
}

export class ApifyShopSearchSource implements ShopSearchSource {
  name: string;
  private actorId: string;
  protected extractOemFn: OemExtractor;

  constructor(opts: { actorId: string; shopName: string; extractOems?: OemExtractor }) {
    this.name = opts.shopName;
    this.actorId = opts.actorId;
    this.extractOemFn = opts.extractOems || defaultExtractOems;
  }

  async search(input: ShopSearchInput): Promise<ShopProduct[]> {
    const client = createApifyClient();
    const actorInput = {
      vehicle: input.vehicle,
      searchQuery: input.query,
      locale: input.locale,
      country: input.countryCode
    };

    try {
      const items = (await client.callActor<any, any[]>(this.actorId, actorInput)) || [];
      if (!Array.isArray(items) || items.length === 0) return [];

      return items.map((product, idx) => this.mapProduct(product, idx));
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn(`[${this.name}] shop search failed`, err?.message ?? err);
      return [];
    }
  }

  protected mapProduct(product: any, idx: number): ShopProduct {
    const oemNumbers = this.extractOemFn(product);
    const id =
      product?.id ||
      product?.sku ||
      product?.articleNumber ||
      product?.url ||
      `${this.name}-${idx}`;
    const title = product?.title || product?.name || product?.description || product?.articleNumber || "Unknown product";

    let price: number | undefined;
    if (typeof product?.price === "number") {
      price = product.price;
    } else if (typeof product?.price === "string") {
      const parsed = parseFloat(product.price.replace(/[^\d.,-]/g, "").replace(",", "."));
      if (!Number.isNaN(parsed)) price = parsed;
    }

    return {
      id,
      shopName: this.name,
      title,
      brand: product?.brand,
      sku: product?.sku || product?.articleNumber,
      price,
      currency: product?.currency,
      oemNumbers,
      url: product?.url,
      raw: product
    };
  }
}
