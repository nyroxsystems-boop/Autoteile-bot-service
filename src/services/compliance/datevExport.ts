/**
 * DATEV Export Service (GoBD/Compliance)
 * Generates accounting CSV exports compatible with DATEV Rechnungswesen
 */

import { listInvoices } from '../invoicing/invoiceService';
import { logger } from '@utils/logger';

export interface DatevExportOptions {
    month: number;
    year: number;
    tenantId: string;
    revenueAccount?: string; // Default: 8400 (SKR03 19% USt)
    debtorAccountBase?: number; // Start for Debitor accounts, e.g., 10000
}

/**
 * Generate DATEV Extreme Format (CSV) 
 * Simplification for Phase 6 Business Hardening
 */
export async function generateDatevExport(options: DatevExportOptions): Promise<string> {
    logger.info(`[DATEV] Generating export for tenant ${options.tenantId}, ${options.month}/${options.year}`);
    
    // Create start and end date of the month for the DB query
    const startDate = new Date(options.year, options.month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(options.year, options.month, 0).toISOString().split('T')[0];

    // Fetch all invoices for the month
    const invoices = await listInvoices(options.tenantId, {
        from_date: startDate,
        to_date: endDate
    });

    if (!invoices || invoices.length === 0) {
        logger.warn(`[DATEV] No invoices found for period ${startDate} - ${endDate}`);
        return "Keine Rechnungen im angegebenen Zeitraum gefunden.";
    }

    const revenueAccount = options.revenueAccount || '8400';
    const debtorAccountBase = options.debtorAccountBase || 10000;

    // DATEV Header (simplified)
    const headers = [
        '"Umsatz (ohne Soll/Haben-Kz)"',
        '"Soll/Haben-Kz"',
        '"WKZ Umsatz"',
        '"Konto"',
        '"Gegenkonto (ohne BU-Schlüssel)"',
        '"Belegdatum"',
        '"Belegfeld 1"',
        '"Buchungstext"'
    ];

    let csvContent = headers.join(';') + '\n';

    // Map invoices to DATEV rows
    // Note: In real DATEV this handles VAT splits. This is an MVP approach.
    invoices.forEach((invoice, index) => {
        // Only export invoices that aren't drafts. 
        if (invoice.status === 'draft') return;
        
        // Use pseudo debtor account for the demo based on the customer name hash or index
        const debtorAccount = debtorAccountBase + (index % 1000);
        
        // Format Date to DDMM (e.g. 24.12.2026 -> 2412)
        const d = new Date(invoice.issue_date);
        const belegDatum = `${d.getDate().toString().padStart(2, '0')}${((d.getMonth()+1)).toString().padStart(2, '0')}`;
        
        // Format Amount: Komma statt Punkt (z.B. 100,50)
        const umsatz = invoice.gross_amount.toFixed(2).replace('.', ',');
        
        // Soll/Haben: S for Sales (Gegenkonto is debtor, Konto is revenue)
        // If canceled, we could reverse it (Haben-Kz). 
        const isCanceled = invoice.status === 'canceled';
        const shKz = isCanceled ? '"H"' : '"S"'; 

        const row = [
            `"${umsatz}"`,
            shKz,
            '"EUR"',
            `"${debtorAccount}"`,  // Konto (Debitor)
            `"${revenueAccount}"`, // Gegenkonto (Erlöskonto z.B. 8400)
            `"${belegDatum}"`,
            `"${invoice.invoice_number}"`,
            `"Rechnung ${invoice.invoice_number} ${invoice.customer_name || ''}"`
        ];

        csvContent += row.join(';') + '\n';

        // Log audit trail for export? (Optional, GoBD encourages tracking exports)
    });

    return csvContent;
}
