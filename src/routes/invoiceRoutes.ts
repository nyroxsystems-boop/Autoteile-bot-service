// Invoice API Routes
// Endpoints for invoice CRUD operations

import { Router, Request, Response } from 'express';
import {
    createInvoice,
    getInvoiceById,
    listInvoices,
    updateInvoice,
    markInvoiceAsPaid,
    cancelInvoice,
    deleteInvoice
} from '../services/invoicing/invoiceService';

const router = Router();

// Middleware to extract tenant ID from header
const requireTenant = (req: Request, res: Response, next: Function) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
        return res.status(400).json({ error: 'X-Tenant-ID header is required' });
    }
    req.tenantId = tenantId;
    next();
};

router.use(requireTenant);

/**
 * GET /api/invoices
 * List invoices with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const options = {
            status: req.query.status as any,
            from_date: req.query.from_date as string,
            to_date: req.query.to_date as string,
            customer_id: req.query.customer_id as string,
            limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
            offset: req.query.offset ? parseInt(req.query.offset as string) : 0
        };

        const invoices = await listInvoices(req.tenantId!, options);
        res.json(invoices);
    } catch (error: any) {
        console.error('Error listing invoices:', error);
        res.status(500).json({ error: 'Failed to list invoices', message: error.message });
    }
});

/**
 * POST /api/invoices
 * Create new invoice
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const invoice = await createInvoice(req.tenantId!, req.body);
        res.status(201).json(invoice);
    } catch (error: any) {
        console.error('Error creating invoice:', error);
        res.status(500).json({ error: 'Failed to create invoice', message: error.message });
    }
});

/**
 * GET /api/invoices/:id
 * Get invoice details
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const invoice = await getInvoiceById(req.tenantId!, req.params.id);
        res.json(invoice);
    } catch (error: any) {
        console.error('Error fetching invoice:', error);
        res.status(404).json({ error: 'Invoice not found', message: error.message });
    }
});

/**
 * PUT /api/invoices/:id
 * Update invoice
 */
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const invoice = await updateInvoice(req.tenantId!, req.params.id, req.body);
        res.json(invoice);
    } catch (error: any) {
        console.error('Error updating invoice:', error);
        res.status(500).json({ error: 'Failed to update invoice', message: error.message });
    }
});

/**
 * POST /api/invoices/:id/pay
 * Mark invoice as paid
 */
router.post('/:id/pay', async (req: Request, res: Response) => {
    try {
        const invoice = await markInvoiceAsPaid(req.tenantId!, req.params.id);
        res.json(invoice);
    } catch (error: any) {
        console.error('Error marking invoice as paid:', error);
        res.status(500).json({ error: 'Failed to mark invoice as paid', message: error.message });
    }
});

/**
 * POST /api/invoices/:id/cancel
 * Cancel invoice
 */
router.post('/:id/cancel', async (req: Request, res: Response) => {
    try {
        const invoice = await cancelInvoice(req.tenantId!, req.params.id);
        res.json(invoice);
    } catch (error: any) {
        console.error('Error canceling invoice:', error);
        res.status(500).json({ error: 'Failed to cancel invoice', message: error.message });
    }
});

/**
 * DELETE /api/invoices/:id
 * Delete invoice (hard delete)
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await deleteInvoice(req.tenantId!, req.params.id);
        res.status(204).send();
    } catch (error: any) {
        console.error('Error deleting invoice:', error);
        res.status(500).json({ error: 'Failed to delete invoice', message: error.message });
    }
});

/**
 * GET /api/invoices/:id/pdf
 * Generate and download invoice PDF
 */
router.get('/:id/pdf', async (req: Request, res: Response) => {
    const startTime = Date.now();
    console.log(`[PDF] Request received for invoice: ${req.params.id}, tenant: ${req.tenantId}`);

    try {
        // Step 1: Load PDF generator
        console.log(`[PDF] Loading PDF generator module...`);
        const { generateInvoicePDF } = await import('../services/invoicing/pdfGenerator');

        // Step 2: Fetch invoice from database
        console.log(`[PDF] Fetching invoice from database...`);
        const invoice = await getInvoiceById(req.tenantId!, req.params.id);
        console.log(`[PDF] Invoice found: ${invoice.invoice_number}, status: ${invoice.status}, lines: ${invoice.lines?.length || 0}`);

        // Step 3: Generate PDF
        console.log(`[PDF] Generating PDF...`);
        const pdfBuffer = await generateInvoicePDF(req.tenantId!, invoice);
        console.log(`[PDF] PDF generated successfully, size: ${pdfBuffer.length} bytes, took: ${Date.now() - startTime}ms`);

        // Step 4: Send response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Rechnung-${invoice.invoice_number}.pdf"`);
        res.send(pdfBuffer);

        console.log(`[PDF] PDF sent to client successfully`);
    } catch (error: any) {
        console.error(`[PDF] Error generating PDF for invoice ${req.params.id}:`, error);
        console.error(`[PDF] Error stack:`, error.stack);

        // Return appropriate status code based on error type
        if (error.message === 'Invoice not found') {
            res.status(404).json({
                error: 'Invoice not found',
                message: error.message,
                invoice_id: req.params.id,
                tenant_id: req.tenantId
            });
        } else {
            res.status(500).json({
                error: 'Failed to generate PDF',
                message: error.message,
                invoice_id: req.params.id
            });
        }
    }
});

export default router;
