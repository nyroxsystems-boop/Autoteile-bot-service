// Order to Invoice Automation Service
// Automatically creates invoices when orders are completed

import { createInvoice } from './invoiceService';
import { db } from '@core/database';
import type { CreateInvoiceRequest, TaxCode } from '../../types/tax';
import {
    fetchOrderFromWAWI,
    fetchOrderItemsFromWAWI,
    updateOrderStatusInWAWI,
    checkOrderHasInvoice,
    type WAWIOrder
} from './wawiClient';

/**
 * Generate invoice from completed order
 * Uses WAWI API to fetch order data instead of direct database access
 */
export async function createInvoiceFromOrder(tenantId: string, orderId: string): Promise<any> {
    try {
        console.log(`[Invoice] Creating invoice for order ${orderId}, tenant: ${tenantId}`);

        // Step 1: Check if invoice already exists in Bot-Service database
        const existingInvoice = await db.get<{ id: string; invoice_number: string }>(
            'SELECT id, invoice_number FROM invoices WHERE source_order_id = ? AND tenant_id = ?',
            [orderId, tenantId]
        );

        if (existingInvoice) {
            console.log(`[Invoice] Invoice already exists for order ${orderId}: ${existingInvoice.invoice_number}`);
            return existingInvoice;
        }

        // Step 2: Check if order already has invoice in WAWI
        const hasInvoiceInWAWI = await checkOrderHasInvoice(orderId);
        if (hasInvoiceInWAWI) {
            console.log(`[Invoice] Order ${orderId} already has invoice in WAWI`);
            throw new Error('Rechnung existiert bereits für diesen Auftrag');
        }

        // Step 3: Fetch order details from WAWI API
        const order = await fetchOrderFromWAWI(orderId);

        if (!order) {
            throw new Error('Auftrag nicht gefunden');
        }

        // Step 4: Fetch order items from WAWI API
        const orderItems = await fetchOrderItemsFromWAWI(orderId);

        if (!orderItems || orderItems.length === 0) {
            throw new Error('Auftrag hat keine Positionen');
        }

        // Step 5: Map order items to invoice lines
        const invoiceLines = orderItems.map(item => {
            const taxRate = item.tax_rate || 19;
            const quantity = item.quantity || 1; // Default to 1 if not specified
            return {
                description: item.product_name,
                quantity: quantity,
                unit_price: item.price,
                tax_rate: taxRate as 0 | 7 | 19,
                tax_code: (taxRate === 0 ? 'TAX_FREE' : 'STANDARD') as TaxCode
            };
        });

        // Step 6: Create invoice request
        const invoiceData: CreateInvoiceRequest = {
            issue_date: new Date().toISOString().split('T')[0],
            due_date: calculateDueDate(14), // 14 days payment term
            customer_name: order.customer_name || 'Kunde',
            billing_country: 'DE',
            notes: `Automatisch erstellt für Auftrag ${order.id}`,
            lines: invoiceLines,
            source_order_id: orderId // Track the source order
        };

        // Step 7: Create invoice in Bot-Service database
        const invoice = await createInvoice(tenantId, invoiceData);

        console.log(`✅ Invoice ${invoice.invoice_number} created for order ${orderId}`);

        // Step 8: Update order status in WAWI (non-blocking)
        await updateOrderStatusInWAWI(orderId, 'invoiced', invoice.invoice_number);

        return invoice;

    } catch (error: any) {
        console.error(`[Invoice] Failed to create invoice from order ${orderId}:`, error.message);
        throw error;
    }
}

/**
 * Automatically create invoice when order status changes to 'completed'
 * Called from order update handler
 */
export async function handleOrderStatusChange(tenantId: string, orderId: string, newStatus: string): Promise<void> {
    if (newStatus === 'completed' || newStatus === 'delivered') {
        try {
            await createInvoiceFromOrder(tenantId, orderId);
        } catch (error) {
            console.error(`Auto-invoice creation failed for order ${orderId}:`, error);
            // Don't throw - log error but don't block order update
        }
    }
}

/**
 * Batch create invoices for all completed orders without invoices
 * @deprecated This function requires a WAWI API endpoint to list orders, which is not yet implemented.
 * Use createInvoiceFromOrder() for individual orders instead.
 */
export async function syncOrdersToInvoices(tenantId: string): Promise<{ created: number; skipped: number; errors: number }> {
    console.warn('[Invoice] syncOrdersToInvoices is deprecated - WAWI API endpoint for order listing is not available');
    console.warn('[Invoice] Use createInvoiceFromOrder() for individual orders instead');

    // Return empty stats - this function cannot work without a WAWI API endpoint to list orders
    // The local 'orders' table does not exist in the Bot-Service database
    return { created: 0, skipped: 0, errors: 0 };
}

// Helper functions
function calculateDueDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
}
