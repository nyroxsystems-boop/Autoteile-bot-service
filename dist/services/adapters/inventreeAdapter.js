"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.testDbConnection = testDbConnection;
exports.upsertConversationState = upsertConversationState;
exports.insertMessage = insertMessage;
exports.listMessagesByOrderId = listMessagesByOrderId;
exports.findOrCreateOrder = findOrCreateOrder;
exports.insertOrder = insertOrder;
exports.updateOrder = updateOrder;
exports.updateOrderData = updateOrderData;
exports.getVehicleForOrder = getVehicleForOrder;
exports.upsertVehicleForOrderFromPartial = upsertVehicleForOrderFromPartial;
exports.updateOrderOEM = updateOrderOEM;
exports.listShopOffersByOrderId = listShopOffersByOrderId;
exports.insertShopOffers = insertShopOffers;
exports.getOrderById = getOrderById;
exports.updateOrderStatus = updateOrderStatus;
exports.persistScrapeResult = persistScrapeResult;
exports.listActiveOrdersByContact = listActiveOrdersByContact;
exports.persistOemMetadata = persistOemMetadata;
exports.updateOrderScrapeTask = updateOrderScrapeTask;
exports.listOrders = listOrders;
exports.getMerchantSettings = getMerchantSettings;
exports.upsertMerchantSettings = upsertMerchantSettings;
exports.saveDeliveryAddress = saveDeliveryAddress;
exports.listSuppliers = listSuppliers;
exports.getSupplierById = getSupplierById;
exports.createSupplier = createSupplier;
exports.updateSupplier = updateSupplier;
exports.deleteSupplier = deleteSupplier;
exports.listOffers = listOffers;
exports.getOfferById = getOfferById;
exports.getParts = getParts;
exports.getPartById = getPartById;
exports.createPart = createPart;
exports.updatePart = updatePart;
exports.processStockAction = processStockAction;
exports.createCompany = createCompany;
exports.getCompanies = getCompanies;
exports.updateCompany = updateCompany;
exports.getStockMovements = getStockMovements;
exports.createStockMovement = createStockMovement;
exports.getStockLocations = getStockLocations;
exports.receiveGoods = receiveGoods;
exports.getPurchaseOrders = getPurchaseOrders;
exports.getPurchaseOrderById = getPurchaseOrderById;
exports.createPurchaseOrder = createPurchaseOrder;
exports.updatePurchaseOrder = updatePurchaseOrder;
exports.cancelPurchaseOrder = cancelPurchaseOrder;
exports.receivePurchaseOrder = receivePurchaseOrder;
exports.getReorderSuggestions = getReorderSuggestions;
const logger_1 = require("../../utils/logger");
const db = __importStar(require("../core/database"));
const crypto_1 = require("crypto");
function parseJsonField(value, fallback) {
    if (value === null || value === undefined)
        return fallback;
    if (typeof value === "string") {
        try {
            return JSON.parse(value);
        }
        catch {
            return fallback;
        }
    }
    return value;
}
function genId(prefix = "order") {
    return `${prefix}-${(0, crypto_1.randomUUID)().split('-')[0]}-${Date.now().toString(36)}`;
}
async function testDbConnection() {
    try {
        await db.get('SELECT 1');
        return true;
    }
    catch (e) {
        return false;
    }
}
async function upsertConversationState(waId, state) {
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
async function insertMessage(waId, content, direction) {
    // We need to attach message to the active order
    const order = await findOrCreateOrder(waId);
    const msgId = genId('msg');
    const createdAt = new Date().toISOString();
    await db.run(`INSERT INTO messages (id, order_id, direction, content, created_at) VALUES (?, ?, ?, ?, ?)`, [msgId, order.id, direction, content, createdAt]);
    // Update conversation state slightly to reflect last activity
    const lastSummary = {
        last_text: content,
        last_direction: direction,
        updated_at: createdAt
    };
    await upsertConversationState(waId, lastSummary);
    return { id: msgId, ...lastSummary };
}
async function listMessagesByOrderId(orderId) {
    const rows = await db.all(`SELECT * FROM messages WHERE order_id = ? ORDER BY created_at ASC`, [String(orderId)]);
    return rows.map(r => ({
        id: r.id,
        direction: r.direction,
        content: r.content,
        createdAt: r.created_at,
        isFromCustomer: r.direction === 'IN'
    }));
}
async function findOrCreateOrder(from) {
    // Find most recent active order
    const row = await db.get(`SELECT * FROM orders WHERE customer_contact = ? AND status != 'done' ORDER BY created_at DESC LIMIT 1`, [from]);
    if (row) {
        return parseOrderRow(row);
    }
    // Create new
    const id = genId('order');
    const now = new Date().toISOString();
    const initialData = JSON.stringify({});
    await db.run(`INSERT INTO orders (id, customer_contact, status, created_at, updated_at, order_data) VALUES (?, ?, ?, ?, ?, ?)`, [id, from, "choose_language", now, now, initialData]);
    return {
        id,
        customerContact: from,
        status: "choose_language",
        order_data: {},
        created_at: now,
        updated_at: now
    };
}
async function insertOrder(data) {
    const id = genId('order');
    const now = new Date().toISOString();
    const orderData = JSON.stringify(data.order_data || {});
    await db.run(`INSERT INTO orders (id, customer_contact, status, created_at, updated_at, order_data) VALUES (?, ?, ?, ?, ?, ?)`, [id, data.customer_contact, data.status || "choose_language", now, now, orderData]);
    return { id, ...data };
}
async function updateOrder(orderId, patch) {
    logger_1.logger.info(`Updating order ${orderId} with keys: ${Object.keys(patch).join(', ')}`);
    const updates = [];
    const params = [];
    const dataPatch = {};
    const columnMap = {
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
        if (value === undefined)
            continue;
        const column = columnMap[key];
        if (column) {
            updates.push(`${column} = ?`);
            if (key === "vehicle_data" || key === "scrape_result") {
                params.push(typeof value === "string" ? value : JSON.stringify(value));
            }
            else {
                params.push(value);
            }
        }
        else {
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
async function updateOrderData(orderId, data) {
    // Atomic JSONB merge — avoids Read-Modify-Write race condition
    try {
        const { runRaw } = await Promise.resolve().then(() => __importStar(require('../core/database')));
        await runRaw(`UPDATE orders SET order_data = COALESCE(order_data, '{}')::jsonb || $1::jsonb WHERE id = $2`, [JSON.stringify(data), String(orderId)]);
    }
    catch (err) {
        // Fallback for environments without JSONB support (e.g., SQLite in tests)
        logger_1.logger.warn('Atomic JSONB merge failed, falling back to read-modify-write', { error: err?.message });
        const order = await getDbOrder(orderId);
        if (!order)
            return;
        const existingData = parseJsonField(order.order_data, {});
        const newData = { ...existingData, ...data };
        await db.run(`UPDATE orders SET order_data = ? WHERE id = ?`, [JSON.stringify(newData), String(orderId)]);
    }
}
async function getVehicleForOrder(orderId) {
    const order = await getDbOrder(orderId);
    if (!order || !order.vehicle_data)
        return null;
    return parseJsonField(order.vehicle_data, null);
}
async function upsertVehicleForOrderFromPartial(orderId, partial) {
    const current = await getVehicleForOrder(orderId) || {};
    const updated = { ...current, ...partial };
    await db.run(`UPDATE orders SET vehicle_data = ? WHERE id = ?`, [JSON.stringify(updated), String(orderId)]);
}
async function updateOrderOEM(orderId, payload) {
    const current = await getDbOrder(orderId);
    if (!current)
        return;
    const updates = [];
    const params = [];
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
async function listShopOffersByOrderId(orderId) {
    const rows = await db.all(`SELECT * FROM shop_offers WHERE order_id = ?`, [String(orderId)]);
    return rows.map(r => ({ ...parseJsonField(r.data, {}), oem: r.oem, id: r.id }));
}
async function insertShopOffers(orderId, oem, offers) {
    logger_1.logger.info(`Inserting ${offers.length} offers for order ${orderId}`);
    const now = new Date().toISOString();
    for (const offer of offers) {
        await db.run(`INSERT INTO shop_offers (order_id, oem, data, inserted_at) VALUES (?, ?, ?, ?)`, [orderId, oem, JSON.stringify(offer), now]);
    }
    return offers;
}
async function getOrderById(orderId) {
    const row = await getDbOrder(orderId);
    if (!row)
        return null;
    return parseOrderRow(row);
}
async function updateOrderStatus(orderId, status) {
    await db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, String(orderId)]);
}
async function persistScrapeResult(orderId, result) {
    await db.run(`UPDATE orders SET scrape_result = ? WHERE id = ?`, [JSON.stringify(result), String(orderId)]);
}
async function listActiveOrdersByContact(from) {
    const rows = await db.all(`SELECT * FROM orders WHERE customer_contact = ? AND status != 'done'`, [from]);
    return rows.map(parseOrderRow);
}
async function persistOemMetadata(orderId, meta) {
    await updateOrderData(orderId, { oem_metadata: meta });
}
async function updateOrderScrapeTask(orderId, payload) {
    await updateOrderData(orderId, { scrape_task: payload });
}
async function listOrders() {
    const rows = await db.all(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 100`);
    return rows.map(parseOrderRow);
}
async function getMerchantSettings(merchantId) {
    const row = await db.get(`SELECT settings FROM merchant_settings WHERE merchant_id = ?`, [merchantId]);
    if (row) {
        const settings = parseJsonField(row.settings, {});
        return { merchantId, selectedShops: [], marginPercent: 0, allowDirectDelivery: false, ...settings };
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
async function upsertMerchantSettings(merchantId, settings) {
    const current = await getMerchantSettings(merchantId);
    const updated = { ...current, ...settings };
    await db.run(`INSERT INTO merchant_settings (merchant_id, settings) VALUES (?, ?) ON CONFLICT(merchant_id) DO UPDATE SET settings = excluded.settings`, [merchantId, JSON.stringify(updated)]);
    return true;
}
async function saveDeliveryAddress(orderId, address) {
    await updateOrderData(orderId, { deliveryAddress: address });
}
async function listSuppliers(tenantId, params) {
    let sql = `SELECT * FROM companies WHERE is_supplier = TRUE`;
    const queryParams = [];
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
    const rows = await db.all(sql, queryParams);
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
async function getSupplierById(tenantId, id) {
    const row = await db.get(`SELECT * FROM companies WHERE id = ? AND is_supplier = TRUE`, [String(id)]);
    if (!row)
        return null;
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
async function createSupplier(tenantId, data) {
    const id = (0, crypto_1.randomUUID)();
    const now = new Date().toISOString();
    const isActive = data.status === 'active' || data.active !== false;
    await db.run(`INSERT INTO companies (
            id, name, contact_person, email, phone, address, website, notes,
            is_supplier, active, payment_terms, tenant_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?, ?, ?)`, [
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
    ]);
    return getSupplierById(tenantId, id);
}
async function updateSupplier(tenantId, id, patch) {
    const updates = [];
    const params = [];
    if (patch.name !== undefined) {
        updates.push("name = ?");
        params.push(patch.name);
    }
    if (patch.contact_person !== undefined) {
        updates.push("contact_person = ?");
        params.push(patch.contact_person);
    }
    if (patch.email !== undefined) {
        updates.push("email = ?");
        params.push(patch.email);
    }
    if (patch.phone !== undefined) {
        updates.push("phone = ?");
        params.push(patch.phone);
    }
    if (patch.address !== undefined) {
        updates.push("address = ?");
        params.push(patch.address);
    }
    if (patch.website !== undefined) {
        updates.push("website = ?");
        params.push(patch.website);
    }
    if (patch.notes !== undefined) {
        updates.push("notes = ?");
        params.push(patch.notes);
    }
    if (patch.payment_terms !== undefined) {
        updates.push("payment_terms = ?");
        params.push(patch.payment_terms);
    }
    // Handle active status - prioritize patch.active, fallback to patch.status
    if (patch.active !== undefined) {
        updates.push("active = ?");
        params.push(patch.active);
    }
    else if (patch.status !== undefined) {
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
async function deleteSupplier(tenantId, id) {
    await db.run(`DELETE FROM companies WHERE id = ? AND is_supplier = TRUE`, [String(id)]);
}
async function listOffers(orderId) {
    let rows;
    if (orderId) {
        rows = await db.all(`SELECT * FROM shop_offers WHERE order_id = ? ORDER BY inserted_at DESC`, [String(orderId)]);
    }
    else {
        rows = await db.all(`SELECT * FROM shop_offers ORDER BY inserted_at DESC LIMIT 100`);
    }
    return rows.map(r => ({
        id: r.id,
        orderId: r.order_id,
        oem: r.oem,
        ...parseJsonField(r.data, {}),
        insertedAt: r.inserted_at
    }));
}
async function getOfferById(id) {
    const row = await db.get(`SELECT * FROM shop_offers WHERE id = ?`, [id]);
    if (!row)
        return null;
    return {
        id: row.id,
        orderId: row.order_id,
        oem: row.oem,
        ...parseJsonField(row.data, {}),
        insertedAt: row.inserted_at
    };
}
// Helpers
async function getDbOrder(id) {
    return await db.get(`SELECT * FROM orders WHERE id = ?`, [String(id)]);
}
function parseOrderRow(row) {
    const data = parseJsonField(row.order_data, {});
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
async function getParts(tenantId, params = {}) {
    let sql = `SELECT * FROM parts WHERE 1=1`;
    const queryParams = [];
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
    const rows = await db.all(sql, queryParams);
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
async function getPartById(tenantId, partId) {
    const row = await db.get(`SELECT * FROM parts WHERE id = ?`, [String(partId)]);
    if (!row)
        throw new Error("Part not found");
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
async function createPart(tenantId, data) {
    // Insert
    await db.run(`INSERT INTO parts (name, description, oem_number, stock, category, location, ipn, manufacturer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [data.name, data.description || '', data.oe_number || '', data.stock || 0, data.category || '', data.location || '', data.IPN || '', data.manufacturer || '']);
    // Get last inserted
    // Since we don't have returning, we fetch by name/oem or just basic last_insert_rowid (db.run context)
    // For simplicity, just return input with a fake ID or query last
    const row = await db.get(`SELECT * FROM parts ORDER BY id DESC LIMIT 1`);
    return getPartById(tenantId, row.id);
}
async function updatePart(tenantId, partId, patch) {
    // Build update query
    const updates = [];
    const params = [];
    if (patch.name !== undefined) {
        updates.push("name = ?");
        params.push(patch.name);
    }
    if (patch.description !== undefined) {
        updates.push("description = ?");
        params.push(patch.description);
    }
    if (patch.stock !== undefined) {
        updates.push("stock = ?");
        params.push(patch.stock);
    }
    if (patch.location !== undefined) {
        updates.push("location = ?");
        params.push(patch.location);
    }
    if (updates.length > 0) {
        const sql = `UPDATE parts SET ${updates.join(', ')} WHERE id = ?`;
        params.push(String(partId));
        await db.run(sql, params);
    }
    return getPartById(tenantId, partId);
}
async function processStockAction(tenantId, partId, action, quantity) {
    const part = await getPartById(tenantId, partId);
    let newStock = part.stock || 0;
    if (action === 'add')
        newStock += quantity;
    if (action === 'remove')
        newStock -= quantity;
    if (action === 'count')
        newStock = quantity;
    if (newStock < 0)
        newStock = 0; // Prevent negative
    await db.run(`UPDATE parts SET stock = ? WHERE id = ?`, [newStock, String(part.pk)]);
    return {
        ...part,
        stock: newStock
    };
}
function parseCompanyRow(row) {
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
async function createCompany(company) {
    await db.run(`INSERT INTO companies (name, description, website, email, phone, is_customer, is_supplier, active, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [company.name, company.description || '', company.website || '', company.email || '', company.phone || '', company.is_customer, company.is_supplier, company.active, JSON.stringify(company.metadata || {})]);
    const row = await db.get(`SELECT * FROM companies ORDER BY id DESC LIMIT 1`);
    return parseCompanyRow(row);
}
async function getCompanies(params = {}) {
    let sql = `SELECT * FROM companies WHERE 1=1`;
    const qp = [];
    if (params.is_customer !== undefined) {
        sql += ` AND is_customer = ?`;
        qp.push(params.is_customer);
    }
    if (params.is_supplier !== undefined) {
        sql += ` AND is_supplier = ?`;
        qp.push(params.is_supplier);
    }
    if (params.active !== undefined) {
        sql += ` AND active = ?`;
        qp.push(params.active);
    }
    if (params.search) {
        sql += ` AND name LIKE ?`;
        qp.push(`%${params.search}%`);
    }
    // Sort
    sql += ` ORDER BY id DESC LIMIT 100`;
    const rows = await db.all(sql, qp);
    return rows.map(parseCompanyRow);
}
async function updateCompany(id, patch) {
    const updates = [];
    const params = [];
    if (patch.name !== undefined) {
        updates.push("name = ?");
        params.push(patch.name);
    }
    if (patch.description !== undefined) {
        updates.push("description = ?");
        params.push(patch.description);
    }
    if (patch.website !== undefined) {
        updates.push("website = ?");
        params.push(patch.website);
    }
    if (patch.email !== undefined) {
        updates.push("email = ?");
        params.push(patch.email);
    }
    if (patch.phone !== undefined) {
        updates.push("phone = ?");
        params.push(patch.phone);
    }
    if (patch.is_customer !== undefined) {
        updates.push("is_customer = ?");
        params.push(patch.is_customer);
    }
    if (patch.metadata !== undefined) {
        updates.push("metadata = ?");
        params.push(JSON.stringify(patch.metadata));
    }
    if (updates.length > 0) {
        const sql = `UPDATE companies SET ${updates.join(', ')} WHERE id = ?`;
        params.push(String(id));
        await db.run(sql, params);
    }
    const row = await db.get(`SELECT * FROM companies WHERE id = ?`, [id]);
    if (!row)
        throw new Error("Company not found");
    return parseCompanyRow(row);
}
// --------------------------------------------------------------------------
// Stock Movements (Mock/Stub)
// --------------------------------------------------------------------------
async function getStockMovements(tenantId, filters = {}) {
    let sql = `SELECT sm.*, p.name as part_name FROM stock_movements sm LEFT JOIN parts p ON sm.part_id = p.id WHERE sm.tenant_id = ?`;
    const params = [tenantId];
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
    }
    else {
        sql += ` ORDER BY sm.created_at DESC LIMIT 50`;
    }
    const rows = await db.all(sql, params);
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
async function createStockMovement(tenantId, data) {
    const id = (0, crypto_1.randomUUID)();
    const now = new Date().toISOString();
    await db.run(`INSERT INTO stock_movements (
            id, part_id, type, quantity, from_location_id, to_location_id,
            reference, notes, tenant_id, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
    ]);
    return {
        id,
        ...data,
        created_at: now
    };
}
async function getStockLocations(tenantId) {
    const rows = await db.all(`SELECT * FROM stock_locations WHERE (tenant_id = ? OR tenant_id = 'global') AND active = TRUE ORDER BY name ASC`, [tenantId]);
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
async function receiveGoods(tenantId, data) {
    // Mock implementation
    logger_1.logger.info(`Mock: Receiving goods for tenant ${tenantId}:`, data);
    return {
        success: true,
        ...data,
        received_at: new Date().toISOString()
    };
}
// --------------------------------------------------------------------------
// Purchase Orders (Mock/Stub)
// --------------------------------------------------------------------------
async function getPurchaseOrders(tenantId, filters = {}) {
    let sql = `SELECT po.*, c.name as supplier_name FROM purchase_orders po LEFT JOIN companies c ON po.supplier_id = c.id WHERE po.tenant_id = ?`;
    const params = [tenantId];
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
    const rows = await db.all(sql, params);
    const orders = [];
    for (const row of rows) {
        // Get items for this PO
        const items = await db.all(`SELECT * FROM purchase_order_items WHERE purchase_order_id = ?`, [row.id]);
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
async function getPurchaseOrderById(tenantId, id) {
    const row = await db.get(`SELECT po.*, c.name as supplier_name FROM purchase_orders po LEFT JOIN companies c ON po.supplier_id = c.id WHERE po.id = ? AND po.tenant_id = ?`, [String(id), tenantId]);
    if (!row)
        return null;
    const items = await db.all(`SELECT * FROM purchase_order_items WHERE purchase_order_id = ?`, [row.id]);
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
async function createPurchaseOrder(tenantId, data) {
    const id = (0, crypto_1.randomUUID)();
    const now = new Date().toISOString();
    const orderNumber = `PO-${Date.now()}`;
    // Initially create order with 0 total_amount (will update after items are inserted)
    await db.run(`INSERT INTO purchase_orders (
            id, order_number, supplier_id, status, order_date, expected_delivery,
            total_amount, currency, notes, tenant_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
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
    ]);
    // Insert items and calculate total_amount correctly
    let totalAmount = 0;
    if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
            const itemId = (0, crypto_1.randomUUID)();
            // Fetch part_name from parts table if part_id is provided but part_name is missing
            let partName = item.part_name;
            if (!partName && item.part_id) {
                const part = await db.get('SELECT name FROM parts WHERE id = ?', [item.part_id]);
                partName = part?.name || `Part ${item.part_id}`;
            }
            // If still no part_name, use a default based on part_id or fallback
            if (!partName) {
                partName = item.part_id ? `Part ${item.part_id}` : 'Unknown Part';
            }
            // Calculate total_price for this item
            const itemTotalPrice = item.total_price || (item.quantity * item.unit_price);
            totalAmount += itemTotalPrice;
            await db.run(`INSERT INTO purchase_order_items (
                    id, purchase_order_id, part_id, part_name, part_ipn,
                    quantity, unit_price, total_price, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                itemId,
                id,
                item.part_id || null,
                partName,
                item.part_ipn || null,
                item.quantity,
                item.unit_price,
                itemTotalPrice,
                now
            ]);
        }
    }
    // Update purchase_order with correct total_amount
    await db.run(`UPDATE purchase_orders SET total_amount = ? WHERE id = ?`, [totalAmount, id]);
    return getPurchaseOrderById(tenantId, id);
}
async function updatePurchaseOrder(tenantId, id, patch) {
    const updates = [];
    const params = [];
    if (patch.status !== undefined) {
        updates.push("status = ?");
        params.push(patch.status);
    }
    if (patch.expected_delivery !== undefined) {
        updates.push("expected_delivery = ?");
        params.push(patch.expected_delivery);
    }
    if (patch.notes !== undefined) {
        updates.push("notes = ?");
        params.push(patch.notes);
    }
    updates.push("updated_at = ?");
    params.push(new Date().toISOString());
    if (updates.length > 1) { // more than just updated_at
        const sql = `UPDATE purchase_orders SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`;
        params.push(String(id), tenantId);
        await db.run(sql, params);
    }
    return getPurchaseOrderById(tenantId, String(id));
}
async function cancelPurchaseOrder(tenantId, id) {
    await db.run(`UPDATE purchase_orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND tenant_id = ?`, [new Date().toISOString(), String(id), tenantId]);
}
async function receivePurchaseOrder(tenantId, poId, data) {
    logger_1.logger.info(`Mock: Receiving purchase order ${poId} for tenant ${tenantId}:`, data);
    return {
        success: true,
        po_id: poId,
        ...data,
        received_at: new Date().toISOString()
    };
}
async function getReorderSuggestions(tenantId) {
    logger_1.logger.info(`Mock: Getting reorder suggestions for tenant ${tenantId}`);
    return [];
}
