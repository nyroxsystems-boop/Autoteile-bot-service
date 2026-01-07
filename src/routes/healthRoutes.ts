// Health Check Routes
// Extended health checks for diagnostics and monitoring

import { Router, Request, Response } from 'express';
import { getDb } from '../services/core/database';

const router = Router();

/**
 * GET /health/migrations
 * Verify that tax module tables exist
 */
router.get('/migrations', async (req: Request, res: Response) => {
    try {
        const pool = getDb();

        // Check if tax module tables exist
        const result = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('invoices', 'invoice_lines', 'tax_profiles', 'tax_periods')
            ORDER BY table_name
        `);

        const tables = result.rows.map(row => row.table_name);
        const expectedTables = ['invoices', 'invoice_lines', 'tax_profiles', 'tax_periods'];
        const missingTables = expectedTables.filter(t => !tables.includes(t));

        if (missingTables.length > 0) {
            return res.status(500).json({
                status: 'error',
                message: 'Some tax module tables are missing',
                tables_found: tables,
                tables_missing: missingTables
            });
        }

        // Check invoice count
        const invoiceCount = await pool.query('SELECT COUNT(*) as count FROM invoices');

        res.json({
            status: 'ok',
            message: 'All tax module tables exist',
            tables: tables,
            invoice_count: parseInt(invoiceCount.rows[0].count)
        });
    } catch (error: any) {
        console.error('[Health] Migration check failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message,
            hint: 'Tax module migrations may not have run. Check startup logs.'
        });
    }
});

/**
 * GET /health/db
 * Basic database connectivity check
 */
router.get('/db', async (req: Request, res: Response) => {
    try {
        const pool = getDb();
        await pool.query('SELECT 1');
        res.json({ status: 'ok', message: 'Database connection successful' });
    } catch (error: any) {
        console.error('[Health] Database check failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

export default router;
