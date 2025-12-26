import * as localAdapter from './inventreeAdapter';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const BASE_URL = process.env.INVENTREE_BASE_URL;
const API_TOKEN = process.env.INVENTREE_API_TOKEN;

// API Client for WWS
const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Token ${API_TOKEN}`,
        'Content-Type': 'application/json'
    },
    timeout: 5000 // Don't block bot too long
});

// Pass-through READS (Local SQLite is source of truth for speed)
export const testDbConnection = localAdapter.testDbConnection;
export const getOrderById = localAdapter.getOrderById;
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
async function syncToWWS(orderId: string | number) {
    if (!BASE_URL || !API_TOKEN) {
        // Silent fail if not configured (dev mode)
        return;
    }

    try {
        const order = await localAdapter.getOrderById(orderId);
        if (!order) return;

        // Sync to ext/orders/{id}/
        // We send the full order object as payload + status + wawi logic needs
        const payload = {
            id: String(order.id), // Ensure string ID
            status: order.status,
            payload: {
                ...order,
                synced_at: new Date().toISOString()
            }
        };

        // Fire and forget - don't await to keep bot fast
        api.post(`/ext/orders/${order.id}/`, payload)
            .then(() => logger.info(`Synced order ${order.id} to WWS`))
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
