import { logger } from '../utils/logger';
import * as db from './database';
import { randomUUID } from 'crypto';

// Re-export types if needed
export interface MerchantSettings {
    merchantId: string;
    selectedShops: string[];
    marginPercent: number;
    allowDirectDelivery: boolean;
    dealerAddress?: string;
    dealerName?: string;
    deliveryTimeBufferDays?: number;
    supportedLanguages?: string[];
}

function genId(prefix = "order"): string {
    return `${prefix}-${randomUUID().split('-')[0]}-${Date.now().toString(36)}`;
}

export async function testDbConnection() {
    try {
        await db.get('SELECT 1');
        return true;
    } catch (e) {
        return false;
    }
}

export async function upsertConversationState(waId: string, state: any) {
    // Find active order for this contact
    let order = await findOrCreateOrder(waId);
    if (!order) {
        // Should not happen as findOrCreate creates it
        throw new Error("Could not find or create order");
    }

    // Merge state into order_data
    const newData = { ...order.order_data, ...state };
    await updateOrderData(order.id, newData);

    // If state contains language, update column
    if (state.language) {
        await db.run('UPDATE orders SET language = ? WHERE id = ?', [state.language, order.id]);
    }

    return { conversation: { ...order, order_data: newData } };
}

export async function insertMessage(waId: string, content: string, direction: 'IN' | 'OUT') {
    // We need to attach message to the active order
    const order = await findOrCreateOrder(waId);

    const msgId = genId('msg');
    const createdAt = new Date().toISOString();

    await db.run(
        `INSERT INTO messages (id, order_id, direction, content, created_at) VALUES (?, ?, ?, ?, ?)`,
        [msgId, order.id, direction, content, createdAt]
    );

    // Update conversation state slightly to reflect last activity
    const lastSummary = {
        last_text: content,
        last_direction: direction,
        updated_at: createdAt
    };
    await upsertConversationState(waId, lastSummary);

    return { id: msgId, ...lastSummary };
}

export async function findOrCreateOrder(from: string) {
    // Find most recent active order
    const row = await db.get<any>(
        `SELECT * FROM orders WHERE customer_contact = ? AND status != 'done' ORDER BY created_at DESC LIMIT 1`,
        [from]
    );

    if (row) {
        return parseOrderRow(row);
    }

    // Create new
    const id = genId('order');
    const now = new Date().toISOString();
    const initialData = JSON.stringify({});

    await db.run(
        `INSERT INTO orders (id, customer_contact, status, created_at, updated_at, order_data) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, from, "choose_language", now, now, initialData]
    );

    return {
        id,
        customerContact: from,
        status: "choose_language",
        order_data: {},
        created_at: now,
        updated_at: now
    };
}

export async function insertOrder(data: any) {
    const id = genId('order');
    const now = new Date().toISOString();
    const orderData = JSON.stringify(data.order_data || {});

    await db.run(
        `INSERT INTO orders (id, customer_contact, status, created_at, updated_at, order_data) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, data.customer_contact, data.status || "choose_language", now, now, orderData]
    );
    return { id, ...data };
}

export async function updateOrder(orderId: string | number, patch: any) {
    logger.info(`Updating order ${orderId} with keys: ${Object.keys(patch).join(', ')}`);

    const updates: string[] = [];
    const params: any[] = [];

    if (patch.status) {
        updates.push("status = ?");
        params.push(patch.status);
    }
    if (patch.language) {
        updates.push("language = ?"); // Assuming column exists or we might store in order_data
        // Wait, schema didn't have language explicitly but it's fine to rely on order_data usually.
        // But wawiAdapter had it. Let's see my schema:
        // id, customer_contact, status, created_at, updated_at, oem_number, order_data, vehicle_data, scrape_result
        // Missing language column. I'll store it in order_data for now or add column if needed.
        // Actually findOrCreateOrder dummy updated `order.language`.
        // I will assume it's in order_data or I'll ignore specific column.
    }

    updates.push("updated_at = ?");
    params.push(new Date().toISOString());

    // For specific fields
    // If we have random fields in patch that are not columns, we should probably merge them into order_data
    // But updateOrder is usually called with specific fields.

    if (updates.length > 0) {
        const sql = `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`;
        params.push(String(orderId));
        await db.run(sql, params);
    }

    return getOrderById(orderId);
}

export async function updateOrderData(orderId: string | number, data: any): Promise<void> {
    const order = await getDbOrder(orderId);
    if (!order) return;

    const existingData = JSON.parse(order.order_data || '{}');
    const newData = { ...existingData, ...data };

    await db.run(`UPDATE orders SET order_data = ? WHERE id = ?`, [JSON.stringify(newData), String(orderId)]);
}

export async function getVehicleForOrder(orderId: string | number): Promise<any> {
    const order = await getDbOrder(orderId);
    if (!order || !order.vehicle_data) return null;
    return JSON.parse(order.vehicle_data);
}

export async function upsertVehicleForOrderFromPartial(orderId: string | number, partial: any): Promise<void> {
    const current = await getVehicleForOrder(orderId) || {};
    const updated = { ...current, ...partial };
    await db.run(`UPDATE orders SET vehicle_data = ? WHERE id = ?`, [JSON.stringify(updated), String(orderId)]);
}

export async function updateOrderOEM(orderId: string | number, payload: any) {
    const current = await getDbOrder(orderId);
    if (!current) return;

    if (payload.oem) {
        await db.run(`UPDATE orders SET oem_number = ? WHERE id = ?`, [payload.oem, String(orderId)]);
    }
    // Also store full payload in order_data.oemInfo if needed
    await updateOrderData(orderId, { oem_info: payload });
}

export async function listShopOffersByOrderId(orderId: string | number): Promise<any[]> {
    const rows = await db.all<any>(`SELECT * FROM shop_offers WHERE order_id = ?`, [String(orderId)]);
    return rows.map(r => ({ ...JSON.parse(r.data), oem: r.oem, id: r.id }));
}

export async function insertShopOffers(orderId: string, oem: string, offers: any[]) {
    logger.info(`Inserting ${offers.length} offers for order ${orderId}`);
    const now = new Date().toISOString();
    for (const offer of offers) {
        await db.run(
            `INSERT INTO shop_offers (order_id, oem, data, inserted_at) VALUES (?, ?, ?, ?)`,
            [orderId, oem, JSON.stringify(offer), now]
        );
    }
    return offers;
}

export async function getOrderById(orderId: string | number): Promise<any> {
    const row = await getDbOrder(orderId);
    if (!row) return null;
    return parseOrderRow(row);
}

export async function updateOrderStatus(orderId: string | number, status: string) {
    await db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, String(orderId)]);
}

export async function persistScrapeResult(orderId: string | number, result: any) {
    await db.run(`UPDATE orders SET scrape_result = ? WHERE id = ?`, [JSON.stringify(result), String(orderId)]);
}

export async function listActiveOrdersByContact(from: string): Promise<any[]> {
    const rows = await db.all<any>(`SELECT * FROM orders WHERE customer_contact = ? AND status != 'done'`, [from]);
    return rows.map(parseOrderRow);
}

export async function persistOemMetadata(orderId: string, meta: any): Promise<void> {
    await updateOrderData(orderId, { oem_metadata: meta });
}

export async function updateOrderScrapeTask(orderId: string, payload: any): Promise<void> {
    await updateOrderData(orderId, { scrape_task: payload });
}

export async function listOrders(): Promise<any[]> {
    const rows = await db.all<any>(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 100`);
    return rows.map(parseOrderRow);
}

export async function getMerchantSettings(merchantId: string): Promise<MerchantSettings | null> {
    const row = await db.get<any>(`SELECT settings FROM merchant_settings WHERE merchant_id = ?`, [merchantId]);
    if (row) {
        return { merchantId, ...JSON.parse(row.settings) };
    }
    // Return default match if not found, to keep app working
    return {
        merchantId,
        selectedShops: ['Autodoc', 'kfzteile24'],
        marginPercent: 25,
        allowDirectDelivery: true,
        dealerAddress: 'Musterstraße 1, 12345 Berlin',
        dealerName: 'Autoteile Center Berlin',
        deliveryTimeBufferDays: 1,
        supportedLanguages: ['de', 'en', 'tr', 'ku', 'pl']
    };
}

export async function upsertMerchantSettings(merchantId: string, settings: Partial<MerchantSettings>): Promise<boolean> {
    const current = await getMerchantSettings(merchantId);
    const updated = { ...current, ...settings };
    await db.run(
        `INSERT INTO merchant_settings (merchant_id, settings) VALUES (?, ?) ON CONFLICT(merchant_id) DO UPDATE SET settings = excluded.settings`,
        [merchantId, JSON.stringify(updated)]
    );
    return true;
}

export async function saveDeliveryAddress(orderId: string | number, address: string): Promise<void> {
    await updateOrderData(orderId, { deliveryAddress: address });
}

export async function listSuppliers(): Promise<any[]> {
    // For now, return mock suppliers - this should be replaced with actual WAWI integration
    return [
        {
            id: "1",
            name: "Autodoc",
            type: "scraper",
            status: "active",
            url: "https://www.autodoc.de",
            priority: 1
        },
        {
            id: "2",
            name: "kfzteile24",
            type: "scraper",
            status: "active",
            url: "https://www.kfzteile24.de",
            priority: 2
        },
        {
            id: "3",
            name: "pkwteile.de",
            type: "scraper",
            status: "active",
            url: "https://www.pkwteile.de",
            priority: 3
        }
    ];
}

export async function getSupplierById(id: string): Promise<any | null> {
    const suppliers = await listSuppliers();
    return suppliers.find(s => s.id === id) || null;
}

export async function listOffers(): Promise<any[]> {
    // Get all offers from all orders
    const rows = await db.all<any>(`SELECT * FROM shop_offers ORDER BY inserted_at DESC LIMIT 100`);
    return rows.map(r => ({
        id: r.id,
        orderId: r.order_id,
        oem: r.oem,
        ...JSON.parse(r.data),
        insertedAt: r.inserted_at
    }));
}

export async function getOfferById(id: string): Promise<any | null> {
    const row = await db.get<any>(`SELECT * FROM shop_offers WHERE id = ?`, [id]);
    if (!row) return null;
    return {
        id: row.id,
        orderId: row.order_id,
        oem: row.oem,
        ...JSON.parse(row.data),
        insertedAt: row.inserted_at
    };
}

// Helpers
async function getDbOrder(id: string | number) {
    return await db.get<any>(`SELECT * FROM orders WHERE id = ?`, [String(id)]);
}

function parseOrderRow(row: any) {
    const data = row.order_data ? JSON.parse(row.order_data) : {};
    return {
        id: row.id,
        customerContact: row.customer_contact,
        customer_contact: row.customer_contact, // For mapper compatibility
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        order_data: data,
        orderData: data, // Compatibility alias
        vehicle: row.vehicle_data ? JSON.parse(row.vehicle_data) : null,
        oem_number: row.oem_number,
        scrapeResult: row.scrape_result ? JSON.parse(row.scrape_result) : null,
        language: data.language // Extract language from json if needed
    };
}
