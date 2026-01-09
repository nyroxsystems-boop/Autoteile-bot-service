// Invoice Service - CRUD operations for invoices
// Handles invoice creation, updates, and retrieval with tax calculations

import { randomUUID } from 'crypto';
import { db } from '@core/database';
import type {
    Invoice,
    InvoiceLine,
    CreateInvoiceRequest,
    UpdateInvoiceRequest,
    TaxRate,
    TaxCode,
    InvoiceStatus
} from '../../types/tax';

/**
 * Generate next invoice number for tenant
 * Format: INV-YYYY-XXXX (e.g., INV-2026-0001)
 */
export async function generateInvoiceNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    // Get the highest invoice number for this year
    const result = await db.get<{ max_num: string }>(
        `SELECT invoice_number as max_num FROM invoices 
         WHERE tenant_id = ? AND invoice_number LIKE ? 
         ORDER BY invoice_number DESC LIMIT 1`,
        [tenantId, `${prefix}%`]
    );

    let nextNumber = 1;
    if (result?.max_num) {
        const numPart = result.max_num.replace(prefix, '');
        nextNumber = parseInt(numPart, 10) + 1;
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
}

/**
 * Calculate invoice totals from lines
 */
function calculateInvoiceTotals(lines: Array<{ quantity: number; unit_price: number; tax_rate: TaxRate }>) {
    let net_amount = 0;
    let vat_amount = 0;

    for (const line of lines) {
        const line_net = line.quantity * line.unit_price;
        const line_vat = line_net * (line.tax_rate / 100);

        net_amount += line_net;
        vat_amount += line_vat;
    }

    const gross_amount = net_amount + vat_amount;

    return {
        net_amount: Math.round(net_amount * 100) / 100,
        vat_amount: Math.round(vat_amount * 100) / 100,
        gross_amount: Math.round(gross_amount * 100) / 100
    };
}

/**
 * Create a new invoice
 */
export async function createInvoice(tenantId: string, data: CreateInvoiceRequest): Promise<Invoice> {
    const id = randomUUID();
    const now = new Date().toISOString();

    // Generate invoice number if not provided
    const invoice_number = data.invoice_number || await generateInvoiceNumber(tenantId);

    // Calculate totals
    const totals = calculateInvoiceTotals(data.lines);

    // Insert invoice
    await db.run(
        `INSERT INTO invoices (
            id, tenant_id, invoice_number, issue_date, due_date,
            customer_id, customer_name, billing_country,
            net_amount, vat_amount, gross_amount, status, notes, source_order_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            tenantId,
            invoice_number,
            data.issue_date,
            data.due_date || null,
            data.customer_id || null,
            data.customer_name || null,
            data.billing_country || 'DE',
            totals.net_amount,
            totals.vat_amount,
            totals.gross_amount,
            'draft',
            data.notes || null,
            data.source_order_id || null,
            now,
            now
        ]
    );

    // Insert invoice lines
    for (const line of data.lines) {
        const lineId = randomUUID();
        const line_total = Math.round(line.quantity * line.unit_price * 100) / 100;

        await db.run(
            `INSERT INTO invoice_lines (
                id, invoice_id, description, quantity, unit_price,
                tax_rate, tax_code, line_total, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                lineId,
                id,
                line.description,
                line.quantity,
                line.unit_price,
                line.tax_rate,
                line.tax_code || 'STANDARD',
                line_total,
                now
            ]
        );
    }

    // Return created invoice with lines
    return getInvoiceById(tenantId, id);
}

/**
 * Convert numeric string fields to numbers (SQLite returns numbers as strings)
 */
function normalizeInvoice(invoice: any): Invoice {
    return {
        ...invoice,
        net_amount: parseFloat(invoice.net_amount) || 0,
        vat_amount: parseFloat(invoice.vat_amount) || 0,
        gross_amount: parseFloat(invoice.gross_amount) || 0,
        lines: invoice.lines?.map((line: any) => ({
            ...line,
            quantity: parseFloat(line.quantity) || 0,
            unit_price: parseFloat(line.unit_price) || 0,
            tax_rate: parseFloat(line.tax_rate) || 0,
            line_total: parseFloat(line.line_total) || 0
        })) || []
    };
}

/**
 * Get invoice by ID with lines
 */
export async function getInvoiceById(tenantId: string, invoiceId: string): Promise<Invoice> {
    const invoice = await db.get<Invoice>(
        `SELECT * FROM invoices WHERE id = ? AND tenant_id = ?`,
        [invoiceId, tenantId]
    );

    if (!invoice) {
        throw new Error('Invoice not found');
    }

    // Get invoice lines
    const lines = await db.all<InvoiceLine>(
        `SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY created_at`,
        [invoiceId]
    );

    return normalizeInvoice({
        ...invoice,
        lines
    });
}

/**
 * List invoices for tenant with optional filters
 */
export async function listInvoices(
    tenantId: string,
    options: {
        status?: InvoiceStatus;
        from_date?: string;
        to_date?: string;
        customer_id?: string;
        limit?: number;
        offset?: number;
    } = {}
): Promise<Invoice[]> {
    let query = 'SELECT * FROM invoices WHERE tenant_id = ?';
    const params: any[] = [tenantId];

    if (options.status) {
        query += ' AND status = ?';
        params.push(options.status);
    }

    if (options.from_date) {
        query += ' AND issue_date >= ?';
        params.push(options.from_date);
    }

    if (options.to_date) {
        query += ' AND issue_date <= ?';
        params.push(options.to_date);
    }

    if (options.customer_id) {
        query += ' AND customer_id = ?';
        params.push(options.customer_id);
    }

    query += ' ORDER BY issue_date DESC, created_at DESC';

    if (options.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
    }

    if (options.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
    }

    const invoices = await db.all<Invoice>(query, params);

    // Fetch lines for each invoice
    for (const invoice of invoices) {
        const lines = await db.all<InvoiceLine>(
            `SELECT * FROM invoice_lines WHERE invoice_id = ? ORDER BY created_at`,
            [invoice.id]
        );
        invoice.lines = lines;
    }

    return invoices;
}

/**
 * Update invoice
 */
export async function updateInvoice(
    tenantId: string,
    invoiceId: string,
    data: UpdateInvoiceRequest
): Promise<Invoice> {
    const now = new Date().toISOString();
    const updates: string[] = [];
    const params: any[] = [];

    if (data.issue_date !== undefined) {
        updates.push('issue_date = ?');
        params.push(data.issue_date);
    }

    if (data.due_date !== undefined) {
        updates.push('due_date = ?');
        params.push(data.due_date);
    }

    if (data.paid_at !== undefined) {
        updates.push('paid_at = ?');
        params.push(data.paid_at);
    }

    if (data.customer_name !== undefined) {
        updates.push('customer_name = ?');
        params.push(data.customer_name);
    }

    if (data.notes !== undefined) {
        updates.push('notes = ?');
        params.push(data.notes);
    }

    if (data.status !== undefined) {
        updates.push('status = ?');
        params.push(data.status);
    }

    if (updates.length === 0) {
        return getInvoiceById(tenantId, invoiceId);
    }

    updates.push('updated_at = ?');
    params.push(now);

    // Add WHERE clause params
    params.push(invoiceId, tenantId);

    await db.run(
        `UPDATE invoices SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
        params
    );

    return getInvoiceById(tenantId, invoiceId);
}

/**
 * Mark invoice as paid
 */
export async function markInvoiceAsPaid(tenantId: string, invoiceId: string): Promise<Invoice> {
    const now = new Date().toISOString();

    await db.run(
        `UPDATE invoices SET status = ?, paid_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
        ['paid', now, now, invoiceId, tenantId]
    );

    return getInvoiceById(tenantId, invoiceId);
}

/**
 * Cancel/void an invoice (soft delete)
 */
export async function cancelInvoice(tenantId: string, invoiceId: string): Promise<Invoice> {
    const now = new Date().toISOString();

    await db.run(
        `UPDATE invoices SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
        ['canceled', now, invoiceId, tenantId]
    );

    return getInvoiceById(tenantId, invoiceId);
}

/**
 * Delete invoice (hard delete - use with caution!)
 */
export async function deleteInvoice(tenantId: string, invoiceId: string): Promise<void> {
    // Invoice lines will be deleted automatically via CASCADE
    await db.run(
        `DELETE FROM invoices WHERE id = ? AND tenant_id = ?`,
        [invoiceId, tenantId]
    );
}
