/**
 * Audit Trail Service
 *
 * Immutable audit log for financially relevant operations.
 * Required for GoBD compliance and investor due diligence.
 *
 * Records:
 * - Invoice creation/cancellation
 * - Price changes
 * - Order status changes
 * - User permission changes
 * - GDPR data operations
 */

import { logger } from '@utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditAction =
  // Financial
  | 'invoice.created'
  | 'invoice.cancelled'
  | 'invoice.sent'
  // Orders
  | 'order.created'
  | 'order.status_changed'
  | 'order.cancelled'
  // Pricing
  | 'price_profile.created'
  | 'price_profile.updated'
  | 'price_profile.deleted'
  // User management
  | 'user.created'
  | 'user.role_changed'
  | 'user.deactivated'
  // GDPR
  | 'gdpr.data_exported'
  | 'gdpr.data_deleted'
  | 'gdpr.consent_recorded'
  // Settings
  | 'settings.updated'
  | 'tenant.settings_changed';

export interface AuditEntry {
  id?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  userId: string;
  merchantId: string;
  changes?: Record<string, { before: unknown; after: unknown }>;
  metadata?: Record<string, unknown>;
  ip?: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Postgres Database Accessor
// ---------------------------------------------------------------------------
import { db } from '@core/database';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Audit Service
// ---------------------------------------------------------------------------

/**
 * Record an audit entry. This is append-only (WORM semantics).
 * Entries should never be updated or deleted.
 */
export async function auditLog(
  action: AuditAction,
  entityType: string,
  entityId: string,
  userId: string,
  merchantId: string,
  options?: {
    changes?: Record<string, { before: unknown; after: unknown }>;
    metadata?: Record<string, unknown>;
    ip?: string;
  }
): Promise<void> {
  const entry: AuditEntry = {
    action,
    entityType,
    entityId,
    userId,
    merchantId,
    changes: options?.changes,
    metadata: options?.metadata,
    ip: options?.ip,
    timestamp: new Date().toISOString(),
  };

  try {
    await db.run(
        `INSERT INTO audit_log (
            id, action, entity_type, entity_id, user_id, 
            merchant_id, changes, metadata, ip, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            randomUUID(),
            entry.action,
            entry.entityType,
            entry.entityId,
            entry.userId,
            entry.merchantId,
            entry.changes ? JSON.stringify(entry.changes) : null,
            entry.metadata ? JSON.stringify(entry.metadata) : null,
            entry.ip || null,
            entry.timestamp
        ]
    );

    logger.info('[Audit] Entry recorded', {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
    });
  } catch (err: any) {
    // Audit failures must not crash the application,
    // but should be logged with highest severity
    logger.error('[Audit] CRITICAL: Failed to write audit entry', {
      error: err?.message,
      entry: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
      },
    });
  }
}

/**
 * Query audit entries (admin only).
 */
export async function queryAuditLog(filters: {
  entityType?: string;
  entityId?: string;
  action?: AuditAction;
  userId?: string;
  merchantId: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ entries: AuditEntry[]; total: number }> {
  try {
    let sql = `SELECT * FROM audit_log WHERE merchant_id = ?`;
    const params: any[] = [filters.merchantId];
    let countSql = `SELECT count(*) as total FROM audit_log WHERE merchant_id = ?`;
    const countParams: any[] = [filters.merchantId];

    if (filters.entityType) {
        sql += ` AND entity_type = ?`;
        countSql += ` AND entity_type = ?`;
        params.push(filters.entityType);
        countParams.push(filters.entityType);
    }
    if (filters.entityId) {
        sql += ` AND entity_id = ?`;
        countSql += ` AND entity_id = ?`;
        params.push(filters.entityId);
        countParams.push(filters.entityId);
    }
    if (filters.action) {
        sql += ` AND action = ?`;
        countSql += ` AND action = ?`;
        params.push(filters.action);
        countParams.push(filters.action);
    }
    if (filters.userId) {
        sql += ` AND user_id = ?`;
        countSql += ` AND user_id = ?`;
        params.push(filters.userId);
        countParams.push(filters.userId);
    }
    if (filters.startDate) {
        sql += ` AND created_at >= ?`;
        countSql += ` AND created_at >= ?`;
        params.push(filters.startDate);
        countParams.push(filters.startDate);
    }
    if (filters.endDate) {
        sql += ` AND created_at <= ?`;
        countSql += ` AND created_at <= ?`;
        params.push(filters.endDate);
        countParams.push(filters.endDate);
    }

    sql += ` ORDER BY created_at DESC`;

    if (filters.limit) {
        sql += ` LIMIT ?`;
        params.push(filters.limit);
    }
    if (filters.offset) {
        sql += ` OFFSET ?`;
        params.push(filters.offset);
    }

    const data = await db.all<any>(sql, params);
    const countResult = await db.get<{ total: number }>(countSql, countParams);

    return {
      entries: (data || []).map((row: any) => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        userId: row.user_id,
        merchantId: row.merchant_id,
        changes: typeof row.changes === 'string' ? JSON.parse(row.changes) : row.changes,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        ip: row.ip,
        timestamp: row.created_at,
      })),
      total: countResult?.total ? Number(countResult.total) : 0,
    };
  } catch (err: any) {
    logger.error('[Audit] Query failed', { error: err?.message });
    return { entries: [], total: 0 };
  }
}
