import * as localAdapter from '../adapters/inventreeAdapter';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { logger } from '@utils/logger';

import https from 'https';

dotenv.config();

const BASE_URL = process.env.INVENTREE_BASE_URL;
const API_TOKEN = process.env.INVENTREE_API_TOKEN;

// Permissive Agent for Render/Dev environments
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// API Client for WWS
const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Token ${API_TOKEN}`,
        'Content-Type': 'application/json'
    },
    timeout: 5000,
    httpsAgent
});

// Pass-through READS (Local SQLite is source of truth for speed)
export const testDbConnection = localAdapter.testDbConnection;

export const getVehicleForOrder = localAdapter.getVehicleForOrder;
export const listShopOffersByOrderId = localAdapter.listShopOffersByOrderId;
export const listActiveOrdersByContact = localAdapter.listActiveOrdersByContact;
export const findOrCreateOrder = localAdapter.findOrCreateOrder;
export const listOrders = localAdapter.listOrders;
export const getMerchantSettings = localAdapter.getMerchantSettings;
export const upsertMerchantSettings = localAdapter.upsertMerchantSettings;
export const listOffers = localAdapter.listOffers;
export const getOfferById = localAdapter.getOfferById;
export const getSupplierById = localAdapter.getSupplierById;
export const listSuppliers = localAdapter.listSuppliers;

// Helper to push state to InvenTree
// Helper to push state to InvenTree
async function syncToWWS(orderId: string | number) {
    if (!BASE_URL || !API_TOKEN) {
        return;
    }

    try {
        const order = await localAdapter.getOrderById(orderId);
        if (!order) return;

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
            .then(() => logger.info(`Synced order ${order.id} to WWS (Tenant: ${tenantId})`))
            .catch(err => logger.warn(`WWS Sync failed for ${order.id}: ${err.message}`));

    } catch (error: any) {
        logger.error(`Error preparing WWS sync for ${orderId}: ${error.message}`);
    }
}

// Intercept WRITES to trigger sync
export async function insertOrder(data: any) {
    const result = await localAdapter.insertOrder(data);
    await syncToWWS(result.id);
    return result;
}

export async function updateOrder(orderId: string | number, patch: any) {
    const result = await localAdapter.updateOrder(orderId, patch);
    await syncToWWS(orderId);
    return result;
}

export async function getOrderById(orderId: string) {
    // 1. Try Local SQLite (Cache)
    const local = await localAdapter.getOrderById(orderId);
    if (local) return local;

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
    } catch (err: any) {
        if (err.response?.status === 404) {
            return null; // Not found in sync either
        }
        logger.warn(`Failed to fetch order ${orderId} from WWS: ${err.message}`);
    }
    return null;
}

export async function updateOrderData(orderId: string | number, data: any) {
    await localAdapter.updateOrderData(orderId, data);
    await syncToWWS(orderId);
}

export async function insertMessage(waId: string, content: string, direction: 'IN' | 'OUT') {
    const result = await localAdapter.insertMessage(waId, content, direction);
    // Sync the conversation state (which changed)
    const order = await localAdapter.findOrCreateOrder(waId);
    if (order) await syncToWWS(order.id);
    return result;
}

export async function upsertVehicleForOrderFromPartial(orderId: string | number, partial: any) {
    await localAdapter.upsertVehicleForOrderFromPartial(orderId, partial);
    await syncToWWS(orderId);
}

export async function updateOrderOEM(orderId: string | number, payload: any) {
    await localAdapter.updateOrderOEM(orderId, payload);
    await syncToWWS(orderId);
}

export async function insertShopOffers(orderId: string, oem: string, offers: any[]) {
    await localAdapter.insertShopOffers(orderId, oem, offers);
    await syncToWWS(orderId);
}

export async function updateOrderStatus(orderId: string | number, status: string) {
    await localAdapter.updateOrderStatus(orderId, status);
    await syncToWWS(orderId);
}

export async function persistScrapeResult(orderId: string | number, result: any) {
    await localAdapter.persistScrapeResult(orderId, result);
    await syncToWWS(orderId);
}

export async function persistOemMetadata(orderId: string, meta: any) {
    await localAdapter.persistOemMetadata(orderId, meta);
    await syncToWWS(orderId);
}

export async function updateOrderScrapeTask(orderId: string, payload: any) {
    await localAdapter.updateOrderScrapeTask(orderId, payload);
    await syncToWWS(orderId);
}

export async function saveDeliveryAddress(orderId: string | number, address: string) {
    await localAdapter.saveDeliveryAddress(orderId, address);
    await syncToWWS(orderId);
}

export async function upsertConversationState(waId: string, state: any) {
    const result = await localAdapter.upsertConversationState(waId, state);
    if (result && result.conversation) {
        await syncToWWS(result.conversation.id);
    }
    return result;
}

// --------------------------------------------------------------------------
// CRM / Company Integration (InvenTree)
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

export async function createCompany(company: InvenTreeCompany) {
    if (!BASE_URL || !API_TOKEN) {
        logger.info("InvenTree not configured - using local mock for createCompany");
        return localAdapter.createCompany(company);
    }
    try {
        const response = await api.post('/api/company/', company);
        return response.data;
    } catch (error: any) {
        logger.error(`Failed to create company: ${error.message}`);
        throw error;
    }
}

export async function getCompanies(params: { is_customer?: boolean, is_supplier?: boolean, search?: string, active?: boolean } = {}) {
    if (!BASE_URL || !API_TOKEN) {
        return localAdapter.getCompanies(params);
    }
    try {
        const response = await api.get('/api/company/', { params });
        return response.data;
    } catch (error: any) {
        logger.error(`Failed to fetch companies: ${error.message}`);
        return [];
    }
}

export async function updateCompany(id: number, patch: Partial<InvenTreeCompany>) {
    if (!BASE_URL || !API_TOKEN) {
        return localAdapter.updateCompany(id, patch);
    }
    try {
        const response = await api.patch(`/api/company/${id}/`, patch);
        return response.data;
    } catch (error: any) {
        logger.error(`Failed to update company ${id}: ${error.message}`);
        throw error;
    }
}

// --------------------------------------------------------------------------
// Product Management (Tenant Isolation Logic via Schema)
// --------------------------------------------------------------------------

// Helper to secure headers
function getTenantHeaders(tenantId: string) {
    return {
        'X-Tenant-ID': tenantId,
        'X-Tenant-Override': tenantId // For our middleware
    };
}

// --------------------------------------------------------------------------
// Part Management
// --------------------------------------------------------------------------

export async function getParts(tenantId: string, params: any = {}) {
    // Strictly rely on Schema Isolation via Headers
    const response = await api.get('/api/part/', {
        params,
        headers: getTenantHeaders(tenantId)
    });
    return response.data;
}

export async function createPart(tenantId: string, data: any) {
    if (!tenantId) throw new Error("Tenant ID required for creation");

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

export async function getPartById(tenantId: string, partId: string | number) {
    // 1. Fetch Part (Schema Isolated)
    try {
        const response = await api.get(`/api/part/${partId}/`, {
            headers: getTenantHeaders(tenantId)
        });
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 404) {
            throw new Error("Part not found (or access denied)");
        }
        throw error;
    }
}

export async function updatePart(tenantId: string, partId: string | number, patch: any) {
    // Schema ensures pkey lookup only works for this tenant
    const response = await api.patch(`/api/part/${partId}/`, patch, {
        headers: getTenantHeaders(tenantId)
    });
    return response.data;
}

// --------------------------------------------------------------------------
// Stock Management (Classic WWS)
// --------------------------------------------------------------------------

export async function processStockAction(tenantId: string, partId: string | number, action: 'add' | 'remove' | 'count', quantity: number) {
    // 1. Find Stock Item for this Part (in this Tenant Context)
    // We assume 1 main stock item per part for this simple dashboard
    let stockItem = await getStockItemForPart(tenantId, partId);

    if (!stockItem) {
        if (action === 'remove') throw new Error("Kein Bestand vorhanden zum Entfernen.");
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

async function getStockItemForPart(tenantId: string, partId: string | number) {
    const response = await api.get('/api/stock/', {
        params: { part: partId },
        headers: getTenantHeaders(tenantId)
    });
    // Return first item (FIFO/LIFO doesn't matter for simple mode)
    return response.data[0] || null;
}

async function getStockItemById(tenantId: string, stockId: string | number) {
    const response = await api.get(`/api/stock/${stockId}/`, {
        headers: getTenantHeaders(tenantId)
    });
    return response.data;
}

async function createStockItem(tenantId: string, partId: string | number, quantity: number) {
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

export async function createInvoice(orderId: string | number) {
    if (!BASE_URL || !API_TOKEN) throw new Error("InvenTree not configured");
    try {
        const response = await api.post('/api/billing/invoices/', {
            order: orderId
        });
        return response.data;
    } catch (error: any) {
        // If 400 and says "already exists", fetch and return it?
        // For now, let it fail or log
        logger.error(`Failed to create invoice for order ${orderId}: ${error.message}`);
        throw error;
    }
}
// --------------------------------------------------------------------------
// Omni-Channel Stock Sync (Phase 10)
// --------------------------------------------------------------------------

export async function findPartByOem(tenantId: string, oem: string) {
    if (!oem) return null;
    try {
        // Search parts by OEM string
        const response = await api.get('/api/part/', {
            params: { search: oem, limit: 1 },
            headers: getTenantHeaders(tenantId)
        });
        const results = response.data.results || response.data;
        return results[0] || null;
    } catch (error: any) {
        // NotFound is acceptable, just return null
        return null;
    }
}

export async function deductStock(tenantId: string, partId: string | number, quantity: number) {
    return processStockAction(tenantId, partId, 'remove', quantity);
}
