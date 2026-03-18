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
// Lazy Supabase accessor
// ---------------------------------------------------------------------------

function getSupa(): { supabaseAdmin: any } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../adapters/supabaseService');
}

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
    const supa = getSupa();
    await supa.supabaseAdmin
      .from('audit_log')
      .insert({
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        user_id: entry.userId,
        merchant_id: entry.merchantId,
        changes: entry.changes ? JSON.stringify(entry.changes) : null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ip: entry.ip || null,
        created_at: entry.timestamp,
      });

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
    const supa = getSupa();
    let query = supa.supabaseAdmin
      .from('audit_log')
      .select('*', { count: 'exact' })
      .eq('merchant_id', filters.merchantId)
      .order('created_at', { ascending: false });

    if (filters.entityType) query = query.eq('entity_type', filters.entityType);
    if (filters.entityId) query = query.eq('entity_id', filters.entityId);
    if (filters.action) query = query.eq('action', filters.action);
    if (filters.userId) query = query.eq('user_id', filters.userId);
    if (filters.startDate) query = query.gte('created_at', filters.startDate);
    if (filters.endDate) query = query.lte('created_at', filters.endDate);
    if (filters.limit) query = query.limit(filters.limit);
    if (filters.offset) query = query.range(filters.offset, (filters.offset + (filters.limit || 50)) - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    return {
      entries: (data || []).map((row: any) => ({
        id: row.id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        userId: row.user_id,
        merchantId: row.merchant_id,
        changes: row.changes ? JSON.parse(row.changes) : undefined,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        ip: row.ip,
        timestamp: row.created_at,
      })),
      total: count || 0,
    };
  } catch (err: any) {
    logger.error('[Audit] Query failed', { error: err?.message });
    return { entries: [], total: 0 };
  }
}
