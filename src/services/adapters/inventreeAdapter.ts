import { logger } from '@utils/logger';
import * as db from '@core/database';
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

    // Onboarding / Twilio Fields
    twilio_phone_number?: string;
    twilio_sid?: string;
    twilio_auth_token?: string;

    // Shop Integration
    shop_type?: 'shopify' | 'woocommerce';
    shop_url?: string;
    shop_api_key?: string;
}

function parseJsonField<T>(value: any, fallback: T): T {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") {
        try {
            return JSON.parse(value) as T;
        } catch {
            return fallback;
        }
    }
    return value as T;
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

export async function listMessagesByOrderId(orderId: string | number): Promise<any[]> {
    const rows = await db.all<any>(`SELECT * FROM messages WHERE order_id = ? ORDER BY created_at ASC`, [String(orderId)]);
    return rows.map(r => ({
        id: r.id,
        direction: r.direction,
        content: r.content,
        createdAt: r.created_at,
        isFromCustomer: r.direction === 'IN'
    }));
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
    const dataPatch: Record<string, any> = {};

    const columnMap: Record<string, string> = {
        status: "status",
        language: "language",
        customer_contact: "customer_contact",
        customer_name: "customer_name",
        customer_phone: "customer_phone",
        customer_id: "customer_id",
        vehicle_id: "vehicle_id",
        requested_part_name: "requested_part_name",
        oem_number: "oem_number",
        oem_status: "oem_status",
        oem_error: "oem_error",
        total: "total",
        match_confidence: "match_confidence",
        merchant_id: "merchant_id",
        dealer_id: "dealer_id",
        country: "country",
        vehicle_description: "vehicle_description",
        part_description: "part_description",
        vehicle_data: "vehicle_data",
        scrape_result: "scrape_result"
    };

    for (const [key, value] of Object.entries(patch || {})) {
        if (value === undefined) continue;
        const column = columnMap[key];
        if (column) {
            updates.push(`${column} = ?`);
            if (key === "vehicle_data" || key === "scrape_result") {
                params.push(typeof value === "string" ? value : JSON.stringify(value));
            } else {
                params.push(value);
            }
        } else {
            dataPatch[key] = value;
        }
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

    if (Object.keys(dataPatch).length > 0) {
        await updateOrderData(orderId, dataPatch);
    }

    return getOrderById(orderId);
}

export async function updateOrderData(orderId: string | number, data: any): Promise<void> {
    const order = await getDbOrder(orderId);
    if (!order) return;

    const existingData = parseJsonField(order.order_data, {});
    const newData = { ...existingData, ...data };

    await db.run(`UPDATE orders SET order_data = ? WHERE id = ?`, [JSON.stringify(newData), String(orderId)]);
}

export async function getVehicleForOrder(orderId: string | number): Promise<any> {
    const order = await getDbOrder(orderId);
    if (!order || !order.vehicle_data) return null;
    return parseJsonField(order.vehicle_data, null);
}

export async function upsertVehicleForOrderFromPartial(orderId: string | number, partial: any): Promise<void> {
    const current = await getVehicleForOrder(orderId) || {};
    const updated = { ...current, ...partial };
    await db.run(`UPDATE orders SET vehicle_data = ? WHERE id = ?`, [JSON.stringify(updated), String(orderId)]);
}

export async function updateOrderOEM(orderId: string | number, payload: any) {
    const current = await getDbOrder(orderId);
    if (!current) return;

    const updates: string[] = [];
    const params: any[] = [];

    const oemNumber = payload.oem ?? payload.oemNumber ?? payload.oem_number;
    if (oemNumber !== undefined) {
        updates.push("oem_number = ?");
        params.push(oemNumber);
    }
    if (payload.oemStatus !== undefined) {
        updates.push("oem_status = ?");
        params.push(payload.oemStatus);
    }
    if (payload.oemError !== undefined) {
        updates.push("oem_error = ?");
        params.push(payload.oemError);
    }
    if (payload.oemData !== undefined) {
        updates.push("oem_data = ?");
        params.push(typeof payload.oemData === "string" ? payload.oemData : JSON.stringify(payload.oemData));
    }

    if (updates.length > 0) {
        const sql = `UPDATE orders SET ${updates.join(", ")} WHERE id = ?`;
        params.push(String(orderId));
        await db.run(sql, params);
    }

    // Also store full payload in order_data.oemInfo if needed
    await updateOrderData(orderId, { oem_info: payload });
}

export async function listShopOffersByOrderId(orderId: string | number): Promise<any[]> {
    const rows = await db.all<any>(`SELECT * FROM shop_offers WHERE order_id = ?`, [String(orderId)]);
    return rows.map(r => ({ ...parseJsonField(r.data, {}), oem: r.oem, id: r.id }));
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
        const settings = parseJsonField(row.settings, {});
        return { merchantId, selectedShops: [], marginPercent: 0, allowDirectDelivery: false, ...settings } as MerchantSettings;
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

export async function listSuppliers(tenantId?: string, params?: any): Promise<any[]> {
    let sql = `SELECT * FROM companies WHERE is_supplier = TRUE`;
    const queryParams: any[] = [];

    if (tenantId) {
        sql += ` AND (tenant_id = ? OR tenant_id IS NULL)`;
        queryParams.push(tenantId);
    }

    if (params?.search) {
        sql += ` AND name LIKE ?`;
        queryParams.push(`%${params.search}%`);
    }

    if (params?.active !== undefined) {
        sql += ` AND active = ?`;
        queryParams.push(params.active);
    }

    sql += ` ORDER BY name ASC`;

    const rows = await db.all<any>(sql, queryParams);
    return rows.map(r => ({
        id: r.id,
        pk: r.id,
        name: r.name,
        contact_person: r.contact_person,
        email: r.email,
        phone: r.phone,
        address: r.address,
        website: r.website,
        notes: r.notes,
        status: r.active ? 'active' : 'inactive',
        active: !!r.active,
        payment_terms: r.payment_terms,
        is_supplier: true,
        created_at: r.created_at
    }));
}

export async function getSupplierById(tenantId: string, id: string): Promise<any | null> {
    const row = await db.get<any>(
        `SELECT * FROM companies WHERE id = ? AND is_supplier = TRUE`,
        [String(id)]
    );
    if (!row) return null;
    return {
        id: row.id,
        pk: row.id,
        name: row.name,
        contact_person: row.contact_person,
        email: row.email,
        phone: row.phone,
        address: row.address,
        website: row.website,
        notes: row.notes,
        status: row.active ? 'active' : 'inactive',
        active: !!row.active,
        payment_terms: row.payment_terms,
        is_supplier: true,
        created_at: row.created_at
    };
}

export async function createSupplier(tenantId: string, data: any): Promise<any> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const isActive = data.status === 'active' || data.active !== false;

    await db.run(
        `INSERT INTO companies (
            id, name, contact_person, email, phone, address, website, notes,
            is_supplier, active, payment_terms, tenant_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?, ?, ?)`,
        [
            id,
            data.name,
            data.contact_person || null,
            data.email || null,
            data.phone || null,
            data.address || null,
            data.website || null,
            data.notes || null,
            isActive,
            data.payment_terms || null,
            tenantId,
            now
        ]
    );

    return getSupplierById(tenantId, id);
}

export async function updateSupplier(tenantId: string, id: string | number, patch: any): Promise<any> {
    const updates: string[] = [];
    const params: any[] = [];

    if (patch.name !== undefined) { updates.push("name = ?"); params.push(patch.name); }
    if (patch.contact_person !== undefined) { updates.push("contact_person = ?"); params.push(patch.contact_person); }
    if (patch.email !== undefined) { updates.push("email = ?"); params.push(patch.email); }
    if (patch.phone !== undefined) { updates.push("phone = ?"); params.push(patch.phone); }
    if (patch.address !== undefined) { updates.push("address = ?"); params.push(patch.address); }
    if (patch.website !== undefined) { updates.push("website = ?"); params.push(patch.website); }
    if (patch.notes !== undefined) { updates.push("notes = ?"); params.push(patch.notes); }
    if (patch.payment_terms !== undefined) { updates.push("payment_terms = ?"); params.push(patch.payment_terms); }
    // Handle active status - prioritize patch.active, fallback to patch.status
    if (patch.active !== undefined) {
        updates.push("active = ?");
        params.push(patch.active);
    } else if (patch.status !== undefined) {
        updates.push("active = ?");
        params.push(patch.status === 'active');
    }


    if (updates.length > 0) {
        const sql = `UPDATE companies SET ${updates.join(', ')} WHERE id = ? AND is_supplier = TRUE`;
        params.push(String(id));
        await db.run(sql, params);
    }

    return getSupplierById(tenantId, String(id));
}

export async function deleteSupplier(tenantId: string, id: string | number): Promise<void> {
    await db.run(
        `DELETE FROM companies WHERE id = ? AND is_supplier = TRUE`,
        [String(id)]
    );
}

export async function listOffers(orderId?: string | number): Promise<any[]> {
    let rows;
    if (orderId) {
        rows = await db.all<any>(`SELECT * FROM shop_offers WHERE order_id = ? ORDER BY inserted_at DESC`, [String(orderId)]);
    } else {
        rows = await db.all<any>(`SELECT * FROM shop_offers ORDER BY inserted_at DESC LIMIT 100`);
    }

    return rows.map(r => ({
        id: r.id,
        orderId: r.order_id,
        oem: r.oem,
        ...parseJsonField(r.data, {}),
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
        ...parseJsonField(row.data, {}),
        insertedAt: row.inserted_at
    };
}

// Helpers
async function getDbOrder(id: string | number) {
    return await db.get<any>(`SELECT * FROM orders WHERE id = ?`, [String(id)]);
}

function parseOrderRow(row: any) {
    const data: Record<string, any> = parseJsonField(row.order_data, {});
    return {
        id: row.id,
        customerContact: row.customer_contact,
        customer_contact: row.customer_contact, // For mapper compatibility
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        order_data: data,
        orderData: data, // Compatibility alias
        vehicle: parseJsonField(row.vehicle_data, null),
        oem_number: row.oem_number,
        oemNumber: row.oem_number ?? data.oemNumber ?? null,
        oem_data: parseJsonField(row.oem_data, null),
        scrapeResult: parseJsonField(row.scrape_result, null),
        language: row.language ?? data.language ?? null,
        vehicle_description: row.vehicle_description ?? data.vehicle_description ?? null,
        part_description: row.part_description ?? data.part_description ?? null,
        customer_name: row.customer_name ?? null,
        customer_phone: row.customer_phone ?? null,
        customer_id: row.customer_id ?? null,
        vehicle_id: row.vehicle_id ?? null
    };
}
// --------------------------------------------------------------------------
// Product Management (Local / Mock)
// --------------------------------------------------------------------------

export async function getParts(tenantId: string, params: any = {}) {
    let sql = `SELECT * FROM parts WHERE 1=1`;
    const queryParams: any[] = [];

    if (params.search) {
        sql += ` AND (name LIKE ? OR oem_number LIKE ? OR ipn LIKE ?)`;
        const term = `%${params.search}%`;
        queryParams.push(term, term, term);
    }

    if (params.category) {
        // Simple match
        sql += ` AND category = ?`;
        queryParams.push(params.category);
    }

    // Sort
    sql += ` ORDER BY name ASC LIMIT 100`;

    const rows = await db.all<any>(sql, queryParams);
    return rows.map(r => ({
        id: r.id, // Frontend uses .id
        pk: r.id,
        name: r.name,
        description: r.description,
        oe_number: r.oem_number,
        IPN: r.oem_number || r.ipn, // Map OEM to IPN for frontend display
        stock: r.stock,
        total_in_stock: r.stock, // Frontend uses .total_in_stock
        minimum_stock: 5, // Default minimum for demo
        category: r.category,
        location: r.location,
        manufacturer: r.manufacturer,
        active: true,
        metadata: {}
    }));
}

export async function getPartById(tenantId: string, partId: string | number) {
    const row = await db.get<any>(`SELECT * FROM parts WHERE id = ?`, [String(partId)]);
    if (!row) throw new Error("Part not found");
    return {
        pk: row.id,
        name: row.name,
        description: row.description,
        oe_number: row.oem_number,
        stock: row.stock,
        category: row.category,
        location: row.location,
        IPN: row.ipn,
        manufacturer: row.manufacturer,
        active: true,
        metadata: {}
    };
}

export async function createPart(tenantId: string, data: any) {
    // Insert
    await db.run(
        `INSERT INTO parts (name, description, oem_number, stock, category, location, ipn, manufacturer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.name, data.description || '', data.oe_number || '', data.stock || 0, data.category || '', data.location || '', data.IPN || '', data.manufacturer || '']
    );
    // Get last inserted
    // Since we don't have returning, we fetch by name/oem or just basic last_insert_rowid (db.run context)
    // For simplicity, just return input with a fake ID or query last
    const row = await db.get<any>(`SELECT * FROM parts ORDER BY id DESC LIMIT 1`);
    return getPartById(tenantId, row.id);
}

export async function updatePart(tenantId: string, partId: string | number, patch: any) {
    // Build update query
    const updates: string[] = [];
    const params: any[] = [];

    if (patch.name !== undefined) { updates.push("name = ?"); params.push(patch.name); }
    if (patch.description !== undefined) { updates.push("description = ?"); params.push(patch.description); }
    if (patch.stock !== undefined) { updates.push("stock = ?"); params.push(patch.stock); }
    if (patch.location !== undefined) { updates.push("location = ?"); params.push(patch.location); }

    if (updates.length > 0) {
        const sql = `UPDATE parts SET ${updates.join(', ')} WHERE id = ?`;
        params.push(String(partId));
        await db.run(sql, params);
    }
    return getPartById(tenantId, partId);
}

export async function processStockAction(tenantId: string, partId: string | number, action: 'add' | 'remove' | 'count', quantity: number) {
    const part = await getPartById(tenantId, partId);
    let newStock = part.stock || 0;

    if (action === 'add') newStock += quantity;
    if (action === 'remove') newStock -= quantity;
    if (action === 'count') newStock = quantity;

    if (newStock < 0) newStock = 0; // Prevent negative

    await db.run(`UPDATE parts SET stock = ? WHERE id = ?`, [newStock, String(part.pk)]);

    return {
        ...part,
        stock: newStock
    };
}

// --------------------------------------------------------------------------
// CRM / Company Integration (Local SQLite)
// --------------------------------------------------------------------------

export interface InvenTreeCompany {
    pk?: number;
    name: string;
    description?: string;
    website?: string;
    phone?: string;
    email?: string;
    is_customer: boolean;
    is_supplier: boolean;
    active: boolean;
    currency?: string;
    metadata?: any;
}

function parseCompanyRow(row: any) {
    return {
        pk: row.id,
        name: row.name,
        description: row.description,
        website: row.website,
        email: row.email,
        phone: row.phone,
        is_customer: !!row.is_customer,
        is_supplier: !!row.is_supplier,
        active: !!row.active,
        metadata: parseJsonField(row.metadata, {})
    };
}

export async function createCompany(company: InvenTreeCompany) {
    await db.run(
        `INSERT INTO companies (name, description, website, email, phone, is_customer, is_supplier, active, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [company.name, company.description || '', company.website || '', company.email || '', company.phone || '', company.is_customer, company.is_supplier, company.active, JSON.stringify(company.metadata || {})]
    );
    const row = await db.get<any>(`SELECT * FROM companies ORDER BY id DESC LIMIT 1`);
    return parseCompanyRow(row);
}

export async function getCompanies(params: { is_customer?: boolean, is_supplier?: boolean, search?: string, active?: boolean } = {}) {
    let sql = `SELECT * FROM companies WHERE 1=1`;
    const qp: any[] = [];
    if (params.is_customer !== undefined) { sql += ` AND is_customer = ?`; qp.push(params.is_customer); }
    if (params.is_supplier !== undefined) { sql += ` AND is_supplier = ?`; qp.push(params.is_supplier); }
    if (params.active !== undefined) { sql += ` AND active = ?`; qp.push(params.active); }
    if (params.search) { sql += ` AND name LIKE ?`; qp.push(`%${params.search}%`); }

    // Sort
    sql += ` ORDER BY id DESC LIMIT 100`;

    const rows = await db.all<any>(sql, qp);
    return rows.map(parseCompanyRow);
}

export async function updateCompany(id: number, patch: Partial<InvenTreeCompany>) {
    const updates: string[] = [];
    const params: any[] = [];

    if (patch.name !== undefined) { updates.push("name = ?"); params.push(patch.name); }
    if (patch.description !== undefined) { updates.push("description = ?"); params.push(patch.description); }
    if (patch.website !== undefined) { updates.push("website = ?"); params.push(patch.website); }
    if (patch.email !== undefined) { updates.push("email = ?"); params.push(patch.email); }
    if (patch.phone !== undefined) { updates.push("phone = ?"); params.push(patch.phone); }
    if (patch.is_customer !== undefined) { updates.push("is_customer = ?"); params.push(patch.is_customer); }
    if (patch.metadata !== undefined) { updates.push("metadata = ?"); params.push(JSON.stringify(patch.metadata)); }

    if (updates.length > 0) {
        const sql = `UPDATE companies SET ${updates.join(', ')} WHERE id = ?`;
        params.push(String(id));
        await db.run(sql, params);
    }
    const row = await db.get<any>(`SELECT * FROM companies WHERE id = ?`, [id]);
    if (!row) throw new Error("Company not found");
    return parseCompanyRow(row);
}

// --------------------------------------------------------------------------
// Stock Movements (Mock/Stub)
// --------------------------------------------------------------------------

export async function getStockMovements(tenantId: string, filters: any = {}): Promise<any[]> {
    let sql = `SELECT sm.*, p.name as part_name FROM stock_movements sm LEFT JOIN parts p ON sm.part_id = p.id WHERE sm.tenant_id = ?`;
    const params: any[] = [tenantId];

    if (filters.part_id) {
        sql += ` AND sm.part_id = ?`;
        params.push(String(filters.part_id));
    }

    if (filters.type) {
        sql += ` AND sm.type = ?`;
        params.push(filters.type);
    }

    if (filters.limit) {
        sql += ` ORDER BY sm.created_at DESC LIMIT ?`;
        params.push(parseInt(filters.limit));
    } else {
        sql += ` ORDER BY sm.created_at DESC LIMIT 50`;
    }

    const rows = await db.all<any>(sql, params);
    return rows.map(r => ({
        id: r.id,
        part_id: r.part_id,
        part_name: r.part_name,
        type: r.type,
        quantity: r.quantity,
        reference: r.reference,
        notes: r.notes,
        from_location: r.from_location_id,
        to_location: r.to_location_id,
        created_at: r.created_at,
        created_by: r.created_by
    }));
}

export async function createStockMovement(tenantId: string, data: any): Promise<any> {
    const id = randomUUID();
    const now = new Date().toISOString();

    await db.run(
        `INSERT INTO stock_movements (
            id, part_id, type, quantity, from_location_id, to_location_id,
            reference, notes, tenant_id, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            data.part_id || null,
            data.type,
            data.quantity,
            data.from_location || null,
            data.to_location || null,
            data.reference || null,
            data.notes || null,
            tenantId,
            data.created_by || null,
            now
        ]
    );

    return {
        id,
        ...data,
        created_at: now
    };
}

export async function getStockLocations(tenantId: string): Promise<any[]> {
    const rows = await db.all<any>(
        `SELECT * FROM stock_locations WHERE (tenant_id = ? OR tenant_id = 'global') AND active = TRUE ORDER BY name ASC`,
        [tenantId]
    );
    return rows.map(r => ({
        id: r.id,
        name: r.name,
        code: r.code,
        type: r.type,
        description: r.description,
        capacity: r.capacity,
        current_stock: r.current_stock
    }));
}

export async function receiveGoods(tenantId: string, data: any): Promise<any> {
    // Mock implementation
    logger.info(`Mock: Receiving goods for tenant ${tenantId}:`, data);
    return {
        success: true,
        ...data,
        received_at: new Date().toISOString()
    };
}

// --------------------------------------------------------------------------
// Purchase Orders (Mock/Stub)
// --------------------------------------------------------------------------

export async function getPurchaseOrders(tenantId: string, filters: any = {}): Promise<any[]> {
    let sql = `SELECT po.*, c.name as supplier_name FROM purchase_orders po LEFT JOIN companies c ON po.supplier_id = c.id WHERE po.tenant_id = ?`;
    const params: any[] = [tenantId];

    if (filters.supplier) {
        sql += ` AND po.supplier_id = ?`;
        params.push(filters.supplier);
    }

    if (filters.status) {
        sql += ` AND po.status = ?`;
        params.push(filters.status);
    }

    sql += ` ORDER BY po.order_date DESC`;

    if (filters.limit) {
        sql += ` LIMIT ?`;
        params.push(parseInt(filters.limit));
    }

    const rows = await db.all<any>(sql, params);
    const orders = [];

    for (const row of rows) {
        // Get items for this PO
        const items = await db.all<any>(
            `SELECT * FROM purchase_order_items WHERE purchase_order_id = ?`,
            [row.id]
        );

        orders.push({
            id: row.id,
            order_number: row.order_number,
            supplier_id: row.supplier_id,
            supplier_name: row.supplier_name,
            status: row.status,
            order_date: row.order_date,
            expected_delivery: row.expected_delivery,
            total_amount: parseFloat(row.total_amount || 0),
            currency: row.currency,
            notes: row.notes,
            items: items.map(i => ({
                id: i.id,
                part_id: i.part_id,
                part_name: i.part_name,
                part_ipn: i.part_ipn,
                quantity: i.quantity,
                unit_price: parseFloat(i.unit_price),
                total_price: parseFloat(i.total_price)
            })),
            created_at: row.created_at
        });
    }

    return orders;
}

export async function getPurchaseOrderById(tenantId: string, id: string | number): Promise<any | null> {
    const row = await db.get<any>(
        `SELECT po.*, c.name as supplier_name FROM purchase_orders po LEFT JOIN companies c ON po.supplier_id = c.id WHERE po.id = ? AND po.tenant_id = ?`,
        [String(id), tenantId]
    );

    if (!row) return null;

    const items = await db.all<any>(
        `SELECT * FROM purchase_order_items WHERE purchase_order_id = ?`,
        [row.id]
    );

    return {
        id: row.id,
        order_number: row.order_number,
        supplier_id: row.supplier_id,
        supplier_name: row.supplier_name,
        status: row.status,
        order_date: row.order_date,
        expected_delivery: row.expected_delivery,
        total_amount: parseFloat(row.total_amount || 0),
        currency: row.currency,
        notes: row.notes,
        items: items.map(i => ({
            id: i.id,
            part_id: i.part_id,
            part_name: i.part_name,
            part_ipn: i.part_ipn,
            quantity: i.quantity,
            unit_price: parseFloat(i.unit_price),
            total_price: parseFloat(i.total_price)
        })),
        created_at: row.created_at
    };
}

export async function createPurchaseOrder(tenantId: string, data: any): Promise<any> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const orderNumber = `PO-${Date.now()}`;

    // Initially create order with 0 total_amount (will update after items are inserted)
    await db.run(
        `INSERT INTO purchase_orders (
            id, order_number, supplier_id, status, order_date, expected_delivery,
            total_amount, currency, notes, tenant_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            orderNumber,
            data.supplier_id,
            data.status || 'draft',
            data.order_date || now,
            data.expected_delivery || null,
            0, // Will be calculated after items
            data.currency || 'EUR',
            data.notes || null,
            tenantId,
            now
        ]
    );

    // Insert items and calculate total_amount correctly
    let totalAmount = 0;
    if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
            const itemId = randomUUID();

            // Fetch part_name from parts table if part_id is provided but part_name is missing
            let partName = item.part_name;
            if (!partName && item.part_id) {
                const part = await db.get<any>('SELECT name FROM parts WHERE id = ?', [item.part_id]);
                partName = part?.name || `Part ${item.part_id}`;
            }
            // If still no part_name, use a default based on part_id or fallback
            if (!partName) {
                partName = item.part_id ? `Part ${item.part_id}` : 'Unknown Part';
            }

            // Calculate total_price for this item
            const itemTotalPrice = item.total_price || (item.quantity * item.unit_price);
            totalAmount += itemTotalPrice;

            await db.run(
                `INSERT INTO purchase_order_items (
                    id, purchase_order_id, part_id, part_name, part_ipn,
                    quantity, unit_price, total_price, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    itemId,
                    id,
                    item.part_id || null,
                    partName,
                    item.part_ipn || null,
                    item.quantity,
                    item.unit_price,
                    itemTotalPrice,
                    now
                ]
            );
        }
    }

    // Update purchase_order with correct total_amount
    await db.run(
        `UPDATE purchase_orders SET total_amount = ? WHERE id = ?`,
        [totalAmount, id]
    );

    return getPurchaseOrderById(tenantId, id);
}

export async function updatePurchaseOrder(tenantId: string, id: string | number, patch: any): Promise<any> {
    const updates: string[] = [];
    const params: any[] = [];

    if (patch.status !== undefined) { updates.push("status = ?"); params.push(patch.status); }
    if (patch.expected_delivery !== undefined) { updates.push("expected_delivery = ?"); params.push(patch.expected_delivery); }
    if (patch.notes !== undefined) { updates.push("notes = ?"); params.push(patch.notes); }

    updates.push("updated_at = ?");
    params.push(new Date().toISOString());

    if (updates.length > 1) { // more than just updated_at
        const sql = `UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`;
        params.push(String(id), tenantId);
        await db.run(sql, params);
    }

    return getPurchaseOrderById(tenantId, String(id));
}

export async function cancelPurchaseOrder(tenantId: string, id: string | number): Promise<void> {
    await db.run(
        `UPDATE purchase_orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND tenant_id = ?`,
        [new Date().toISOString(), String(id), tenantId]
    );
}

export async function receivePurchaseOrder(tenantId: string, poId: string | number, data: any): Promise<any> {
    logger.info(`Mock: Receiving purchase order ${poId} for tenant ${tenantId}:`, data);
    return {
        success: true,
        po_id: poId,
        ...data,
        received_at: new Date().toISOString()
    };
}

export async function getReorderSuggestions(tenantId: string): Promise<any[]> {
    logger.info(`Mock: Getting reorder suggestions for tenant ${tenantId}`);
    return [];
}
