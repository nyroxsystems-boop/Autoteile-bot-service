// Health Check Routes — Extended diagnostics
// Checks: Database, Redis, Queue Worker, System Info

import { Router, Request, Response } from 'express';
import { logger } from "@utils/logger";
import { getDb } from '../services/core/database';

const router = Router();

// ── Singleton Redis connection for health checks ──
let healthRedis: any = null;
let healthRedisReady = false;

function getHealthRedis(): any {
    if (healthRedis) return healthRedis;
    const url = process.env.REDIS_URL;
    if (!url) return null;

    try {
        const IORedis = require('ioredis');
        healthRedis = new IORedis(url, {
            connectTimeout: 3000,
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 2000)),
        });
        healthRedis.on('connect', () => { healthRedisReady = true; });
        healthRedis.on('error', (err: Error) => {
            healthRedisReady = false;
            logger.debug('[Health] Redis connection error', { error: err.message });
        });
        healthRedis.on('close', () => { healthRedisReady = false; });
        healthRedis.connect().catch(() => { healthRedisReady = false; });
        return healthRedis;
    } catch (err) {
        logger.warn('[Health] Failed to create Redis client', { error: err });
        return null;
    }
}

/**
 * GET /health — Comprehensive health check
 */
router.get('/', async (req: Request, res: Response) => {
    const checks: Record<string, { status: string; latencyMs?: number; detail?: string }> = {};
    let overallStatus = 'ok';

    // 1. Database check
    const dbStart = Date.now();
    try {
        const pool = getDb();
        await pool.query('SELECT 1');
        checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
    } catch (err: any) {
        checks.database = { status: 'error', detail: err?.message };
        overallStatus = 'degraded';
    }

    // 2. Redis check (singleton connection — no leak)
    const redisStart = Date.now();
    try {
        const redis = getHealthRedis();
        if (redis && healthRedisReady) {
            await redis.ping();
            checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart };
        } else if (redis) {
            checks.redis = { status: 'connecting', detail: 'Redis client initializing' };
        } else {
            checks.redis = { status: 'not_configured', detail: 'REDIS_URL not set' };
        }
    } catch (err: any) {
        checks.redis = { status: 'error', latencyMs: Date.now() - redisStart, detail: err?.message };
        overallStatus = 'degraded';
    }

    // 3. System info
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    checks.system = {
        status: 'ok',
        detail: `uptime: ${Math.floor(uptime / 60)}min, heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB/${Math.round(memUsage.heapTotal / 1024 / 1024)}MB, rss: ${Math.round(memUsage.rss / 1024 / 1024)}MB`,
    };

    // 4. AI service (Gemini API key present)
    checks.ai = {
        status: process.env.GEMINI_API_KEY ? 'configured' : 'not_configured',
        detail: process.env.GEMINI_API_KEY ? 'GEMINI_API_KEY set' : 'GEMINI_API_KEY missing — AI features disabled',
    };
    if (!process.env.GEMINI_API_KEY) overallStatus = 'degraded';

    const statusCode = overallStatus === 'ok' ? 200 : 503;
    res.status(statusCode).json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        node: process.version,
        checks,
    });
});

/**
 * GET /health/migrations — Verify tax module tables
 */
router.get('/migrations', async (req: Request, res: Response) => {
    try {
        const pool = getDb();

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

        const invoiceCount = await pool.query('SELECT COUNT(*) as count FROM invoices');

        res.json({
            status: 'ok',
            message: 'All tax module tables exist',
            tables: tables,
            invoice_count: parseInt(invoiceCount.rows[0].count)
        });
    } catch (error: any) {
        logger.error('[Health] Migration check failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message,
            hint: 'Tax module migrations may not have run. Check startup logs.'
        });
    }
});

/**
 * GET /health/db — Basic database connectivity
 */
router.get('/db', async (req: Request, res: Response) => {
    try {
        const pool = getDb();
        await pool.query('SELECT 1');
        res.json({ status: 'ok', message: 'Database connection successful' });
    } catch (error: any) {
        logger.error('[Health] Database check failed:', error);
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

export default router;

/**
 * GET /health/ready — Kubernetes readiness probe
 * Returns 200 only when the service can handle requests.
 * Used by load balancers to check if they should route traffic here.
 */
router.get('/ready', async (req: Request, res: Response) => {
    try {
        const pool = getDb();
        const start = Date.now();
        await pool.query('SELECT 1');
        const latency = Date.now() - start;

        // Consider unhealthy if DB latency > 5 seconds
        if (latency > 5000) {
            return res.status(503).json({
                ready: false,
                reason: `Database latency too high: ${latency}ms`,
            });
        }

        res.json({ ready: true, latencyMs: latency });
    } catch (error: any) {
        res.status(503).json({
            ready: false,
            reason: error.message || 'Database unreachable',
        });
    }
});

/**
 * GET /health/live — Kubernetes liveness probe
 * Always returns 200 if the process is running.
 */
router.get('/live', (_req: Request, res: Response) => {
    res.json({ alive: true, uptime: Math.floor(process.uptime()) });
});
