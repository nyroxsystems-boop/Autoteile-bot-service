/**
 * GDPR/DSGVO API Routes
 *
 * Endpoints:
 * - DELETE /api/v1/gdpr/customers/:phone   — Right to Erasure (Art. 17)
 * - GET    /api/v1/gdpr/customers/:phone   — Right of Access / Data Export (Art. 15)
 * - POST   /api/v1/gdpr/consent            — Record consent
 * - GET    /api/v1/gdpr/retention-policies  — View retention policies
 * - POST   /api/v1/gdpr/retention/cleanup   — Trigger retention cleanup (admin)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '@utils/logger';
import {
  deleteCustomerData,
  exportCustomerData,
  logConsent,
  getRetentionPolicies,
  runRetentionCleanup,
} from '../services/compliance/gdprService';

const router = Router();

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

const phoneSchema = z.string()
  .min(8, 'Phone number too short')
  .max(20, 'Phone number too long')
  .regex(/^\+?[\d\s\-()]+$/, 'Invalid phone format');

const consentSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(['whatsapp_communication', 'data_processing', 'marketing', 'analytics']),
  granted: z.boolean(),
  source: z.enum(['whatsapp', 'dashboard', 'api']).default('api'),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * DELETE /api/v1/gdpr/customers/:phone
 * Art. 17 DSGVO — Right to Erasure
 */
router.delete('/customers/:phone', async (req: Request, res: Response) => {
  try {
    const phone = phoneSchema.parse(req.params.phone);

    // Require admin role for deletion
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
      res.status(403).json({ error: 'Admin access required for data deletion' });
      return;
    }

    const result = await deleteCustomerData(phone);

    logger.info('[GDPR Route] Customer data deleted', {
      deletedRecords: result.deletedRecords,
      retainedRecords: result.retainedRecords,
    });

    res.json({
      success: true,
      message: 'Customer data deleted per DSGVO Art. 17',
      result,
    });
  } catch (err: any) {
    logger.error('[GDPR Route] Deletion failed', { error: err?.message });
    res.status(500).json({ error: 'Data deletion failed', details: err?.message });
  }
});

/**
 * GET /api/v1/gdpr/customers/:phone
 * Art. 15 DSGVO — Right of Access (Data Export)
 */
router.get('/customers/:phone', async (req: Request, res: Response) => {
  try {
    const phone = phoneSchema.parse(req.params.phone);

    // Require admin or self-service (phone match)
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
      res.status(403).json({ error: 'Admin access required for data export' });
      return;
    }

    const exportData = await exportCustomerData(phone);

    res.json({
      success: true,
      message: 'Data export per DSGVO Art. 15',
      data: exportData,
    });
  } catch (err: any) {
    logger.error('[GDPR Route] Export failed', { error: err?.message });
    res.status(500).json({ error: 'Data export failed', details: err?.message });
  }
});

/**
 * POST /api/v1/gdpr/consent
 * Record consent or withdrawal
 */
router.post('/consent', async (req: Request, res: Response) => {
  try {
    const parsed = consentSchema.parse(req.body);

    await logConsent(
      parsed.phone,
      parsed.purpose,
      parsed.granted,
      parsed.source,
      req.ip || undefined,
    );

    res.json({
      success: true,
      message: parsed.granted ? 'Consent recorded' : 'Consent withdrawal recorded',
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    logger.error('[GDPR Route] Consent logging failed', { error: err?.message });
    res.status(500).json({ error: 'Failed to log consent' });
  }
});

/**
 * GET /api/v1/gdpr/retention-policies
 * View configured data retention policies
 */
router.get('/retention-policies', (_req: Request, res: Response) => {
  res.json({
    success: true,
    policies: getRetentionPolicies(),
  });
});

/**
 * POST /api/v1/gdpr/retention/cleanup
 * Trigger manual retention cleanup (admin only)
 */
router.post('/retention/cleanup', async (req: Request, res: Response) => {
  try {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const result = await runRetentionCleanup();

    res.json({
      success: true,
      message: 'Retention cleanup completed',
      result,
    });
  } catch (err: any) {
    logger.error('[GDPR Route] Cleanup failed', { error: err?.message });
    res.status(500).json({ error: 'Cleanup failed', details: err?.message });
  }
});

export default router;
