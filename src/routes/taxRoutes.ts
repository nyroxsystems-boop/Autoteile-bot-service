// Tax API Routes
// Endpoints for tax profiles, periods, and exports

import { Router, Request, Response } from 'express';
import {
    getTaxProfile,
    upsertTaxProfile,
    calculateTaxPeriod,
    saveTaxPeriod,
    getTaxPeriodById,
    listTaxPeriods,
    markPeriodAsExported
} from '../services/tax/taxCalculator';

const router = Router();

// Middleware to extract tenant ID (from header or authenticated user)
const requireTenant = (req: Request, res: Response, next: Function) => {
    // Try header first
    const tenantId = req.headers['x-tenant-id'] as string;
    if (tenantId) {
        (req as any).tenantId = tenantId;
        return next();
    }

    // Fallback to user's merchant_id from auth session
    if ((req as any).user?.merchant_id) {
        (req as any).tenantId = (req as any).user.merchant_id.toString();
        return next();
    }

    return res.status(400).json({ error: 'X-Tenant-ID header is required' });
};

router.use(requireTenant);

/**
 * GET /api/tax/profile
 * Get tax profile for tenant
 */
router.get('/profile', async (req: Request, res: Response) => {
    try {
        const profile = await getTaxProfile((req as any).tenantId!);
        if (!profile) {
            return res.status(404).json({ error: 'Tax profile not found. Please configure tax settings.' });
        }
        res.json(profile);
    } catch (error: any) {
        console.error('Error fetching tax profile:', error);
        res.status(500).json({ error: 'Failed to fetch tax profile', message: error.message });
    }
});

/**
 * PUT /api/tax/profile
 * Create or update tax profile
 */
router.put('/profile', async (req: Request, res: Response) => {
    try {
        const profile = await upsertTaxProfile((req as any).tenantId!, req.body);
        res.json(profile);
    } catch (error: any) {
        console.error('Error updating tax profile:', error);
        res.status(500).json({ error: 'Failed to update tax profile', message: error.message });
    }
});

/**
 * GET /api/tax/periods
 * List tax periods
 */
router.get('/periods', async (req: Request, res: Response) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 12;
        const periods = await listTaxPeriods((req as any).tenantId!, limit);
        res.json(periods);
    } catch (error: any) {
        console.error('Error listing tax periods:', error);
        res.status(500).json({ error: 'Failed to list tax periods', message: error.message });
    }
});

/**
 * GET /api/tax/periods/:id
 * Get tax period details
 */
router.get('/periods/:id', async (req: Request, res: Response) => {
    try {
        const period = await getTaxPeriodById((req as any).tenantId!, req.params.id);
        res.json(period);
    } catch (error: any) {
        console.error('Error fetching tax period:', error);
        res.status(404).json({ error: 'Tax period not found', message: error.message });
    }
});

/**
 * POST /api/tax/periods/calculate
 * Calculate tax period (preview, doesn't save)
 */
router.post('/periods/calculate', async (req: Request, res: Response) => {
    try {
        const { period_start, period_end } = req.body;

        if (!period_start || !period_end) {
            return res.status(400).json({ error: 'period_start and period_end are required' });
        }

        const aggregation = await calculateTaxPeriod((req as any).tenantId!, period_start, period_end);
        res.json(aggregation);
    } catch (error: any) {
        console.error('Error calculating tax period:', error);
        res.status(500).json({ error: 'Failed to calculate tax period', message: error.message });
    }
});

/**
 * POST /api/tax/periods
 * Save tax period
 */
router.post('/periods', async (req: Request, res: Response) => {
    try {
        const { period_start, period_end } = req.body;

        if (!period_start || !period_end) {
            return res.status(400).json({ error: 'period_start and period_end are required' });
        }

        const period = await saveTaxPeriod((req as any).tenantId!, period_start, period_end, 'calculated');
        res.json(period);
    } catch (error: any) {
        console.error('Error saving tax period:', error);
        res.status(500).json({ error: 'Failed to save tax period', message: error.message });
    }
});

/**
 * GET /api/tax/export/:year/:month
 * Export monthly tax report
 */
router.get('/export/:year/:month', async (req: Request, res: Response) => {
    try {
        const { year, month } = req.params;

        // Calculate period start and end
        const periodStart = `${year}-${month.padStart(2, '0')}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const periodEnd = `${year}-${month.padStart(2, '0')}-${lastDay}`;

        // Calculate tax period
        const calculation = await calculateTaxPeriod((req as any).tenantId!, periodStart, periodEnd);

        // For now, return JSON (PDF generation can be added later)
        res.json({
            period: `${month}/${year}`,
            period_start: periodStart,
            period_end: periodEnd,
            ...calculation
        });
    } catch (error: any) {
        console.error('Error exporting monthly report:', error);
        res.status(500).json({ error: 'Failed to export monthly report', message: error.message });
    }
});

/**
 * POST /api/tax/periods/:id/export
 * Export tax period (XML + PDF)
 */
router.post('/periods/:id/export', async (req: Request, res: Response) => {
    try {
        // TODO: Implement export logic in next phase
        // For now, just mark as exported
        const period = await markPeriodAsExported((req as any).tenantId!, req.params.id);

        res.json({
            message: 'Export functionality will be implemented in Phase 2',
            period
        });
    } catch (error: any) {
        console.error('Error exporting tax period:', error);
        res.status(500).json({ error: 'Failed to export tax period', message: error.message });
    }
});

export default router;
