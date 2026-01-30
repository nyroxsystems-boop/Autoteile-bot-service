import * as localAdapter from '../adapters/inventreeAdapter';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { logger } from '@utils/logger';

import https from 'https';

dotenv.config();

const BASE_URL = process.env.INVENTREE_BASE_URL;
const API_TOKEN = process.env.INVENTREE_API_TOKEN;

// Permissive Agent for Render/Dev environments
// const httpsAgent = new https.Agent({ rejectUnauthorized: false }); // REMOVED FOR SECURITY

// API Client for WWS
const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
    },
    timeout: 5000,
    // httpsAgent // Removed
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
// Supplier methods are now handled by InvenTree API below

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
        logger.info(`Creating company in WAWI: ${JSON.stringify(company)}`);
        const response = await api.post('/api/company/', company);
        logger.info(`Company created successfully: ${JSON.stringify(response.data)}`);
        return response.data;
    } catch (error: any) {
        // Log the FULL error response from WAWI for debugging
        const wawiError = error.response?.data;
        logger.error(`Failed to create company: ${error.message}`);
        logger.error(`WAWI Response Status: ${error.response?.status}`);
        logger.error(`WAWI Response Data: ${JSON.stringify(wawiError)}`);
        logger.error(`Request Payload was: ${JSON.stringify(company)}`);
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

export async function getStockItemForPart(tenantId: string, partId: string | number) {
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

async function createStockItem(tenantId: string, partId: string | number, quantity: number, location?: number) {
    const payload: any = {
        part: partId,
        quantity: quantity
    };

    if (location) {
        payload.location = location;
    }

    const response = await api.post('/api/stock/', payload, {
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

// --------------------------------------------------------------------------
// Supplier Management (WAWI)
// --------------------------------------------------------------------------

export async function listSuppliers(tenantId: string, params: any = {}) {
    try {
        const response = await api.get('/api/company/', {
            params: {
                ...params,
                is_supplier: true
            },
            headers: getTenantHeaders(tenantId)
        });
        return response.data.results || response.data;
    } catch (error: any) {
        logger.error(`Failed to list suppliers for tenant ${tenantId}: ${error.message}`);
        return [];
    }
}

export async function getSupplierById(tenantId: string, id: string | number) {
    try {
        const response = await api.get(`/api/company/${id}/`, {
            headers: getTenantHeaders(tenantId)
        });
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 404) {
            return null;
        }
        logger.error(`Failed to get supplier ${id} for tenant ${tenantId}: ${error.message}`);
        throw error;
    }
}

export async function createSupplier(tenantId: string, data: any) {
    if (!tenantId) throw new Error("Tenant ID required for supplier creation");

    const supplierData = {
        name: data.name,
        description: data.description || '',
        website: data.website || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        contact_person: data.contact_person || '',
        is_supplier: true,
        is_customer: false,
        active: data.status === 'active' || data.active !== false,
        metadata: data.metadata || {}
    };

    try {
        const response = await api.post('/api/company/', supplierData, {
            headers: getTenantHeaders(tenantId)
        });
        return response.data;
    } catch (error: any) {
        logger.error(`Failed to create supplier for tenant ${tenantId}: ${error.message}`);
        logger.error(`WAWI Response: ${JSON.stringify(error.response?.data)}`);
        throw error;
    }
}

export async function updateSupplier(tenantId: string, id: string | number, patch: any) {
    const updateData: any = {};

    if (patch.name !== undefined) updateData.name = patch.name;
    if (patch.description !== undefined) updateData.description = patch.description;
    if (patch.website !== undefined) updateData.website = patch.website;
    if (patch.email !== undefined) updateData.email = patch.email;
    if (patch.phone !== undefined) updateData.phone = patch.phone;
    if (patch.address !== undefined) updateData.address = patch.address;
    if (patch.contact_person !== undefined) updateData.contact_person = patch.contact_person;
    if (patch.status !== undefined) updateData.active = patch.status === 'active';
    if (patch.active !== undefined) updateData.active = patch.active;
    if (patch.metadata !== undefined) updateData.metadata = patch.metadata;

    try {
        const response = await api.patch(`/api/company/${id}/`, updateData, {
            headers: getTenantHeaders(tenantId)
        });
        return response.data;
    } catch (error: any) {
        logger.error(`Failed to update supplier ${id} for tenant ${tenantId}: ${error.message}`);
        throw error;
    }
}

export async function deleteSupplier(tenantId: string, id: string | number) {
    try {
        await api.delete(`/api/company/${id}/`, {
            headers: getTenantHeaders(tenantId)
        });
    } catch (error: any) {
        logger.error(`Failed to delete supplier ${id} for tenant ${tenantId}: ${error.message}`);
        throw error;
    }
}

// --------------------------------------------------------------------------
// Stock Movement Tracking
// --------------------------------------------------------------------------

export async function getStockMovements(tenantId: string, filters: any = {}) {
    try {
        const params: any = {
            ordering: '-date',
            limit: filters.limit || 100
        };

        if (filters.part_id) params.part = filters.part_id;
        if (filters.type) {
            // Map our type to InvenTree tracking type
            // IN/OUT/TRANSFER/CORRECTION
            params.tracking_type = filters.type;
        }

        const response = await api.get('/api/stock/track/', {
            params,
            headers: getTenantHeaders(tenantId)
        });

        // Transform InvenTree tracking to our format
        const movements = (response.data.results || response.data).map((track: any) => ({
            id: track.pk,
            part_id: track.item,
            part_name: track.item_detail?.part_detail?.name || 'Unknown',
            type: mapTrackingType(track.tracking_type),
            quantity: track.quantity,
            reference: track.notes || '',
            notes: track.notes || '',
            from_location: track.location_detail?.name,
            to_location: track.destination_detail?.name,
            created_at: track.date,
            created_by: track.user_detail?.username || 'System',
            created_by_name: track.user_detail?.username || 'System'
        }));

        return movements;
    } catch (error: any) {
        logger.error(`Failed to get stock movements for tenant ${tenantId}: ${error.message}`);
        return [];
    }
}

function mapTrackingType(inventreeType: number): 'IN' | 'OUT' | 'TRANSFER' | 'CORRECTION' {
    // InvenTree tracking types:
    // 10 = stock count, 20 = stock add, 30 = stock remove, etc.
    if (inventreeType >= 20 && inventreeType < 30) return 'IN';
    if (inventreeType >= 30 && inventreeType < 40) return 'OUT';
    if (inventreeType >= 40 && inventreeType < 50) return 'TRANSFER';
    return 'CORRECTION';
}

export async function createStockMovement(tenantId: string, data: {
    part_id: string | number;
    quantity: number;
    type: 'IN' | 'OUT' | 'TRANSFER' | 'CORRECTION';
    reference?: string;
    notes?: string;
    from_location?: number;
    to_location?: number;
}) {
    try {
        // Get stock item for this part
        let stockItem = await getStockItemForPart(tenantId, data.part_id);

        if (!stockItem && data.type !== 'IN') {
            throw new Error('No stock item found. Cannot remove or transfer stock that doesn\'t exist.');
        }

        if (!stockItem && data.type === 'IN') {
            // Create initial stock item
            stockItem = await createStockItem(tenantId, data.part_id, 0, data.to_location);
        }

        const stockId = stockItem.pk;

        // Perform the appropriate action
        if (data.type === 'IN') {
            const response = await api.post('/api/stock/add/', {
                items: [{
                    pk: stockId,
                    quantity: data.quantity,
                    notes: data.notes || data.reference || 'Dashboard adjustment'
                }]
            }, {
                headers: getTenantHeaders(tenantId)
            });
            return response.data;
        }

        if (data.type === 'OUT') {
            const response = await api.post('/api/stock/remove/', {
                items: [{
                    pk: stockId,
                    quantity: data.quantity,
                    notes: data.notes || data.reference || 'Dashboard adjustment'
                }]
            }, {
                headers: getTenantHeaders(tenantId)
            });
            return response.data;
        }

        if (data.type === 'TRANSFER') {
            if (!data.to_location) throw new Error('Destination location required for transfer');
            const response = await api.post('/api/stock/transfer/', {
                items: [{
                    pk: stockId,
                    quantity: data.quantity,
                    location: data.to_location,
                    notes: data.notes || data.reference || 'Dashboard transfer'
                }]
            }, {
                headers: getTenantHeaders(tenantId)
            });
            return response.data;
        }

        if (data.type === 'CORRECTION') {
            // Stock count/correction
            const response = await api.post('/api/stock/count/', {
                items: [{
                    pk: stockId,
                    quantity: data.quantity,
                    notes: data.notes || data.reference || 'Stock correction'
                }]
            }, {
                headers: getTenantHeaders(tenantId)
            });
            return response.data;
        }

    } catch (error: any) {
        logger.error(`Failed to create stock movement for tenant ${tenantId}: ${error.message}`);
        throw error;
    }
}

export async function getStockLocations(tenantId: string) {
    try {
        const response = await api.get('/api/stock/location/', {
            headers: getTenantHeaders(tenantId)
        });

        const locations = (response.data.results || response.data).map((loc: any) => ({
            id: loc.pk,
            name: loc.name,
            description: loc.description || '',
            pathstring: loc.pathstring || loc.name,
            parent: loc.parent,
            items: loc.items || 0
        }));

        return locations;
    } catch (error: any) {
        logger.error(`Failed to get stock locations for tenant ${tenantId}: ${error.message}`);
        return [];
    }
}

// Goods Receipt
export async function receiveGoods(tenantId: string, data: {
    purchase_order_id?: number;
    part_id: string | number;
    quantity: number;
    location: number;
    notes?: string;
}) {
    try {
        // If PO is specified, use the receive endpoint
        if (data.purchase_order_id) {
            const response = await api.post('/api/order/po-receive/', {
                order: data.purchase_order_id,
                items: [{
                    part: data.part_id,
                    quantity: data.quantity,
                    location: data.location
                }],
                notes: data.notes || ''
            }, {
                headers: getTenantHeaders(tenantId)
            });
            return response.data;
        } else {
            // Direct stock add
            return await createStockMovement(tenantId, {
                part_id: data.part_id,
                quantity: data.quantity,
                type: 'IN',
                to_location: data.location,
                notes: data.notes
            });
        }
    } catch (error: any) {
        logger.error(`Failed to receive goods for tenant ${tenantId}: ${error.message}`);
        throw error;
    }
}

// --------------------------------------------------------------------------
// Purchase Orders Management
// --------------------------------------------------------------------------

export async function getPurchaseOrders(tenantId: string, filters: any = {}) {
    try {
        const params: any = {
            ordering: '-creation_date',
            limit: filters.limit || 100
        };

        if (filters.supplier) params.supplier = filters.supplier;
        if (filters.status) params.status = filters.status;

        const response = await api.get('/api/order/po/', {
            params,
            headers: getTenantHeaders(tenantId)
        });

        const orders = (response.data.results || response.data).map((po: any) => ({
            id: po.pk,
            order_number: po.reference,
            supplier_id: po.supplier,
            supplier_name: po.supplier_detail?.name || 'Unknown',
            status: mapPOStatus(po.status),
            order_date: po.creation_date,
            expected_delivery: po.target_date,
            total_amount: po.total_price || 0,
            currency: po.currency || 'EUR',
            notes: po.notes || '',
            items: po.lines || []
        }));

        return orders;
    } catch (error: any) {
        logger.error(`Failed to get purchase orders for tenant ${tenantId}: ${error.message}`);
        return [];
    }
}

function mapPOStatus(inventreeStatus: number): 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled' {
    // InvenTree PO status codes:
    // 10 = Pending, 20 = Placed, 30 = Complete, 40 = Cancelled, 50 = Lost, 60 = Returned
    if (inventreeStatus === 10) return 'draft';
    if (inventreeStatus === 20) return 'sent';
    if (inventreeStatus === 25) return 'confirmed';
    if (inventreeStatus === 30) return 'received';
    if (inventreeStatus === 40) return 'cancelled';
    return 'draft';
}

export async function getPurchaseOrderById(tenantId: string, id: string | number) {
    try {
        const response = await api.get(`/api/order/po/${id}/`, {
            headers: getTenantHeaders(tenantId)
        });

        const po = response.data;

        // Fetch line items separately if needed
        const linesResponse = await api.get('/api/order/po-line/', {
            params: { order: id },
            headers: getTenantHeaders(tenantId)
        });

        const items = (linesResponse.data.results || linesResponse.data).map((line: any) => ({
            id: line.pk,
            part_id: line.part,
            part_name: line.part_detail?.name || 'Unknown',
            part_ipn: line.part_detail?.IPN || '',
            quantity: line.quantity,
            unit_price: line.purchase_price || 0,
            total_price: (line.quantity || 0) * (line.purchase_price || 0),
            received: line.received || 0
        }));

        return {
            id: po.pk,
            order_number: po.reference,
            supplier_id: po.supplier,
            supplier_name: po.supplier_detail?.name || 'Unknown',
            status: mapPOStatus(po.status),
            order_date: po.creation_date,
            expected_delivery: po.target_date,
            total_amount: po.total_price || 0,
            currency: po.currency || 'EUR',
            notes: po.notes || '',
            items: items
        };
    } catch (error: any) {
        if (error.response?.status === 404) {
            return null;
        }
        logger.error(`Failed to get purchase order ${id} for tenant ${tenantId}: ${error.message}`);
        throw error;
    }
}

export async function createPurchaseOrder(tenantId: string, data: {
    supplier_id: number;
    reference?: string;
    description?: string;
    target_date?: string;
    notes?: string;
    items: Array<{
        part_id: number;
        quantity: number;
        unit_price?: number;
    }>;
}) {
    try {
        // Create the PO header
        const poData = {
            supplier: data.supplier_id,
            reference: data.reference || `PO-${Date.now()}`,
            description: data.description || '',
            target_date: data.target_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            notes: data.notes || ''
        };

        const poResponse = await api.post('/api/order/po/', poData, {
            headers: getTenantHeaders(tenantId)
        });

        const poId = poResponse.data.pk;

        // Create line items
        for (const item of data.items) {
            await api.post('/api/order/po-line/', {
                order: poId,
                part: item.part_id,
                quantity: item.quantity,
                purchase_price: item.unit_price || 0
            }, {
                headers: getTenantHeaders(tenantId)
            });
        }

        // Fetch the complete PO with items
        return await getPurchaseOrderById(tenantId, poId);
    } catch (error: any) {
        logger.error(`Failed to create purchase order for tenant ${tenantId}: ${error.message}`);
        throw error;
    }
}

export async function updatePurchaseOrder(tenantId: string, id: string | number, patch: any) {
    try {
        const updateData: any = {};

        if (patch.reference !== undefined) updateData.reference = patch.reference;
        if (patch.description !== undefined) updateData.description = patch.description;
        if (patch.target_date !== undefined) updateData.target_date = patch.target_date;
        if (patch.notes !== undefined) updateData.notes = patch.notes;

        // Map our status to InvenTree status
        if (patch.status !== undefined) {
            if (patch.status === 'draft') updateData.status = 10;
            if (patch.status === 'sent') updateData.status = 20;
            if (patch.status === 'confirmed') updateData.status = 25;
            if (patch.status === 'received') updateData.status = 30;
            if (patch.status === 'cancelled') updateData.status = 40;
        }

        const response = await api.patch(`/api/order/po/${id}/`, updateData, {
            headers: getTenantHeaders(tenantId)
        });

        return await getPurchaseOrderById(tenantId, id);
    } catch (error: any) {
        logger.error(`Failed to update purchase order ${id} for tenant ${tenantId}: ${error.message}`);
        throw error;
    }
}

export async function cancelPurchaseOrder(tenantId: string, id: string | number) {
    try {
        await api.patch(`/api/order/po/${id}/`, {
            status: 40 // Cancelled
        }, {
            headers: getTenantHeaders(tenantId)
        });
    } catch (error: any) {
        logger.error(`Failed to cancel purchase order ${id} for tenant ${tenantId}: ${error.message}`);
        throw error;
    }
}

export async function receivePurchaseOrder(tenantId: string, poId: string | number, data: {
    items: Array<{
        line_item_id: number;
        quantity: number;
        location: number;
    }>;
    notes?: string;
}) {
    try {
        const receiveData = {
            items: data.items.map(item => ({
                line_item: item.line_item_id,
                quantity: item.quantity,
                location: item.location
            })),
            notes: data.notes || ''
        };

        const response = await api.post('/api/order/po-receive/', receiveData, {
            headers: getTenantHeaders(tenantId)
        });

        return response.data;
    } catch (error: any) {
        logger.error(`Failed to receive purchase order ${poId} for tenant ${tenantId}: ${error.message}`);
        throw error;
    }
}

export async function getReorderSuggestions(tenantId: string) {
    try {
        // Get all parts with stock below minimum
        const partsResponse = await api.get('/api/part/', {
            params: {
                low_stock: true,
                active: true
            },
            headers: getTenantHeaders(tenantId)
        });

        const lowStockParts = (partsResponse.data.results || partsResponse.data).filter((part: any) => {
            const stock = part.in_stock || 0;
            const minimum = part.minimum_stock || 0;
            return stock < minimum;
        });

        const suggestions = lowStockParts.map((part: any) => ({
            part: {
                id: part.pk,
                name: part.name,
                IPN: part.IPN || part.name,
                description: part.description
            },
            current_stock: part.in_stock || 0,
            minimum_stock: part.minimum_stock || 0,
            suggested_order_quantity: Math.max((part.minimum_stock || 0) - (part.in_stock || 0), (part.minimum_stock || 0))
        }));

        return suggestions;
    } catch (error: any) {
        logger.error(`Failed to get reorder suggestions for tenant ${tenantId}: ${error.message}`);
        return [];
    }
}
