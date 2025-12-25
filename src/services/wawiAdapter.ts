import type { Order as LegacyOrder, Message, ShopOffer, Vehicle } from "../types/models";

export type ConversationStatus =
  | "choose_language"
  | "collect_vehicle"
  | "confirm_vehicle"
  | "collect_part"
  | "oem_lookup"
  | "show_offers"
  | "await_offer_choice"
  | "await_offer_confirmation"
  | "collect_delivery_preference"
  | "collect_address"
  | "await_pickup_confirmation"
  | "done";

const ACTIVE_CONVERSATION_STATUSES: ConversationStatus[] = [
  "choose_language",
  "collect_vehicle",
  "collect_part",
  "oem_lookup",
  "show_offers",
  "await_offer_choice",
  "await_offer_confirmation"
];

function genId(prefix = "order"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const orders = new Map<string, any>();
const messages = new Map<string, any[]>();
const shopOffers = new Map<string, any[]>();

export async function testDbConnection(): Promise<{ ok: boolean; error?: string }> {
  return { ok: true };
}

export async function insertOrder(partial: any): Promise<any> {
  const id = genId("order");
  const row = { id, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...partial };
  orders.set(id, row);
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customerName: row.customer_name ?? null,
    customerContact: row.customer_contact ?? null,
    vehicleId: row.vehicle_id ?? null,
    requestedPartName: row.requested_part_name ?? null,
    oemNumber: row.oem_number ?? null,
    oemStatus: row.oem_status ?? null,
    oemError: row.oem_error ?? null,
    oemData: row.oem_data ?? null,
    status: row.status ?? "choose_language",
    matchConfidence: row.match_confidence ?? null,
    orderData: row.order_data ?? null,
    language: row.language ?? null
  };
}

export async function getOrderById(id: string): Promise<any | null> {
  const row = orders.get(id) || null;
  if (!row) return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customerName: row.customer_name ?? null,
    customerContact: row.customer_contact ?? null,
    vehicleId: row.vehicle_id ?? null,
    requestedPartName: row.requested_part_name ?? null,
    oemNumber: row.oem_number ?? null,
    status: row.status ?? null,
    matchConfidence: row.match_confidence ?? null,
    orderData: row.order_data ?? null,
    language: row.language ?? null
  };
}

export async function listOrders(limit = 50): Promise<any[]> {
  return Array.from(orders.values()).slice(0, limit);
}

export async function findOrCreateOrder(from: string, orderId?: string | null, opts?: any): Promise<any> {
  if (orderId) {
    const existing = await getOrderById(orderId);
    if (existing) return existing;
  }
  for (const row of orders.values()) {
    if (row.customer_contact === from && (opts?.forceNew !== true)) {
      return await getOrderById(row.id as string);
    }
  }
  return await insertOrder({ customer_contact: from, requested_part_name: "pending", status: "choose_language", order_data: { conversationStatus: "choose_language" } });
}

export async function listActiveOrdersByContact(from: string): Promise<any[]> {
  return Array.from(orders.values()).filter((r) => r.customer_contact === from && r.status !== "done");
}

export async function updateOrder(orderId: string, patch: any): Promise<any> {
  const row = orders.get(orderId) || {};
  const updated = { ...row, ...patch, updated_at: new Date().toISOString() };
  orders.set(orderId, updated);
  return await getOrderById(orderId);
}

export async function insertMessage(partial: any): Promise<any> {
  const msg = { id: genId('msg'), created_at: new Date().toISOString(), ...partial };
  const list = messages.get(partial.orderId ?? 'global') || [];
  list.push(msg);
  messages.set(partial.orderId ?? 'global', list);
  return {
    id: msg.id,
    createdAt: msg.created_at,
    orderId: msg.orderId ?? null,
    direction: msg.direction,
    channel: msg.channel,
    fromIdentifier: msg.from_identifier ?? null,
    toIdentifier: msg.to_identifier ?? null,
    content: msg.content,
    rawPayload: msg.raw_payload ?? null
  };
}

export async function insertShopOffers(orderId: string, oem: string, offers: any[]): Promise<void> {
  const list = shopOffers.get(orderId) || [];
  list.push(...offers.map((o) => ({ ...o, oem, inserted_at: new Date().toISOString() })));
  shopOffers.set(orderId, list);
}

export async function listShopOffersByOrderId(orderId: string): Promise<any[]> {
  return shopOffers.get(orderId) || [];
}

export async function updateOrderData(orderId: string, data: any): Promise<void> {
  const row = orders.get(orderId) || {};
  row.order_data = { ...(row.order_data || {}), ...data };
  orders.set(orderId, row);
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  const row = orders.get(orderId) || {};
  row.status = status;
  orders.set(orderId, row);
}

export async function getVehicleForOrder(orderId: string): Promise<any | null> {
  const row = orders.get(orderId);
  return row?.vehicle ?? null;
}

export async function upsertVehicleForOrderFromPartial(orderId: string, partial: any): Promise<void> {
  const row = orders.get(orderId) || {};
  row.vehicle = { ...(row.vehicle || {}), ...partial };
  orders.set(orderId, row);
}

export async function persistScrapeResult(orderId: string, scrapeResult: any): Promise<void> {
  const row = orders.get(orderId) || {};
  row.scrapeResult = scrapeResult;
  orders.set(orderId, row);
}

export async function updateOrderOEM(orderId: string, payload: any): Promise<void> {
  const row = orders.get(orderId) || {};
  row.oem_number = payload.oem ?? row.oem_number;
  orders.set(orderId, row);
}

export async function getMerchantSettings(merchantId: string): Promise<any> {
  return null;
}

export async function upsertMerchantSettings(merchantId: string, payload: any): Promise<void> {
  return;
}

export function applyMerchantMarginToOffers(offers: any[], marginPercent: number): any[] {
  return offers.map((o) => {
    const supplierPrice = Number(o.price ?? 0);
    const finalPrice = Math.round((supplierPrice * (1 + (marginPercent ?? 0) / 100)) * 100) / 100;
    return {
      ...o,
      supplierPrice,
      priceInclMargin: finalPrice,
      currency: o.currency ?? "EUR"
    };
  });
}

export async function createInquiryAndInsertOffers(orderId: string, merchantId: string | null, oemNumber: string, offers: any[]): Promise<boolean> {
  let margin = 0;
  let selectedShops: string[] | null = null;
  if (merchantId) {
    try {
      const ms = await getMerchantSettings(merchantId);
      if (ms) {
        margin = ms.marginPercent ?? 0;
        selectedShops = ms.selectedShops ?? null;
      }
    } catch (err) {
      // ignore
    }
  }

  let filteredOffers = offers;
  if (selectedShops && selectedShops.length > 0) {
    filteredOffers = offers.filter((o) => selectedShops!.includes(o.shopName));
  }

  const annotated = applyMerchantMarginToOffers(filteredOffers, margin);

  const dbOffers = annotated.map((a) => ({
    shopName: a.shopName,
    brand: a.brand ?? null,
    price: a.priceInclMargin,
    currency: a.currency ?? "EUR",
    availability: a.availability ?? null,
    deliveryTimeDays: a.deliveryTimeDays ?? null,
    productUrl: a.productUrl ?? null,
    rating: a.rating ?? null,
    isRecommended: a.isRecommended ?? null
  }));

  try {
    await insertShopOffers(orderId, oemNumber, dbOffers);
  } catch (err) {
    return false;
  }

  try {
    await updateOrder(orderId, { status: "await_offer_confirmation" });
  } catch (err) {
    // ignore
  }

  try {
    const inquiryMeta = {
      lastInquiryAt: new Date().toISOString(),
      lastInquiryOem: oemNumber,
      lastInquiryMerchant: merchantId ?? null,
      lastInquiryOfferCount: dbOffers.length
    } as Record<string, any>;
    await updateOrderData(orderId, { last_inquiry: inquiryMeta });
  } catch (err) {
    // ignore
  }

  return true;
}
