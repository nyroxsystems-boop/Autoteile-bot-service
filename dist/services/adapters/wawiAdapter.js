"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testDbConnection = testDbConnection;
exports.insertOrder = insertOrder;
exports.getOrderById = getOrderById;
exports.listOrders = listOrders;
exports.findOrCreateOrder = findOrCreateOrder;
exports.listActiveOrdersByContact = listActiveOrdersByContact;
exports.updateOrder = updateOrder;
exports.insertMessage = insertMessage;
exports.insertShopOffers = insertShopOffers;
exports.listShopOffersByOrderId = listShopOffersByOrderId;
exports.updateOrderData = updateOrderData;
exports.listMessagesByOrderId = listMessagesByOrderId;
exports.updateOrderStatus = updateOrderStatus;
exports.getVehicleForOrder = getVehicleForOrder;
exports.upsertVehicleForOrderFromPartial = upsertVehicleForOrderFromPartial;
exports.persistScrapeResult = persistScrapeResult;
exports.updateOrderOEM = updateOrderOEM;
exports.getMerchantSettings = getMerchantSettings;
exports.upsertMerchantSettings = upsertMerchantSettings;
exports.applyMerchantMarginToOffers = applyMerchantMarginToOffers;
exports.createInquiryAndInsertOffers = createInquiryAndInsertOffers;
const ACTIVE_CONVERSATION_STATUSES = [
    "choose_language",
    "collect_vehicle",
    "collect_part",
    "oem_lookup",
    "show_offers",
    "await_offer_choice",
    "await_offer_confirmation"
];
function genId(prefix = "order") {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
const orders = new Map();
const messages = new Map();
const shopOffers = new Map();
async function testDbConnection() {
    return { ok: true };
}
async function insertOrder(partial) {
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
async function getOrderById(id) {
    const row = orders.get(id) || null;
    if (!row)
        return null;
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
async function listOrders(limit = 50) {
    return Array.from(orders.values()).slice(0, limit);
}
async function findOrCreateOrder(from, orderId, opts) {
    if (orderId) {
        const existing = await getOrderById(orderId);
        if (existing)
            return existing;
    }
    for (const row of orders.values()) {
        if (row.customer_contact === from && (opts?.forceNew !== true)) {
            return await getOrderById(row.id);
        }
    }
    return await insertOrder({ customer_contact: from, requested_part_name: "pending", status: "choose_language", order_data: { conversationStatus: "choose_language" } });
}
async function listActiveOrdersByContact(from) {
    return Array.from(orders.values()).filter((r) => r.customer_contact === from && r.status !== "done");
}
async function updateOrder(orderId, patch) {
    const row = orders.get(orderId) || {};
    const updated = { ...row, ...patch, updated_at: new Date().toISOString() };
    orders.set(orderId, updated);
    return await getOrderById(orderId);
}
async function insertMessage(partial) {
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
async function insertShopOffers(orderId, oem, offers) {
    const list = shopOffers.get(orderId) || [];
    list.push(...offers.map((o) => ({ ...o, oem, inserted_at: new Date().toISOString() })));
    shopOffers.set(orderId, list);
}
async function listShopOffersByOrderId(orderId) {
    return shopOffers.get(orderId) || [];
}
async function updateOrderData(orderId, data) {
    const row = orders.get(orderId) || {};
    row.order_data = { ...(row.order_data || {}), ...data };
    orders.set(orderId, row);
}
async function listMessagesByOrderId(orderId) {
    return messages.get(orderId) || [];
}
async function updateOrderStatus(orderId, status) {
    const row = orders.get(orderId) || {};
    row.status = status;
    orders.set(orderId, row);
}
async function getVehicleForOrder(orderId) {
    const row = orders.get(orderId);
    return row?.vehicle ?? null;
}
async function upsertVehicleForOrderFromPartial(orderId, partial) {
    const row = orders.get(orderId) || {};
    row.vehicle = { ...(row.vehicle || {}), ...partial };
    orders.set(orderId, row);
}
async function persistScrapeResult(orderId, scrapeResult) {
    const row = orders.get(orderId) || {};
    row.scrapeResult = scrapeResult;
    orders.set(orderId, row);
}
async function updateOrderOEM(orderId, payload) {
    const row = orders.get(orderId) || {};
    row.oem_number = payload.oem ?? row.oem_number;
    orders.set(orderId, row);
}
async function getMerchantSettings(merchantId) {
    return null;
}
async function upsertMerchantSettings(merchantId, payload) {
    return;
}
function applyMerchantMarginToOffers(offers, marginPercent) {
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
async function createInquiryAndInsertOffers(orderId, merchantId, oemNumber, offers) {
    let margin = 0;
    let selectedShops = null;
    if (merchantId) {
        try {
            const ms = await getMerchantSettings(merchantId);
            if (ms) {
                margin = ms.marginPercent ?? 0;
                selectedShops = ms.selectedShops ?? null;
            }
        }
        catch (err) {
            // ignore
        }
    }
    let filteredOffers = offers;
    if (selectedShops && selectedShops.length > 0) {
        filteredOffers = offers.filter((o) => selectedShops.includes(o.shopName));
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
    }
    catch (err) {
        return false;
    }
    try {
        await updateOrder(orderId, { status: "await_offer_confirmation" });
    }
    catch (err) {
        // ignore
    }
    try {
        const inquiryMeta = {
            lastInquiryAt: new Date().toISOString(),
            lastInquiryOem: oemNumber,
            lastInquiryMerchant: merchantId ?? null,
            lastInquiryOfferCount: dbOffers.length
        };
        await updateOrderData(orderId, { last_inquiry: inquiryMeta });
    }
    catch (err) {
        // ignore
    }
    return true;
}
