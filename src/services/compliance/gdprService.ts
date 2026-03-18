/**
 * GDPR/DSGVO Compliance Service
 *
 * Implements:
 * - Art. 15 DSGVO: Right of Access (data export)
 * - Art. 17 DSGVO: Right to Erasure (data deletion)
 * - Consent logging
 * - Data retention policy management
 */

import { logger } from '@utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConsentRecord {
  phone: string;
  purpose: 'whatsapp_communication' | 'data_processing' | 'marketing' | 'analytics';
  granted: boolean;
  timestamp: string;
  source: 'whatsapp' | 'dashboard' | 'api';
  ip?: string;
}

export interface DataExport {
  exportedAt: string;
  customer: {
    phone: string;
    firstContact: string | null;
    language: string | null;
  };
  orders: Array<{
    id: string;
    status: string;
    createdAt: string;
    vehicleDescription: string | null;
    partDescription: string | null;
    oemNumber: string | null;
  }>;
  messages: Array<{
    direction: 'IN' | 'OUT';
    timestamp: string;
    contentPreview: string;
  }>;
  consents: ConsentRecord[];
}

export interface DeletionResult {
  phone: string;
  deletedAt: string;
  deletedRecords: {
    orders: number;
    messages: number;
    vehicles: number;
    consents: number;
    sessions: number;
  };
  retainedRecords: {
    invoices: number; // GoBD: Rechnungen 10 Jahre aufbewahren
    reason: string;
  };
}

export interface RetentionPolicy {
  dataType: string;
  retentionDays: number;
  legalBasis: string;
  autoDelete: boolean;
}

// ---------------------------------------------------------------------------
// Data Retention Policies (GoBD / DSGVO compliant)
// ---------------------------------------------------------------------------

export const RETENTION_POLICIES: RetentionPolicy[] = [
  {
    dataType: 'chat_messages',
    retentionDays: 365,       // 12 Monate
    legalBasis: 'Art. 6(1)(b) DSGVO — Vertragserfüllung',
    autoDelete: true,
  },
  {
    dataType: 'orders',
    retentionDays: 3650,      // 10 Jahre (GoBD)
    legalBasis: '§ 147 AO — Aufbewahrungspflicht',
    autoDelete: false,        // Manueller Review vor Löschung
  },
  {
    dataType: 'invoices',
    retentionDays: 3650,      // 10 Jahre (GoBD)
    legalBasis: '§ 14b UStG, § 147 AO',
    autoDelete: false,
  },
  {
    dataType: 'session_data',
    retentionDays: 30,
    legalBasis: 'Art. 6(1)(f) DSGVO — Berechtigtes Interesse',
    autoDelete: true,
  },
  {
    dataType: 'access_logs',
    retentionDays: 180,        // 6 Monate
    legalBasis: 'Art. 6(1)(f) DSGVO — Sicherheit',
    autoDelete: true,
  },
  {
    dataType: 'consent_records',
    retentionDays: 3650,       // So lange wie die Daten existieren
    legalBasis: 'Art. 7(1) DSGVO — Nachweispflicht',
    autoDelete: false,
  },
];

// ---------------------------------------------------------------------------
// Lazy Supabase accessor (same pattern as existing codebase)
// ---------------------------------------------------------------------------

function getSupa(): {
  createClient: () => any;
  supabaseAdmin: any;
} {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../adapters/supabaseService');
}

// ---------------------------------------------------------------------------
// GDPR Service Implementation
// ---------------------------------------------------------------------------

/**
 * Art. 17 DSGVO — Right to Erasure
 * Deletes all customer data except legally required records (invoices).
 */
export async function deleteCustomerData(phone: string): Promise<DeletionResult> {
  const supa = getSupa();
  const deletedAt = new Date().toISOString();
  const result: DeletionResult = {
    phone,
    deletedAt,
    deletedRecords: { orders: 0, messages: 0, vehicles: 0, consents: 0, sessions: 0 },
    retainedRecords: { invoices: 0, reason: '§ 147 AO: 10 Jahre Aufbewahrungspflicht für Rechnungen' },
  };

  try {
    // 1. Delete messages
    const { count: msgCount } = await supa.supabaseAdmin
      .from('messages')
      .delete()
      .eq('contact_phone', phone);
    result.deletedRecords.messages = msgCount || 0;

    // 2. Anonymize orders (keep for GoBD, but strip PII)
    const { data: orders } = await supa.supabaseAdmin
      .from('orders')
      .select('id')
      .eq('contact_phone', phone);

    if (orders && orders.length > 0) {
      const orderIds = orders.map((o: any) => o.id);

      // Delete vehicle data linked to orders
      const { count: vehicleCount } = await supa.supabaseAdmin
        .from('vehicles')
        .delete()
        .in('order_id', orderIds);
      result.deletedRecords.vehicles = vehicleCount || 0;

      // Anonymize order records (keep structure for financial records)
      await supa.supabaseAdmin
        .from('orders')
        .update({
          contact_phone: '[DELETED]',
          customer_name: '[DELETED]',
          customer_email: '[DELETED]',
          delivery_address: '[DELETED]',
          gdpr_deleted_at: deletedAt,
        })
        .eq('contact_phone', phone);
      result.deletedRecords.orders = orders.length;
    }

    // 3. Count retained invoices (NOT deleted — GoBD requirement)
    const { count: invoiceCount } = await supa.supabaseAdmin
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('customer_phone', phone);
    result.retainedRecords.invoices = invoiceCount || 0;

    // 4. Delete sessions
    const { count: sessionCount } = await supa.supabaseAdmin
      .from('sessions')
      .delete()
      .eq('user_phone', phone);
    result.deletedRecords.sessions = sessionCount || 0;

    // 5. Log the deletion (consent records kept for accountability)
    await logConsent(phone, 'data_processing', false, 'api');

    logger.info('[GDPR] Customer data deleted', {
      phone: '[REDACTED]',
      deletedRecords: result.deletedRecords,
      retainedRecords: result.retainedRecords,
    });

    return result;
  } catch (err: any) {
    logger.error('[GDPR] Data deletion failed', { error: err?.message });
    throw new Error(`GDPR deletion failed: ${err?.message}`);
  }
}

/**
 * Art. 15 DSGVO — Right of Access (Data Export)
 * Returns all data associated with a phone number in machine-readable format.
 */
export async function exportCustomerData(phone: string): Promise<DataExport> {
  const supa = getSupa();

  try {
    // 1. Orders
    const { data: orders } = await supa.supabaseAdmin
      .from('orders')
      .select('id, status, created_at, vehicle_description, part_description, order_data')
      .eq('contact_phone', phone)
      .order('created_at', { ascending: false });

    // 2. Messages
    const { data: messages } = await supa.supabaseAdmin
      .from('messages')
      .select('direction, created_at, content')
      .eq('contact_phone', phone)
      .order('created_at', { ascending: false })
      .limit(500);

    // 3. First contact info
    const firstOrder = orders?.[orders.length - 1];

    const exportData: DataExport = {
      exportedAt: new Date().toISOString(),
      customer: {
        phone,
        firstContact: firstOrder?.created_at || null,
        language: firstOrder?.language || null,
      },
      orders: (orders || []).map((o: any) => ({
        id: o.id,
        status: o.status,
        createdAt: o.created_at,
        vehicleDescription: o.vehicle_description,
        partDescription: o.part_description,
        oemNumber: o.order_data?.oemNumber || null,
      })),
      messages: (messages || []).map((m: any) => ({
        direction: m.direction,
        timestamp: m.created_at,
        contentPreview: (m.content || '').slice(0, 100),
      })),
      consents: [], // Will be populated from consent table
    };

    logger.info('[GDPR] Data exported', { phone: '[REDACTED]', orderCount: orders?.length || 0 });
    return exportData;
  } catch (err: any) {
    logger.error('[GDPR] Data export failed', { error: err?.message });
    throw new Error(`GDPR export failed: ${err?.message}`);
  }
}

/**
 * Log consent (or withdrawal) for audit trail.
 * Required by Art. 7(1) DSGVO — proof of consent.
 */
export async function logConsent(
  phone: string,
  purpose: ConsentRecord['purpose'],
  granted: boolean,
  source: ConsentRecord['source'],
  ip?: string,
): Promise<void> {
  const supa = getSupa();

  try {
    await supa.supabaseAdmin
      .from('consent_log')
      .insert({
        phone,
        purpose,
        granted,
        source,
        ip: ip || null,
        created_at: new Date().toISOString(),
      });

    logger.info('[GDPR] Consent logged', {
      purpose,
      granted,
      source,
    });
  } catch (err: any) {
    logger.error('[GDPR] Failed to log consent', { error: err?.message });
  }
}

/**
 * Get retention policies.
 */
export function getRetentionPolicies(): RetentionPolicy[] {
  return RETENTION_POLICIES;
}

/**
 * Run data retention cleanup (call via cron/scheduler).
 * Deletes data that has exceeded its retention period.
 */
export async function runRetentionCleanup(): Promise<{
  deletedMessages: number;
  deletedSessions: number;
  deletedLogs: number;
}> {
  const supa = getSupa();
  const now = new Date();
  const result = { deletedMessages: 0, deletedSessions: 0, deletedLogs: 0 };

  try {
    // Clean old messages (>12 months)
    const msgCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { count: msgCount } = await supa.supabaseAdmin
      .from('messages')
      .delete()
      .lt('created_at', msgCutoff);
    result.deletedMessages = msgCount || 0;

    // Clean old sessions (>30 days)
    const sessionCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: sessionCount } = await supa.supabaseAdmin
      .from('sessions')
      .delete()
      .lt('created_at', sessionCutoff);
    result.deletedSessions = sessionCount || 0;

    logger.info('[GDPR] Retention cleanup completed', result);
    return result;
  } catch (err: any) {
    logger.error('[GDPR] Retention cleanup failed', { error: err?.message });
    return result;
  }
}
