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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSuppliers = exports.getSupplierById = exports.getOfferById = exports.listOffers = exports.upsertMerchantSettings = exports.getMerchantSettings = exports.listOrders = exports.findOrCreateOrder = exports.listActiveOrdersByContact = exports.listShopOffersByOrderId = exports.getVehicleForOrder = exports.testDbConnection = void 0;
exports.insertOrder = insertOrder;
exports.updateOrder = updateOrder;
exports.getOrderById = getOrderById;
exports.updateOrderData = updateOrderData;
exports.insertMessage = insertMessage;
exports.upsertVehicleForOrderFromPartial = upsertVehicleForOrderFromPartial;
exports.updateOrderOEM = updateOrderOEM;
exports.insertShopOffers = insertShopOffers;
exports.updateOrderStatus = updateOrderStatus;
exports.persistScrapeResult = persistScrapeResult;
exports.persistOemMetadata = persistOemMetadata;
exports.updateOrderScrapeTask = updateOrderScrapeTask;
exports.saveDeliveryAddress = saveDeliveryAddress;
exports.upsertConversationState = upsertConversationState;
exports.createCompany = createCompany;
exports.getCompanies = getCompanies;
exports.updateCompany = updateCompany;
exports.getParts = getParts;
exports.createPart = createPart;
exports.getPartById = getPartById;
exports.updatePart = updatePart;
exports.processStockAction = processStockAction;
exports.createInvoice = createInvoice;
exports.findPartByOem = findPartByOem;
exports.deductStock = deductStock;
const localAdapter = __importStar(require("../adapters/inventreeAdapter"));
const axios_1 = __importDefault(require("axios"));
const dotenv = __importStar(require("dotenv"));
const logger_1 = require("@utils/logger");
dotenv.config();
const BASE_URL = process.env.INVENTREE_BASE_URL;
const API_TOKEN = process.env.INVENTREE_API_TOKEN;
// Permissive Agent for Render/Dev environments
// const httpsAgent = new https.Agent({ rejectUnauthorized: false }); // REMOVED FOR SECURITY
// API Client for WWS
const api = axios_1.default.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Token ${API_TOKEN}`,
        'Content-Type': 'application/json'
    },
    timeout: 5000,
    // httpsAgent // Removed
});
// Pass-through READS (Local SQLite is source of truth for speed)
exports.testDbConnection = localAdapter.testDbConnection;
exports.getVehicleForOrder = localAdapter.getVehicleForOrder;
exports.listShopOffersByOrderId = localAdapter.listShopOffersByOrderId;
exports.listActiveOrdersByContact = localAdapter.listActiveOrdersByContact;
exports.findOrCreateOrder = localAdapter.findOrCreateOrder;
exports.listOrders = localAdapter.listOrders;
exports.getMerchantSettings = localAdapter.getMerchantSettings;
exports.upsertMerchantSettings = localAdapter.upsertMerchantSettings;
exports.listOffers = localAdapter.listOffers;
exports.getOfferById = localAdapter.getOfferById;
exports.getSupplierById = localAdapter.getSupplierById;
exports.listSuppliers = localAdapter.listSuppliers;
// Helper to push state to InvenTree
// Helper to push state to InvenTree
async function syncToWWS(orderId) {
    if (!BASE_URL || !API_TOKEN) {
        return;
    }
    try {
        const order = await localAdapter.getOrderById(orderId);
        if (!order)
            return;
        // Determine Tenant for this Order
        // 1. Check order metadata
        // 2. Default to 'public' or logic-based tenant
        // Assumption: 'metadata.tenant_id' is stored on the order locally
        const tenantId = order.metadata?.tenant_id || "public";
        const payload = {
            id: String(order.id),
            status: order.status,
            payload: {
                ...order,
                synced_at: new Date().toISOString()
            }
        };
        // Fire and forget with Tenant Context
        api.post(`/ext/orders/${order.id}/`, payload, {
            headers: {
                'X-Tenant-ID': tenantId
            }
        })
            .then(() => logger_1.logger.info(`Synced order ${order.id} to WWS (Tenant: ${tenantId})`))
            .catch(err => logger_1.logger.warn(`WWS Sync failed for ${order.id}: ${err.message}`));
    }
    catch (error) {
        logger_1.logger.error(`Error preparing WWS sync for ${orderId}: ${error.message}`);
    }
}
// Intercept WRITES to trigger sync
async function insertOrder(data) {
    const result = await localAdapter.insertOrder(data);
    await syncToWWS(result.id);
    return result;
}
async function updateOrder(orderId, patch) {
    const result = await localAdapter.updateOrder(orderId, patch);
    await syncToWWS(orderId);
    return result;
}
async function getOrderById(orderId) {
    // 1. Try Local SQLite (Cache)
    const local = await localAdapter.getOrderById(orderId);
    if (local)
        return local;
    // 2. Fallback: Try InvenTree API (Source of Truth)
    try {
        const response = await api.get(`/ext/orders/${orderId}/`);
        if (response.data && response.data.payload) {
            // Restore to local cache so subsequent reads are fast
            await localAdapter.insertOrder({
                ...response.data.payload,
                // Ensure we don't overwrite if it somehow exists or handle conflict?
                // For now just insert, assuming it doesn't exist locally
            });
            return response.data.payload;
        }
    }
    catch (err) {
        if (err.response?.status === 404) {
            return null; // Not found in sync either
        }
        logger_1.logger.warn(`Failed to fetch order ${orderId} from WWS: ${err.message}`);
    }
    return null;
}
async function updateOrderData(orderId, data) {
    await localAdapter.updateOrderData(orderId, data);
    await syncToWWS(orderId);
}
async function insertMessage(waId, content, direction) {
    const result = await localAdapter.insertMessage(waId, content, direction);
    // Sync the conversation state (which changed)
    const order = await localAdapter.findOrCreateOrder(waId);
    if (order)
        await syncToWWS(order.id);
    return result;
}
async function upsertVehicleForOrderFromPartial(orderId, partial) {
    await localAdapter.upsertVehicleForOrderFromPartial(orderId, partial);
    await syncToWWS(orderId);
}
async function updateOrderOEM(orderId, payload) {
    await localAdapter.updateOrderOEM(orderId, payload);
    await syncToWWS(orderId);
}
async function insertShopOffers(orderId, oem, offers) {
    await localAdapter.insertShopOffers(orderId, oem, offers);
    await syncToWWS(orderId);
}
async function updateOrderStatus(orderId, status) {
    await localAdapter.updateOrderStatus(orderId, status);
    await syncToWWS(orderId);
}
async function persistScrapeResult(orderId, result) {
    await localAdapter.persistScrapeResult(orderId, result);
    await syncToWWS(orderId);
}
async function persistOemMetadata(orderId, meta) {
    await localAdapter.persistOemMetadata(orderId, meta);
    await syncToWWS(orderId);
}
async function updateOrderScrapeTask(orderId, payload) {
    await localAdapter.updateOrderScrapeTask(orderId, payload);
    await syncToWWS(orderId);
}
async function saveDeliveryAddress(orderId, address) {
    await localAdapter.saveDeliveryAddress(orderId, address);
    await syncToWWS(orderId);
}
async function upsertConversationState(waId, state) {
    const result = await localAdapter.upsertConversationState(waId, state);
    if (result && result.conversation) {
        await syncToWWS(result.conversation.id);
    }
    return result;
}
async function createCompany(company) {
    if (!BASE_URL || !API_TOKEN) {
        logger_1.logger.info("InvenTree not configured - using local mock for createCompany");
        return localAdapter.createCompany(company);
    }
    try {
        const response = await api.post('/api/company/', company);
        return response.data;
    }
    catch (error) {
        logger_1.logger.error(`Failed to create company: ${error.message}`);
        throw error;
    }
}
async function getCompanies(params = {}) {
    if (!BASE_URL || !API_TOKEN) {
        return localAdapter.getCompanies(params);
    }
    try {
        const response = await api.get('/api/company/', { params });
        return response.data;
    }
    catch (error) {
        logger_1.logger.error(`Failed to fetch companies: ${error.message}`);
        return [];
    }
}
async function updateCompany(id, patch) {
    if (!BASE_URL || !API_TOKEN) {
        return localAdapter.updateCompany(id, patch);
    }
    try {
        const response = await api.patch(`/api/company/${id}/`, patch);
        return response.data;
    }
    catch (error) {
        logger_1.logger.error(`Failed to update company ${id}: ${error.message}`);
        throw error;
    }
}
// --------------------------------------------------------------------------
// Product Management (Tenant Isolation Logic via Schema)
// --------------------------------------------------------------------------
// Helper to secure headers
function getTenantHeaders(tenantId) {
    return {
        'X-Tenant-ID': tenantId,
        'X-Tenant-Override': tenantId // For our middleware
    };
}
// --------------------------------------------------------------------------
// Part Management
// --------------------------------------------------------------------------
async function getParts(tenantId, params = {}) {
    // Strictly rely on Schema Isolation via Headers
    const response = await api.get('/api/part/', {
        params,
        headers: getTenantHeaders(tenantId)
    });
    return response.data;
}
async function createPart(tenantId, data) {
    if (!tenantId)
        throw new Error("Tenant ID required for creation");
    const secureData = {
        ...data,
        active: true,
        // No forced category - goes to root of Tenant Schema
    };
    // Schema isolation ensures this is written to the correct tenant validation
    const response = await api.post('/api/part/', secureData, {
        headers: getTenantHeaders(tenantId)
    });
    return response.data;
}
async function getPartById(tenantId, partId) {
    // 1. Fetch Part (Schema Isolated)
    try {
        const response = await api.get(`/api/part/${partId}/`, {
            headers: getTenantHeaders(tenantId)
        });
        return response.data;
    }
    catch (error) {
        if (error.response?.status === 404) {
            throw new Error("Part not found (or access denied)");
        }
        throw error;
    }
}
async function updatePart(tenantId, partId, patch) {
    // Schema ensures pkey lookup only works for this tenant
    const response = await api.patch(`/api/part/${partId}/`, patch, {
        headers: getTenantHeaders(tenantId)
    });
    return response.data;
}
// --------------------------------------------------------------------------
// Stock Management (Classic WWS)
// --------------------------------------------------------------------------
async function processStockAction(tenantId, partId, action, quantity) {
    // 1. Find Stock Item for this Part (in this Tenant Context)
    // We assume 1 main stock item per part for this simple dashboard
    let stockItem = await getStockItemForPart(tenantId, partId);
    if (!stockItem) {
        if (action === 'remove')
            throw new Error("Kein Bestand vorhanden zum Entfernen.");
        // Create initial stock item
        stockItem = await createStockItem(tenantId, partId, 0);
    }
    const stockId = stockItem.pk;
    // 2. Perform Action
    if (action === 'count') {
        // Stocktaking (Set absolute value)
        // InvenTree uses /stock/count/ or simple PATCH quantity?
        // Simple PATCH is easier if we trust the absolute value
        const response = await api.patch(`/api/stock/${stockId}/`, { quantity }, {
            headers: getTenantHeaders(tenantId)
        });
        return response.data;
    }
    if (action === 'add' || action === 'remove') {
        // Use Transaction Endpoints
        const endpoint = action === 'add' ? 'add' : 'remove';
        const response = await api.post(`/api/stock/${endpoint}/`, {
            items: [
                {
                    pk: stockId,
                    quantity: quantity,
                    notes: "Dashboard Adjustment"
                }
            ]
        }, {
            headers: getTenantHeaders(tenantId)
        });
        // Response might be a status or list, we return the updated stock item
        return getStockItemById(tenantId, stockId);
    }
}
async function getStockItemForPart(tenantId, partId) {
    const response = await api.get('/api/stock/', {
        params: { part: partId },
        headers: getTenantHeaders(tenantId)
    });
    // Return first item (FIFO/LIFO doesn't matter for simple mode)
    return response.data[0] || null;
}
async function getStockItemById(tenantId, stockId) {
    const response = await api.get(`/api/stock/${stockId}/`, {
        headers: getTenantHeaders(tenantId)
    });
    return response.data;
}
async function createStockItem(tenantId, partId, quantity) {
    const response = await api.post('/api/stock/', {
        part: partId,
        quantity: quantity,
        // In InvenTree, location is often required. We might need a default location?
        // For now try without, or we need to ensure a default location exists.
        // If error "location required", we fix it.
    }, {
        headers: getTenantHeaders(tenantId)
    });
    return response.data;
}
// --------------------------------------------------------------------------
// Billing / Invoice Integration
// --------------------------------------------------------------------------
async function createInvoice(orderId) {
    if (!BASE_URL || !API_TOKEN)
        throw new Error("InvenTree not configured");
    try {
        const response = await api.post('/api/billing/invoices/', {
            order: orderId
        });
        return response.data;
    }
    catch (error) {
        // If 400 and says "already exists", fetch and return it?
        // For now, let it fail or log
        logger_1.logger.error(`Failed to create invoice for order ${orderId}: ${error.message}`);
        throw error;
    }
}
// --------------------------------------------------------------------------
// Omni-Channel Stock Sync (Phase 10)
// --------------------------------------------------------------------------
async function findPartByOem(tenantId, oem) {
    if (!oem)
        return null;
    try {
        // Search parts by OEM string
        const response = await api.get('/api/part/', {
            params: { search: oem, limit: 1 },
            headers: getTenantHeaders(tenantId)
        });
        const results = response.data.results || response.data;
        return results[0] || null;
    }
    catch (error) {
        // NotFound is acceptable, just return null
        return null;
    }
}
async function deductStock(tenantId, partId, quantity) {
    return processStockAction(tenantId, partId, 'remove', quantity);
}
