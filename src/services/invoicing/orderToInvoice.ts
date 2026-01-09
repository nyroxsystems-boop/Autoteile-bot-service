// Order to Invoice Automation Service
// Automatically creates invoices when orders are completed

import { createInvoice } from './invoiceService';
import { db } from '@core/database';
import type { CreateInvoiceRequest } from '../../types/tax';

interface Order {
    id: string;
    tenant_id: string;
    customer_name?: string;
    customer_email?: string;
    total_amount?: number;
    status: string;
    conversation_id?: string;
    created_at: string;
}

interface OrderItem {
    id: string;
    order_id: string;
    product_name: string;
    quantity: number;
    price: number;
    tax_rate?: number;
}

/**
 * Generate invoice from completed order
 */
export async function createInvoiceFromOrder(tenantId: string, orderId: string): Promise<any> {
    try {
        // Fetch order details
        const order = await db.get<Order>(
            'SELECT * FROM orders WHERE id = ? AND tenant_id = ?',
            [orderId, tenantId]
        );

        if (!order) {
            throw new Error('Order not found');
        }

        // Check if invoice already exists for this order
        const existingInvoice = await db.get(
            'SELECT id FROM invoices WHERE source_order_id = ? AND tenant_id = ?',
            [orderId, tenantId]
        );

        if (existingInvoice) {
            console.log(`Invoice already exists for order ${orderId}`);
            return existingInvoice;
        }

        // Fetch order items
        const orderItems = await db.all<OrderItem>(
            'SELECT * FROM order_items WHERE order_id = ?',
            [orderId]
        );

        if (!orderItems || orderItems.length === 0) {
            throw new Error('Order has no items');
        }

        // Map order items to invoice lines
        const invoiceLines = orderItems.map(item => {
            const taxRate = item.tax_rate || 19;
            return {
                description: item.product_name,
                quantity: item.quantity,
                unit_price: item.price,
                tax_rate: taxRate as 0 | 7 | 19,
                tax_code: taxRate === 0 ? 'EXEMPT' : 'STANDARD' as 'STANDARD' | 'REDUCED' | 'EXEMPT'
            };
        });

        // Create invoice request
        const invoiceData: CreateInvoiceRequest = {
            issue_date: new Date().toISOString().split('T')[0],
            due_date: calculateDueDate(14), // 14 days payment term
            customer_name: order.customer_name || 'Kunde',
            billing_country: 'DE',
            notes: `Automatisch erstellt für Auftrag ${order.id}`,
            lines: invoiceLines,
            source_order_id: orderId // Track the source order
        };

        // Create invoice
        const invoice = await createInvoice(tenantId, invoiceData);

        console.log(`✅ Invoice ${invoice.invoice_number} created for order ${orderId}`);

        return invoice;

    } catch (error) {
        console.error(`Failed to create invoice from order ${orderId}:`, error);
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
 */
export async function syncOrdersToInvoices(tenantId: string): Promise<{ created: number; skipped: number; errors: number }> {
    const stats = { created: 0, skipped: 0, errors: 0 };

    try {
        // Find completed orders without invoices
        const ordersWithoutInvoices = await db.all<Order>(
            `SELECT o.* FROM orders o
             LEFT JOIN invoices i ON i.source_order_id = o.id AND i.tenant_id = o.tenant_id
             WHERE o.tenant_id = ? 
             AND o.status IN ('completed', 'delivered')
             AND i.id IS NULL`,
            [tenantId]
        );

        for (const order of ordersWithoutInvoices) {
            try {
                await createInvoiceFromOrder(tenantId, order.id);
                stats.created++;
            } catch (error) {
                console.error(`Failed to create invoice for order ${order.id}:`, error);
                stats.errors++;
            }
        }

        console.log(`📊 Invoice sync complete: ${stats.created} created, ${stats.skipped} skipped, ${stats.errors} errors`);

    } catch (error) {
        console.error('Failed to sync orders to invoices:', error);
        throw error;
    }

    return stats;
}

// Helper functions
function calculateDueDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
}
