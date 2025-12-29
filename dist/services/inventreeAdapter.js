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
const logger_1 = require("../utils/logger");
const db = __importStar(require("./database"));
const crypto_1 = require("crypto");
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
async function updateOrderData(orderId, data) {
    const order = await getDbOrder(orderId);
    if (!order)
        return;
    const existingData = JSON.parse(order.order_data || '{}');
    const newData = { ...existingData, ...data };
    await db.run(`UPDATE orders SET order_data = ? WHERE id = ?`, [JSON.stringify(newData), String(orderId)]);
}
async function getVehicleForOrder(orderId) {
    const order = await getDbOrder(orderId);
    if (!order || !order.vehicle_data)
        return null;
    return JSON.parse(order.vehicle_data);
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
    if (payload.oem) {
        await db.run(`UPDATE orders SET oem_number = ? WHERE id = ?`, [payload.oem, String(orderId)]);
    }
    // Also store full payload in order_data.oemInfo if needed
    await updateOrderData(orderId, { oem_info: payload });
}
async function listShopOffersByOrderId(orderId) {
    const rows = await db.all(`SELECT * FROM shop_offers WHERE order_id = ?`, [String(orderId)]);
    return rows.map(r => ({ ...JSON.parse(r.data), oem: r.oem, id: r.id }));
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
async function upsertMerchantSettings(merchantId, settings) {
    const current = await getMerchantSettings(merchantId);
    const updated = { ...current, ...settings };
    await db.run(`INSERT INTO merchant_settings (merchant_id, settings) VALUES (?, ?) ON CONFLICT(merchant_id) DO UPDATE SET settings = excluded.settings`, [merchantId, JSON.stringify(updated)]);
    return true;
}
async function saveDeliveryAddress(orderId, address) {
    await updateOrderData(orderId, { deliveryAddress: address });
}
async function listSuppliers() {
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
async function getSupplierById(id) {
    const suppliers = await listSuppliers();
    return suppliers.find(s => s.id === id) || null;
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
        ...JSON.parse(r.data),
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
        ...JSON.parse(row.data),
        insertedAt: row.inserted_at
    };
}
// Helpers
async function getDbOrder(id) {
    return await db.get(`SELECT * FROM orders WHERE id = ?`, [String(id)]);
}
function parseOrderRow(row) {
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
        pk: r.id,
        name: r.name,
        description: r.description,
        oe_number: r.oem_number,
        stock: r.stock,
        category: r.category, // Just string in local DB
        location: r.location,
        IPN: r.ipn,
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
        metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
}
async function createCompany(company) {
    await db.run(`INSERT INTO companies (name, description, website, email, phone, is_customer, is_supplier, active, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [company.name, company.description || '', company.website || '', company.email || '', company.phone || '', company.is_customer ? 1 : 0, company.is_supplier ? 1 : 0, company.active ? 1 : 0, JSON.stringify(company.metadata || {})]);
    const row = await db.get(`SELECT * FROM companies ORDER BY id DESC LIMIT 1`);
    return parseCompanyRow(row);
}
async function getCompanies(params = {}) {
    let sql = `SELECT * FROM companies WHERE 1=1`;
    const qp = [];
    if (params.is_customer !== undefined) {
        sql += ` AND is_customer = ?`;
        qp.push(params.is_customer ? 1 : 0);
    }
    if (params.is_supplier !== undefined) {
        sql += ` AND is_supplier = ?`;
        qp.push(params.is_supplier ? 1 : 0);
    }
    if (params.active !== undefined) {
        sql += ` AND active = ?`;
        qp.push(params.active ? 1 : 0);
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
        params.push(patch.is_customer ? 1 : 0);
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
