export type OrderStatus =
  | "new" // frisch von WhatsApp angelegt
  | "processing" // OEM/Angebote werden ermittelt
  | "ready" // Angebote verfügbar, wartet auf Entscheidung
  | "ordered" // Teil wurde bestellt
  | "failed"; // Fehler im Prozess

export interface Vehicle {
  id: string;
  createdAt: string;

  make: string; // z.B. BMW
  model: string; // z.B. 316Ti
  year?: number;
  engineCode?: string;
  engineKw?: number;
  fuelType?: string | null;
  emissionClass?: string | null;
  vin?: string | null;
  hsn?: string | null;
  tsn?: string | null;
  rawData?: any;
}

export interface Order {
  id: string;
  createdAt: string;
  updatedAt: string;

  customerName?: string | null;
  customerContact?: string | null; // z.B. WhatsApp-Nummer

  vehicleId?: string | null;
  requestedPartName: string; // z.B. "Bremssattel vorne links"

  oemNumber?: string | null;
  oemStatus?: string | null;
  oemError?: string | null;
  oemData?: any | null;
  status: OrderStatus;

  matchConfidence?: number | null; // 0–1; wie sicher ist das Matching

  orderData?: any | null; // JSON-Feld für zusätzlichen Dialog-/Order-Status

  language?: string | null; // z.B. "de" oder "en"
}

export interface OemPart {
  id: string;
  createdAt: string;

  oemNumber: string;
  brand?: string | null; // z.B. BMW, VAG etc.
  description?: string | null;
  vehicleId?: string | null;
  rawTecDocData?: any; // optional: komplette TecDoc-Antwort
}

export interface ShopOffer {
  id: string;
  createdAt: string;

  orderId: string;
  oemNumber: string;
  shopName: string; // z.B. "Autodoc"
  brand?: string | null; // z.B. ATE, Brembo
  price: number;
  currency: string; // z.B. "EUR"
  availability?: string | null; // z.B. "In stock"
  deliveryTimeDays?: number | null;
  productUrl?: string | null;
  rating?: number | null; // z.B. 4.7
  isRecommended?: boolean | null; // vom System gesetzt
}

export interface Message {
  id: string;
  createdAt: string;

  orderId?: string | null;
  direction: "incoming" | "outgoing";
  channel: "whatsapp";
  fromIdentifier?: string | null; // z.B. Kunden-Nummer
  toIdentifier?: string | null; // z.B. unsere Nummer

  content: string; // Textnachricht
  rawPayload?: any; // originaler WA-Payload (optional)
}

// Supplier/offer domain types
export type Brand<T, B extends string> = T & { readonly __brand: B };
export type Timestamp = string | Date;

export type SupplierId = Brand<string, "SupplierId">;
export type DealerId = Brand<string, "DealerId">;
export type ShopOfferId = Brand<string, "ShopOfferId">;
export type OrderId = Brand<string, "OrderId">;

export type OfferStatus = "new" | "selected" | "hidden" | "expired" | "error";
export type SupplierTier = "low" | "medium" | "high";

export interface Supplier {
  id: SupplierId;
  name: string;
  country: string;
  apify_actor_id: string;
  actor_variant?: string | null;
  actor_config?: Record<string, unknown> | null;
  supports_oem_search: boolean;
  enabled_global: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface DealerSupplier {
  dealer_id: DealerId;
  supplier_id: SupplierId;
  priority: number;
  is_default: boolean;
  enabled: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ShopOfferRecord {
  id: ShopOfferId;
  order_id: OrderId | string;
  supplier_id: SupplierId;
  product_name: string;
  brand?: string;
  base_price?: number;
  margin_percent?: number;
  oem_number?: string;
  image_url?: string;
  url: string;
  tier?: string;
  status: OfferStatus;
  created_at: Timestamp;
}

export interface SupplierScraperInput {
  oem: string;
  country: string;
  language: string;
  maxResults: number;
  variant?: string;
  config?: Record<string, unknown>;
}

export interface SupplierScraperProduct {
  product_name: string;
  brand?: string;
  base_price?: number;
  oem_number?: string;
  image_url?: string;
  url: string;
  tier?: SupplierTier | string;
}

export interface ShopOfferInsert {
  order_id: OrderId | string;
  supplier_id: SupplierId | string;
  product_name: string;
  brand?: string;
  base_price?: number;
  margin_percent?: number;
  oem_number?: string;
  image_url?: string;
  url: string;
  tier?: string;
  status?: OfferStatus;
}
