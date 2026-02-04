// B2B Supplier Service
// Manages supplier configurations per tenant

import { db } from '@core/database';
import { randomUUID } from 'crypto';
import { getSupplier, getAllSuppliers, type SupplierConfig, type SupplierDefinition } from './types';

/**
 * Get all supplier configs for a tenant
 */
export async function getSupplierConfigs(tenantId: string): Promise<SupplierConfig[]> {
    const configs = await db.all<SupplierConfig>(
        `SELECT * FROM b2b_supplier_configs WHERE tenant_id = ? ORDER BY supplier_key`,
        [tenantId]
    );
    return (configs || []).map(parseConfig);
}

/**
 * Get a specific supplier config
 */
export async function getSupplierConfig(tenantId: string, supplierKey: string): Promise<SupplierConfig | null> {
    const config = await db.get<SupplierConfig>(
        `SELECT * FROM b2b_supplier_configs WHERE tenant_id = ? AND supplier_key = ?`,
        [tenantId, supplierKey]
    );
    return config ? parseConfig(config) : null;
}

/**
 * Create or update supplier config
 */
export async function upsertSupplierConfig(
    tenantId: string,
    supplierKey: string,
    data: { enabled?: boolean; credentials?: Record<string, string>; settings?: Record<string, any> }
): Promise<SupplierConfig> {
    const definition = getSupplier(supplierKey);
    if (!definition) throw new Error(`Unknown supplier: ${supplierKey}`);

    const existing = await getSupplierConfig(tenantId, supplierKey);
    const now = new Date().toISOString();

    if (existing) {
        // Merge credentials (keep existing if not provided)
        const newCreds = { ...existing.credentials };
        if (data.credentials) {
            Object.entries(data.credentials).forEach(([k, v]) => {
                if (v && v.trim() !== '') newCreds[k] = v;
            });
        }

        const newSettings = { ...existing.settings, ...(data.settings || {}) };

        await db.run(
            `UPDATE b2b_supplier_configs SET
        enabled = COALESCE(?, enabled),
        credentials = ?,
        settings = ?,
        updated_at = ?
       WHERE tenant_id = ? AND supplier_key = ?`,
            [
                data.enabled !== undefined ? (data.enabled ? 1 : 0) : null,
                JSON.stringify(newCreds),
                JSON.stringify(newSettings),
                now,
                tenantId,
                supplierKey
            ]
        );
    } else {
        await db.run(
            `INSERT INTO b2b_supplier_configs (id, tenant_id, supplier_key, enabled, credentials, settings, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                randomUUID(),
                tenantId,
                supplierKey,
                data.enabled ? 1 : 0,
                JSON.stringify(data.credentials || {}),
                JSON.stringify(data.settings || {}),
                'disconnected',
                now,
                now
            ]
        );
    }

    const result = await getSupplierConfig(tenantId, supplierKey);
    if (!result) throw new Error('Failed to save config');
    return result;
}

/**
 * Delete supplier config
 */
export async function deleteSupplierConfig(tenantId: string, supplierKey: string): Promise<void> {
    await db.run(
        `DELETE FROM b2b_supplier_configs WHERE tenant_id = ? AND supplier_key = ?`,
        [tenantId, supplierKey]
    );
}

/**
 * Get all suppliers with their configs (for UI)
 */
export async function getSuppliersWithConfigs(tenantId: string): Promise<Array<SupplierDefinition & { config: SupplierConfig | null; isEnabled: boolean }>> {
    const configs = await getSupplierConfigs(tenantId);
    const configMap = new Map(configs.map(c => [c.supplier_key, c]));

    return getAllSuppliers().map(supplier => ({
        ...supplier,
        config: configMap.get(supplier.key) || null,
        isEnabled: configMap.get(supplier.key)?.enabled || false
    }));
}

/**
 * Get enabled suppliers for ordering
 */
export async function getEnabledSuppliers(tenantId: string): Promise<SupplierConfig[]> {
    const configs = await db.all<SupplierConfig>(
        `SELECT * FROM b2b_supplier_configs WHERE tenant_id = ? AND enabled = 1`,
        [tenantId]
    );
    return (configs || []).map(parseConfig);
}

function parseConfig(config: any): SupplierConfig {
    return {
        ...config,
        enabled: Boolean(config.enabled),
        credentials: typeof config.credentials === 'string' ? JSON.parse(config.credentials) : (config.credentials || {}),
        settings: typeof config.settings === 'string' ? JSON.parse(config.settings) : (config.settings || {})
    };
}
