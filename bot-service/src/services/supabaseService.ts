import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import type { Order as LegacyOrder, Message, ShopOffer, Vehicle } from "../types/models";

export type ConversationStatus =
  | "choose_language"
  | "collect_vehicle"
  | "collect_part"
  | "oem_lookup"
  | "show_offers"
  | "await_offer_choice"
  | "await_offer_confirmation"
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

export interface Order {
  id: string;
  from: string;
  status: ConversationStatus;
  language: "de" | "en" | null;
  vehicle_description: string | null;
  part_description: string | null;
  created_at?: string;
  updated_at?: string;
}

let supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        persistSession: false
      }
    });
  }
  return supabase;
}

// Exposes a shared Supabase client instance for other modules (e.g., dashboard routes).
export function getSupabaseClient(): SupabaseClient {
  return getClient();
}

function mapRowToConversationOrder(row: any): Order {
  const orderData = row?.order_data || {};
  const status =
    (orderData.conversationStatus as ConversationStatus) ||
    (row?.status as ConversationStatus) ||
    "choose_language";

  return {
    id: row.id,
    from: row.customer_contact ?? "",
    status,
    language: (row.language as "de" | "en" | null) ?? null,
    vehicle_description: orderData.vehicleDescription ?? row.vehicle_description ?? null,
    part_description: orderData.partDescription ?? row.part_description ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Testet die Verbindung zur Datenbank, indem eine einfache Abfrage
 * auf die Orders-Tabelle ausgeführt wird.
 */
export async function testDbConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = getClient();
    const { error } = await client.from("orders").select("id").limit(1);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Unknown error" };
  }
}

/**
 * Legt eine neue Order in der orders-Tabelle an.
 */
export async function insertOrder(partial: {
  customerName?: string | null;
  customerContact?: string | null;
  requestedPartName: string;
  vehicleId?: string | null;
}): Promise<LegacyOrder> {
  const client = getClient();

  const { data, error } = await client
    .from("orders")
    .insert({
      customer_name: partial.customerName ?? null,
      customer_contact: partial.customerContact ?? null,
      requested_part_name: partial.requestedPartName,
      vehicle_id: partial.vehicleId ?? null,
      status: "new"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to insert order: ${error.message}`);
  }

  const order: LegacyOrder = {
    id: data.id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    customerName: data.customer_name,
    customerContact: data.customer_contact,
    vehicleId: data.vehicle_id,
    requestedPartName: data.requested_part_name,
    oemNumber: data.oem_number,
    oemStatus: data.oem_status,
    oemError: data.oem_error,
    oemData: data.oem_data,
    status: data.status,
    matchConfidence: data.match_confidence,
    orderData: data.order_data,
    language: data.language ?? null
  };

  return order;
}

/**
 * Holt eine Order per ID aus der Datenbank.
 */
export async function getOrderById(id: string): Promise<LegacyOrder | null> {
  const client = getClient();

  const { data, error } = await client
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    // PGRST116 = No rows found (kann je nach Version variieren)
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch order ${id}: ${error.message}`);
  }

  const order: LegacyOrder = {
    id: data.id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    customerName: data.customer_name,
    customerContact: data.customer_contact,
    vehicleId: data.vehicle_id,
    requestedPartName: data.requested_part_name,
    oemNumber: data.oem_number,
    status: data.status,
    matchConfidence: data.match_confidence,
    orderData: data.order_data,
    language: data.language ?? null
  };

  return order;
}

/**
 * Listet die letzten Orders.
 */
export async function listOrders(limit = 50): Promise<LegacyOrder[]> {
  const client = getClient();

  const { data, error } = await client
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list orders: ${error.message}`);
  }

  const mapped: LegacyOrder[] =
    (data ?? []).map((row: any) => ({
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      customerName: row.customer_name,
      customerContact: row.customer_contact,
      vehicleId: row.vehicle_id,
      requestedPartName: row.requested_part_name,
      oemNumber: row.oem_number,
      oemStatus: row.oem_status,
      oemError: row.oem_error,
      oemData: row.oem_data,
      status: row.status,
      matchConfidence: row.match_confidence,
      orderData: row.order_data,
      language: row.language ?? null
    })) ?? [];

  return mapped;
}

/**
 * Finds an existing order or creates a new one for a given sender.
 */
export async function findOrCreateOrder(
  from: string,
  orderId?: string | null,
  opts?: { forceNew?: boolean }
): Promise<Order> {
  const client = getClient();
  const forceNew = opts?.forceNew === true;

  // 1) Wenn orderId angegeben: versuchen, genau diese Order zu laden
  if (orderId) {
    const { data, error } = await client.from("orders").select("*").eq("id", orderId).single();
    if (error && error.code !== "PGRST116") {
      console.error("Failed to fetch order by id", { error: error.message, orderId });
      throw new Error("Failed to find or create order");
    }
    if (data) {
      return mapRowToConversationOrder(data);
    }
  }

  // 2) Offene Order für diesen Absender suchen (nur aktive Status)
  let rows: any[] = [];
  if (!forceNew) {
    const { data: searchRows, error: searchError } = await client
      .from("orders")
      .select("*")
      .eq("customer_contact", from)
      .in("status", ACTIVE_CONVERSATION_STATUSES)
      .order("created_at", { ascending: false })
      .limit(1);

    if (searchError) {
      console.error("Failed to search existing order", { error: searchError.message, from });
      throw new Error("Failed to find or create order");
    }

    rows = searchRows || [];
    if (rows && rows.length > 0) {
      return mapRowToConversationOrder(rows[0]);
    }
  }

  // 3) Keine offene Order gefunden → neue anlegen
  const payload = {
    customer_contact: from,
    requested_part_name: "pending",
    status: "choose_language" as ConversationStatus,
    language: null,
    order_data: {
      conversationStatus: "choose_language",
      vehicleDescription: null,
      partDescription: null
    }
  };

  const { data: created, error: createError } = await client.from("orders").insert(payload).select("*").single();
  if (createError) {
    console.error("Failed to create order", { error: createError.message, from });
    throw new Error("Failed to find or create order");
  }

  return mapRowToConversationOrder(created);
}

/**
 * Listet alle aktiven Orders zu einem Kontakt.
 */
export async function listActiveOrdersByContact(from: string): Promise<Order[]> {
  const client = getClient();
  const { data, error } = await client
    .from("orders")
    .select("*")
    .eq("customer_contact", from)
    .in("status", ACTIVE_CONVERSATION_STATUSES)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list active orders: ${error.message}`);
  }

  return (data || []).map((row: any) => mapRowToConversationOrder(row));
}

/**
 * Updates an order with partial fields (conversation metadata and language).
 */
export async function updateOrder(orderId: string, patch: Partial<Order>): Promise<Order> {
  const client = getClient();

  const { data: existing, error: fetchError } = await client
    .from("orders")
    .select("order_data")
    .eq("id", orderId)
    .single();

  if (fetchError) {
    console.error("Failed to fetch order before update", { error: fetchError.message, orderId });
    throw new Error("Failed to update order");
  }

  const currentData = (existing?.order_data as Record<string, any>) || {};
  const orderDataPatch: Record<string, any> = { ...currentData };
  const updatePayload: Record<string, any> = {};

  if (patch.status !== undefined) {
    orderDataPatch.conversationStatus = patch.status;
    updatePayload.status = patch.status;
  }
  if (patch.language !== undefined) {
    updatePayload.language = patch.language;
  }
  if (patch.vehicle_description !== undefined) {
    orderDataPatch.vehicleDescription = patch.vehicle_description;
  }
  if (patch.part_description !== undefined) {
    orderDataPatch.partDescription = patch.part_description;
  }
  if (patch.from !== undefined) {
    updatePayload.customer_contact = patch.from;
  }

  updatePayload.order_data = orderDataPatch;

  const { data, error } = await client
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to update order", { error: error.message, orderId });
    throw new Error("Failed to update order");
  }

  return mapRowToConversationOrder(data);
}

/**
 * Legt eine neue Message in der messages-Tabelle an.
 */
export async function insertMessage(partial: {
  orderId?: string | null;
  direction: "incoming" | "outgoing";
  channel: "whatsapp";
  fromIdentifier?: string | null;
  toIdentifier?: string | null;
  content: string;
  rawPayload?: any;
}): Promise<Message> {
  const client = getClient();

  const { data, error } = await client
    .from("messages")
    .insert({
      order_id: partial.orderId ?? null,
      direction: partial.direction,
      channel: partial.channel,
      from_identifier: partial.fromIdentifier ?? null,
      to_identifier: partial.toIdentifier ?? null,
      content: partial.content,
      raw_payload: partial.rawPayload ?? null
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to insert message: ${error.message}`);
  }

  const message: Message = {
    id: data.id,
    createdAt: data.created_at,
    orderId: data.order_id,
    direction: data.direction,
    channel: data.channel,
    fromIdentifier: data.from_identifier,
    toIdentifier: data.to_identifier,
    content: data.content,
    rawPayload: data.raw_payload
  };

  return message;
}

/**
 * Listet Nachrichten zu einer bestimmten Order (aufsteigend nach created_at).
 */
export async function listMessagesByOrderId(orderId: string): Promise<Message[]> {
  const client = getClient();

  const { data, error } = await client
    .from("messages")
    .select("*")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to list messages for order ${orderId}: ${error.message}`);
  }

  const messages: Message[] =
    (data ?? []).map((row: any) => ({
      id: row.id,
      createdAt: row.created_at,
      orderId: row.order_id,
      direction: row.direction,
      channel: row.channel,
      fromIdentifier: row.from_identifier,
      toIdentifier: row.to_identifier,
      content: row.content,
      rawPayload: row.raw_payload
    })) ?? [];

  return messages;
}

/**
 * Fügt mehrere Shop-Angebote in die Tabelle shop_offers ein.
 */
export async function insertShopOffers(
  orderId: string,
  oemNumber: string,
  offers: Array<{
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
  }>
): Promise<ShopOffer[]> {
  const client = getClient();

  const buildPayload = (includeImages: boolean) =>
    offers.map((o) => {
      const base: Record<string, any> = {
        order_id: orderId,
        oem_number: oemNumber,
        shop_name: o.shopName,
        brand: o.brand ?? null,
        price: o.price,
        currency: o.currency ?? "EUR",
        availability: o.availability ?? null,
        delivery_time_days: o.deliveryTimeDays ?? null,
        product_url: o.productUrl ?? null,
        url: o.productUrl ?? null, // Compatibility: some DBs may use "url" instead of "product_url"
        product_description: o.description ?? null,
        description: o.description ?? null,
        rating: o.rating ?? null,
        is_recommended: o.isRecommended ?? null
      };
      if (includeImages && o.imageUrl !== undefined) {
        base.image_url = o.imageUrl;
      }
      return base;
    });

  const wantsImages = offers.some((o) => o.imageUrl !== undefined);
  let data: any[] | null = null;
  let error: any = null;

  if (wantsImages) {
    const resp = await client.from("shop_offers").insert(buildPayload(true)).select("*");
    data = resp.data;
    error = resp.error;

    if (error && `${error.message}`.toLowerCase().includes("image")) {
      console.warn("shop_offers insert with image_url failed, retrying without image_url", { error: error.message });
      const respNoImg = await client.from("shop_offers").insert(buildPayload(false)).select("*");
      data = respNoImg.data;
      error = respNoImg.error;
    }
    if (error && `${error.message}`.toLowerCase().includes("description")) {
      console.warn("shop_offers insert with description failed, retrying without description", { error: error.message });
      const respNoDesc = await client
        .from("shop_offers")
        .insert(
          buildPayload(false).map((p) => {
            const { product_description, description, ...rest } = p;
            return rest;
          })
        )
        .select("*");
      data = respNoDesc.data;
      error = respNoDesc.error;
    }
  } else {
    const resp = await client.from("shop_offers").insert(buildPayload(false)).select("*");
    data = resp.data;
    error = resp.error;
  }

  if (error) {
    throw new Error(`Failed to insert shop offers: ${error.message}`);
  }

  const mapped: ShopOffer[] =
    (data ?? []).map((row: any, idx: number) => {
      const original = offers[idx];
      return {
        id: row.id,
        createdAt: row.created_at,
        orderId: row.order_id,
        oemNumber: row.oem_number,
        shopName: row.shop_name,
        brand: row.brand,
        price: Number(row.price),
        currency: row.currency,
        availability: row.availability,
        deliveryTimeDays: row.delivery_time_days,
        productUrl: row.product_url ?? row.url ?? null,
        imageUrl: row.image_url ?? row.imageUrl ?? original?.imageUrl ?? null,
        description: row.product_description ?? row.description ?? original?.description ?? null,
        rating: row.rating != null ? Number(row.rating) : null,
        isRecommended: row.is_recommended
      };
    }) ?? [];

  return mapped;
}

/**
 * Listet alle Shop-Angebote zu einer Order.
 */
export async function listShopOffersByOrderId(orderId: string): Promise<ShopOffer[]> {
  const client = getClient();

  const { data, error } = await client
    .from("shop_offers")
    .select("*")
    .eq("order_id", orderId)
    .order("price", { ascending: true });

  if (error) {
    throw new Error(`Failed to list shop offers: ${error.message}`);
  }

  const mapped: ShopOffer[] =
    (data ?? []).map((row: any) => ({
      id: row.id,
      createdAt: row.created_at,
      orderId: row.order_id,
      oemNumber: row.oem_number,
      shopName: row.shop_name,
      brand: row.brand,
      price: Number(row.price),
      currency: row.currency,
      availability: row.availability,
      deliveryTimeDays: row.delivery_time_days,
      productUrl: row.product_url ?? row.url ?? null,
      imageUrl: row.image_url ?? row.imageUrl ?? null,
      description: row.product_description ?? row.description ?? null,
      rating: row.rating != null ? Number(row.rating) : null,
      isRecommended: row.is_recommended
    })) ?? [];

  return mapped;
}

/**
 * Holt ein Vehicle per ID.
 */
export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const client = getClient();

  const { data, error } = await client
    .from("vehicles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to fetch vehicle ${id}: ${error.message}`);
  }

  const v: Vehicle = {
    id: data.id,
    createdAt: data.created_at,
    make: data.make,
    model: data.model,
    year: data.year ?? undefined,
    engineCode: data.engine_code ?? undefined,
    vin: data.vin,
    hsn: data.hsn,
    tsn: data.tsn,
    rawData: data.raw_data
  };

  return v;
}

/**
 * Holt das Vehicle zu einer Order (falls vehicle_id gesetzt ist).
 */
export async function getVehicleForOrder(orderId: string): Promise<Vehicle | null> {
  const client = getClient();

  const { data, error } = await client
    .from("vehicles")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Failed to fetch vehicle for order", { orderId, error: error.message });
    throw new Error(`Failed to fetch vehicle for order ${orderId}: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const v: Vehicle = {
    id: data.id,
    createdAt: data.created_at,
    make: data.make,
    model: data.model,
    year: data.year ?? undefined,
    engineCode: data.engine_code ?? undefined,
    vin: data.vin,
    hsn: data.hsn,
    tsn: data.tsn,
    rawData: data.raw_data
  };

  return v;
}

/**
 * Setzt vehicle_id für eine Order.
 */
async function setOrderVehicleId(orderId: string, vehicleId: string): Promise<void> {
  const client = getClient();

  const { error } = await client
    .from("orders")
    .update({ vehicle_id: vehicleId })
    .eq("id", orderId);

  if (error) {
    throw new Error(`Failed to set vehicle_id on order: ${error.message}`);
  }
}

/**
 * Vereinigt vorhandene Vehicle-Daten mit neuen Daten.
 * Überschreibt nur Felder, die bisher null/undefined waren oder explizit neu geliefert werden.
 */
function mergeVehicleData(existing: any, incoming: {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  engineCode?: string | null;
  vin?: string | null;
  hsn?: string | null;
  tsn?: string | null;
}) {
  return {
    make: incoming.make ?? existing.make ?? null,
    model: incoming.model ?? existing.model ?? null,
    year: incoming.year ?? existing.year ?? null,
    engine_code: incoming.engineCode ?? existing.engine_code ?? null,
    vin: incoming.vin ?? existing.vin ?? null,
    hsn: incoming.hsn ?? existing.hsn ?? null,
    tsn: incoming.tsn ?? existing.tsn ?? null
  };
}

/**
 * Upsert Vehicle-Daten für eine Order, basierend auf (z.B.) parseUserMessage-Ergebnissen.
 *
 * - Wenn Order kein vehicle_id hat → neues Vehicle anlegen, ID auf Order speichern.
 * - Wenn bereits ein Vehicle existiert → Felder zusammenführen und updaten.
 */
export async function upsertVehicleForOrderFromPartial(
  orderId: string,
  partial: {
    make?: string | null;
    model?: string | null;
    year?: number | null;
    engineCode?: string | null;
    engineKw?: number | null;
    fuelType?: string | null;
    emissionClass?: string | null;
    vin?: string | null;
    hsn?: string | null;
    tsn?: string | null;
  }
): Promise<Vehicle> {
  const client = getClient();

  // fetch existing vehicle (if any) to avoid overwriting with null/undefined
  let existing: any = {};
  try {
    const { data: existingVehicle } = await client
      .from("vehicles")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();
    if (existingVehicle) existing = existingVehicle;
  } catch {
    // ignore fetch errors, proceed with partial only
  }

  const payload: any = { order_id: orderId };
  const fields: Array<[keyof typeof partial, string]> = [
    ["make", "make"],
    ["model", "model"],
    ["year", "year"],
    ["engineCode", "engine_code"],
    ["engineKw", "engine_kw"],
    ["fuelType", "fuel_type"],
    ["emissionClass", "emission_class"],
    ["vin", "vin"],
    ["hsn", "hsn"],
    ["tsn", "tsn"]
  ];

  for (const [incomingKey, dbKey] of fields) {
    const incoming = partial[incomingKey];
    if (incoming !== undefined && incoming !== null && incoming !== "") {
      payload[dbKey] = incoming;
    } else if (existing && existing[dbKey] !== undefined) {
      payload[dbKey] = existing[dbKey];
    }
  }

  // Try upsert, but be tolerant to schema differences (missing columns). If the DB returns an error
  // complaining about unknown columns, remove those keys from payload and retry a few times.
  let attempts = 0;
  let lastErr: any = null;
  let data: any = null;
  while (attempts < 3) {
    attempts += 1;
    try {
      const resp = await client.from("vehicles").upsert(payload, { onConflict: "order_id" }).select("*").maybeSingle();
      data = resp.data;
      const err = resp.error;
      if (err) throw err;
      lastErr = null;
      break;
    } catch (err: any) {
      lastErr = err;
      const msg = (err?.message || "") as string;
      // Look for messages like: Could not find the 'emission_class' column
      const m = msg.match(/'([^']+)'/);
      if (m && m[1]) {
        const col = m[1];
        // remove occurrences of this column from payload keys
        // try both snake_case and camelCase variations
        delete payload[col];
        const camelKey = col.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        delete payload[camelKey];
        // continue to retry without this field
        continue;
      }
      // Unknown error, break and rethrow
      break;
    }
  }

  if (lastErr) {
    throw new Error(`Failed to insert vehicle: ${lastErr.message}`);
  }

  if (!data) {
    throw new Error("Failed to insert vehicle: no data returned");
  }

  // Ensure order.vehicle_id is set to the vehicle row
  try {
    await setOrderVehicleId(orderId, data.id);
  } catch (err: any) {
    console.error("Failed to link vehicle to order", { error: err?.message, orderId, vehicleId: data.id });
  }

  const v: Vehicle = {
    id: data.id,
    createdAt: data.created_at,
    make: data.make,
    model: data.model,
    year: data.year ?? undefined,
    engineCode: data.engine_code ?? undefined,
    engineKw: data.engine_kw ?? undefined,
    fuelType: data.fuel_type ?? undefined,
    emissionClass: data.emission_class ?? undefined,
    vin: data.vin,
    hsn: data.hsn,
    tsn: data.tsn,
    rawData: data.raw_data
  };

  return v;
}

/**
 * Führt ein partielles Update des JSON-Feldes order_data für eine Order durch.
 * Bestehende Keys bleiben erhalten, neue werden hinzugefügt/überschrieben.
 */
export async function updateOrderData(
  orderId: string,
  patch: Record<string, any>
): Promise<void> {
  const client = getClient();

  const { data, error } = await client
    .from("orders")
    .select("order_data")
    .eq("id", orderId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch existing order_data: ${error.message}`);
  }

  const current = data?.order_data || {};
  const merged = { ...current, ...patch };

  const { error: updateError } = await client
    .from("orders")
    .update({ order_data: merged })
    .eq("id", orderId);

  if (updateError) {
    throw new Error(`Failed to update order_data: ${updateError.message}`);
  }
}

/**
 * Setzt die Sprache einer Order, z.B. "de" oder "en".
 */
export async function updateOrderLanguage(orderId: string, language: string): Promise<void> {
  const client = getClient();

  const { error } = await client
    .from("orders")
    .update({ language })
    .eq("id", orderId);

  if (error) {
    throw new Error(`Failed to update order language: ${error.message}`);
  }
}

/**
 * Aktualisiert OEM-bezogene Felder in einer Order.
 */
export async function updateOrderOEM(
  orderId: string,
  update: {
    oemStatus?: string | null;
    oemError?: string | null;
    oemData?: any | null;
    oemNumber?: string | null;
  }
) {
  const client = getClient();

  let payload: Record<string, any> = {
    oem_status: update.oemStatus ?? null,
    oem_error: update.oemError ?? null,
    oem_data: update.oemData ?? null,
    oem_number: update.oemNumber ?? null
  };

  let attempts = 0;
  let lastError: any = null;
  while (attempts < 3) {
    attempts += 1;
    if (Object.keys(payload).length === 0) {
      return null;
    }
    const { data, error } = await client.from("orders").update(payload).eq("id", orderId).select("*").single();
    if (!error) {
      appendStatusLog(orderId, {
        type: "oem",
        status: update.oemStatus ?? null,
        oem: update.oemNumber ?? null,
        error: update.oemError ?? null
      });
      return data;
    }
    lastError = error;
    const msg = error?.message || "";
    const colMatch = msg.match(/'([^']+)'/);
    if (colMatch && colMatch[1]) {
      const col = colMatch[1];
      delete payload[col];
      continue;
    }
    break;
  }

  throw new Error(`Failed to update OEM fields: ${lastError?.message || "unknown error"}`);
}

/**
 * Aktualisiert den Status einer Order (z.B. new → processing → ready → ordered).
 */
export async function updateOrderStatus(
  orderId: string,
  status: string
) {
  const client = getClient();

  const { data, error } = await client
    .from("orders")
    .update({
      status
    })
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update order status: ${error.message}`);
  }

  appendStatusLog(orderId, { type: "status", status });
  return data;
}

/**
 * Persistiert Metadaten zu einem extern gestarteten Scraping/Actor‑Job auf der Order.
 * Beispielsweise: Apify runId / TecDoc actor run id / job id und ein einfacher Status.
 */
export async function updateOrderScrapeTask(
  orderId: string,
  update: {
    scrapeTaskId?: string | null;
    scrapeStatus?: string | null;
    scrapeResult?: any | null;
  }
) {
  const client = getClient();

  const payload: Record<string, any> = {};
  if (update.scrapeTaskId !== undefined) payload.scrape_task_id = update.scrapeTaskId ?? null;
  if (update.scrapeStatus !== undefined) payload.scrape_status = update.scrapeStatus ?? null;
  if (update.scrapeResult !== undefined) payload.scrape_result = update.scrapeResult ?? null;

  const { data, error } = await client
    .from("orders")
    .update(payload)
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update order scrape task: ${error.message}`);
  }

  return data;
}

/**
 * Hängt einen Log-Eintrag im order_data.status_log an. Best‑effort, Fehler werden geschluckt.
 */
async function appendStatusLog(orderId: string, entry: Record<string, any>) {
  try {
    const client = getClient();
    const { data } = await client.from("orders").select("order_data").eq("id", orderId).single();
    const current = (data?.order_data as Record<string, any>) || {};
    const log: any[] = Array.isArray(current.status_log) ? current.status_log : [];
    log.push({ ts: new Date().toISOString(), ...entry });
    const merged = { ...current, status_log: log.slice(-100) }; // begrenzen
    await client.from("orders").update({ order_data: merged }).eq("id", orderId);
  } catch (err) {
    console.warn("appendStatusLog failed", { orderId, error: (err as any)?.message ?? err });
  }
}

/**
 * Safe wrapper to persist OEM metadata. Returns true on success, false on failure.
 */
export async function persistOemMetadata(
  orderId: string,
  update: {
    oemStatus?: string | null;
    oemError?: string | null;
    oemData?: any | null;
  }
): Promise<boolean> {
  try {
    await updateOrderOEM(orderId, update);
    return true;
  } catch (err: any) {
    console.warn("persistOemMetadata failed", { orderId, error: err?.message ?? err });
    return false;
  }
}

/**
 * Safe wrapper to persist scrape task metadata. Returns true on success, false on failure.
 */
export async function persistScrapeResult(
  orderId: string,
  update: {
    scrapeTaskId?: string | null;
    scrapeStatus?: string | null;
    scrapeResult?: any | null;
  }
): Promise<boolean> {
  try {
    await updateOrderScrapeTask(orderId, update);
    return true;
  } catch (err: any) {
    console.warn("persistScrapeResult failed", { orderId, error: err?.message ?? err });
    return false;
  }
}

/**
 * Merchant settings and margin helpers
 */
export interface MerchantSettings {
  merchantId: string;
  selectedShops: string[];
  marginPercent: number; // e.g. 20 for 20%
}

/**
 * Try to read merchant settings from the DB. Returns null when not found or on error.
 * The table `merchant_settings` is expected to have at least: merchant_id, selected_shops (json/array), margin_percent (number)
 */
export async function getMerchantSettings(merchantId: string): Promise<MerchantSettings | null> {
  const client = getClient();
  try {
    const { data, error } = await client
      .from("merchant_settings")
      .select("*")
      .eq("merchant_id", merchantId)
      .single();
    if (error) {
      // No rows found
      if (error.code === "PGRST116") return null;
      console.warn("getMerchantSettings failed", { merchantId, error: error.message });
      return null;
    }
    if (!data) return null;
    return {
      merchantId: data.merchant_id,
      selectedShops: data.selected_shops ?? [],
      marginPercent: Number(data.margin_percent ?? 0)
    };
  } catch (err: any) {
    console.warn("getMerchantSettings exception", { merchantId, error: err?.message ?? err });
    return null;
  }
}

/**
 * Upsert merchant settings. Returns true on success, false on failure.
 * Uses OnConflict upsert on merchant_id; tolerant to missing table/columns.
 */
export async function upsertMerchantSettings(
  merchantId: string,
  settings: { selectedShops?: string[]; marginPercent?: number }
): Promise<boolean> {
  const client = getClient();
  const payload: Record<string, any> = { merchant_id: merchantId };
  if (settings.selectedShops !== undefined) payload.selected_shops = settings.selectedShops;
  if (settings.marginPercent !== undefined) payload.margin_percent = settings.marginPercent;

  try {
    const { error } = await client.from("merchant_settings").upsert(payload, { onConflict: "merchant_id" });
    if (error) throw error;
    return true;
  } catch (err: any) {
    console.warn("upsertMerchantSettings failed", { merchantId, error: err?.message ?? err });
    return false;
  }
}

/**
 * Apply merchant margin to a list of offers and return annotated offers.
 * Does not persist anything; purely in-memory transformation used when preparing offers for the end-customer.
 */
export function applyMerchantMarginToOffers(
  offers: Array<{
    shopName: string;
    brand?: string | null;
    price: number;
    currency?: string;
    availability?: string | null;
    deliveryTimeDays?: number | null;
    productUrl?: string | null;
    rating?: number | null;
    isRecommended?: boolean | null;
  }>,
  marginPercent: number
): Array<any> {
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

/**
 * Create an inquiry entry (dashboard-visible) and persist corresponding shop offers.
 * - Applies merchant margin (if merchant settings are available)
 * - Inserts offers via `insertShopOffers` (price will be the price shown to the end-customer)
 * - Updates order status and order_data to make the inquiry visible in the dashboard
 *
 * This function is tolerant: failures in auxiliary persistence (merchant settings, order_data) will be logged
 * but attempts to persist the primary shop offers. Returns true on overall success (offers inserted), false otherwise.
 */
export async function createInquiryAndInsertOffers(
  orderId: string,
  merchantId: string | null,
  oemNumber: string,
  offers: Array<{
    shopName: string;
    brand?: string | null;
    price: number; // supplier price reported by shop/scraper
    currency?: string;
    availability?: string | null;
    deliveryTimeDays?: number | null;
    productUrl?: string | null;
    rating?: number | null;
    isRecommended?: boolean | null;
  }>
): Promise<boolean> {
  // 1) get merchant settings (if provided)
  let margin = 0;
  let selectedShops: string[] | null = null;
  if (merchantId) {
    try {
      const ms = await getMerchantSettings(merchantId);
      if (ms) {
        margin = ms.marginPercent ?? 0;
        selectedShops = ms.selectedShops ?? null;
      }
    } catch (err: any) {
      console.warn("Failed to read merchant settings, proceeding with margin=0", { merchantId, error: err?.message ?? err });
    }
  }

  // 2) Optionally filter offers by merchant-selected shops
  let filteredOffers = offers;
  if (selectedShops && selectedShops.length > 0) {
    filteredOffers = offers.filter((o) => selectedShops!.includes(o.shopName));
  }

  // 3) apply margin in-memory
  const annotated = applyMerchantMarginToOffers(filteredOffers, margin);

  // 4) prepare payload for DB insertion: use priceInclMargin as the price shown to customer
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

  // 5) try to insert offers
  try {
    await insertShopOffers(orderId, oemNumber, dbOffers);
  } catch (err: any) {
    console.error("Failed to insert shop offers for inquiry", { orderId, error: err?.message ?? err });
    return false;
  }

  // 6) update order status and order_data so dashboard shows the inquiry
  try {
    // mark status to await customer confirmation / show_offers
    await updateOrder(orderId, { status: "await_offer_confirmation" as ConversationStatus });
  } catch (err: any) {
    console.warn("Failed to update order status after inserting offers", { orderId, error: err?.message ?? err });
  }

  try {
    // add a small inquiry record into order_data for visibility
    const inquiryMeta = {
      lastInquiryAt: new Date().toISOString(),
      lastInquiryOem: oemNumber,
      lastInquiryMerchant: merchantId ?? null,
      lastInquiryOfferCount: dbOffers.length
    } as Record<string, any>;
    await updateOrderData(orderId, { last_inquiry: inquiryMeta });
  } catch (err: any) {
    console.warn("Failed to persist inquiry metadata on order_data", { orderId, error: err?.message ?? err });
  }

  return true;
}
