import { logger } from "@utils/logger";

// WAWI API Client
// Handles communication with the WAWI backend for order data retrieval

const WAWI_BASE_URL = process.env.WAWI_API_URL;
if (!WAWI_BASE_URL) {
    logger.warn('[WAWI Client] ⚠️  WAWI_API_URL not set — WAWI integration disabled');
}
const SERVICE_TOKEN = process.env.WAWI_SERVICE_TOKEN;

export interface WAWIOrder {
    id: string;
    tenant_id: string;
    customer_name?: string;
    customer_email?: string;
    total_amount?: number;
    status: string;
    conversation_id?: string;
    created_at: string;
    generated_invoice_id?: string;
}

export interface WAWIOrderItem {
    id: string;
    order_id: string;
    product_name: string;
    price: number;
    brand?: string;
    quantity?: number;
    tax_rate?: number;
}

/**
 * Fetch order details from WAWI backend
 */
export async function fetchOrderFromWAWI(orderId: string): Promise<WAWIOrder> {
    try {
        const response = await fetch(`${WAWI_BASE_URL}/api/orders/${orderId}/`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SERVICE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Order ${orderId} not found in WAWI`);
            }
            throw new Error(`WAWI API error: ${response.status} ${response.statusText}`);
        }

        const order = await response.json();
        return order;
    } catch (error: any) {
        logger.error(`[WAWI Client] Failed to fetch order ${orderId}:`, error.message);
        throw error;
    }
}

/**
 * Fetch order items from WAWI backend
 */
export async function fetchOrderItemsFromWAWI(orderId: string): Promise<WAWIOrderItem[]> {
    try {
        const response = await fetch(`${WAWI_BASE_URL}/api/shop-offers/?order_id=${orderId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${SERVICE_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            logger.warn(`[WAWI Client] Failed to fetch items for order ${orderId}: ${response.status}`);
            return [];
        }

        const data = await response.json();
        // Handle both array and paginated responses
        const items = Array.isArray(data) ? data : (data.results || []);
        return items;
    } catch (error: any) {
        logger.error(`[WAWI Client] Failed to fetch items for order ${orderId}:`, error.message);
        return [];
    }
}

/**
 * Update order status in WAWI backend
 */
export async function updateOrderStatusInWAWI(orderId: string, status: string, invoiceNumber?: string): Promise<void> {
    try {
        const payload: any = { status };

        if (invoiceNumber) {
            payload.generated_invoice_id = invoiceNumber;
        }

        const response = await fetch(`${WAWI_BASE_URL}/api/orders/${orderId}/`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${SERVICE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`WAWI API error: ${response.status} ${response.statusText}`);
        }

        logger.info(`✅ Order ${orderId} status updated to '${status}' in WAWI`);
    } catch (error: any) {
        logger.error(`[WAWI Client] Failed to update order ${orderId}:`, error.message);
        // Don't throw - log error but don't block invoice creation
        logger.warn(`⚠️ Invoice created but order status update failed`);
    }
}

/**
 * Check if order already has an invoice
 */
export async function checkOrderHasInvoice(orderId: string): Promise<boolean> {
    try {
        const order = await fetchOrderFromWAWI(orderId);
        return !!order.generated_invoice_id;
    } catch (error) {
        logger.error(`[WAWI Client] Failed to check invoice status for order ${orderId}`);
        return false;
    }
}
