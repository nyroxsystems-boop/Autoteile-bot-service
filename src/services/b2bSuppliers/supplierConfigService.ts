// B2B Supplier Configuration Service
// Manages supplier settings per tenant

import { db } from '@core/database';
import { randomUUID } from 'crypto';
import type { B2BSupplierConfig, B2BSupplierName, PriceTier } from './types';

/**
 * Get all supplier configs for a tenant
 */
export async function getSupplierConfigs(tenantId: string): Promise<B2BSupplierConfig[]> {
    const configs = await db.all<B2BSupplierConfig>(
        `SELECT * FROM b2b_supplier_configs 
     WHERE tenant_id = ? OR tenant_id = 'default'
     ORDER BY priority ASC`,
        [tenantId]
    );

    // Convert SQLite integers to booleans
    return (configs || []).map(c => ({
        ...c,
        enabled: Boolean(c.enabled)
    }));
}

/**
 * Get enabled supplier configs for a tenant (in priority order)
 */
export async function getEnabledSuppliers(tenantId: string): Promise<B2BSupplierConfig[]> {
    const configs = await db.all<B2BSupplierConfig>(
        `SELECT * FROM b2b_supplier_configs 
     WHERE (tenant_id = ? OR tenant_id = 'default') AND enabled = 1
     ORDER BY priority ASC`,
        [tenantId]
    );

    return (configs || []).map(c => ({
        ...c,
        enabled: true
    }));
}

/**
 * Get a specific supplier config
 */
export async function getSupplierConfig(
    tenantId: string,
    supplierName: B2BSupplierName
): Promise<B2BSupplierConfig | null> {
    // First try tenant-specific config
    let config = await db.get<B2BSupplierConfig>(
        `SELECT * FROM b2b_supplier_configs 
     WHERE tenant_id = ? AND supplier_name = ?`,
        [tenantId, supplierName]
    );

    // Fallback to default
    if (!config) {
        config = await db.get<B2BSupplierConfig>(
            `SELECT * FROM b2b_supplier_configs 
       WHERE tenant_id = 'default' AND supplier_name = ?`,
            [supplierName]
        );
    }

    if (!config) return null;

    return {
        ...config,
        enabled: Boolean(config.enabled)
    };
}

/**
 * Create or update supplier config for a tenant
 */
export async function upsertSupplierConfig(
    tenantId: string,
    supplierName: B2BSupplierName,
    data: Partial<B2BSupplierConfig>
): Promise<B2BSupplierConfig> {
    const existing = await db.get<B2BSupplierConfig>(
        `SELECT * FROM b2b_supplier_configs WHERE tenant_id = ? AND supplier_name = ?`,
        [tenantId, supplierName]
    );

    const now = new Date().toISOString();

    if (existing) {
        // Update
        await db.run(
            `UPDATE b2b_supplier_configs SET
        enabled = COALESCE(?, enabled),
        api_key = COALESCE(?, api_key),
        api_secret = COALESCE(?, api_secret),
        account_number = COALESCE(?, account_number),
        username = COALESCE(?, username),
        price_tier = COALESCE(?, price_tier),
        margin_type = COALESCE(?, margin_type),
        margin_value = COALESCE(?, margin_value),
        minimum_margin = COALESCE(?, minimum_margin),
        rounding_strategy = COALESCE(?, rounding_strategy),
        round_to = COALESCE(?, round_to),
        priority = COALESCE(?, priority),
        updated_at = ?
       WHERE tenant_id = ? AND supplier_name = ?`,
            [
                data.enabled !== undefined ? (data.enabled ? 1 : 0) : null,
                data.api_key,
                data.api_secret,
                data.account_number,
                data.username,
                data.price_tier,
                data.margin_type,
                data.margin_value,
                data.minimum_margin,
                data.rounding_strategy,
                data.round_to,
                data.priority,
                now,
                tenantId,
                supplierName
            ]
        );
    } else {
        // Insert new
        const id = randomUUID();
        await db.run(
            `INSERT INTO b2b_supplier_configs (
        id, tenant_id, supplier_name, enabled,
        api_key, api_secret, account_number, username,
        price_tier, margin_type, margin_value, minimum_margin,
        rounding_strategy, round_to, priority,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                tenantId,
                supplierName,
                data.enabled ? 1 : 0,
                data.api_key || null,
                data.api_secret || null,
                data.account_number || null,
                data.username || null,
                data.price_tier || 'basic',
                data.margin_type || 'percentage',
                data.margin_value ?? 15,
                data.minimum_margin ?? 5,
                data.rounding_strategy || 'up',
                data.round_to ?? 0.99,
                data.priority ?? 100,
                now,
                now
            ]
        );
    }

    const result = await getSupplierConfig(tenantId, supplierName);
    if (!result) throw new Error('Failed to save supplier config');
    return result;
}

/**
 * Delete supplier config (resets to default)
 */
export async function deleteSupplierConfig(
    tenantId: string,
    supplierName: B2BSupplierName
): Promise<void> {
    await db.run(
        `DELETE FROM b2b_supplier_configs WHERE tenant_id = ? AND supplier_name = ?`,
        [tenantId, supplierName]
    );
}

/**
 * Get all available suppliers with their display info
 */
export function getAvailableSuppliers(): Array<{
    name: B2BSupplierName;
    displayName: string;
    description: string;
    hasApi: boolean;
    website: string;
}> {
    return [
        {
            name: 'inter_cars',
            displayName: 'Inter Cars',
            description: 'Größter Autoteile-Großhändler in Mitteleuropa mit vollständiger REST API',
            hasApi: true,
            website: 'https://intercars.eu'
        },
        {
            name: 'moto_profil',
            displayName: 'Moto-Profil (ProfiAuto)',
            description: 'Polnischer Großhändler mit ProfiAuto Katalog und ProfiBiznes Software',
            hasApi: false,
            website: 'https://moto-profil.pl'
        },
        {
            name: 'auto_partner',
            displayName: 'Auto Partner',
            description: 'B2B-Plattform mit WEBterminal Integration',
            hasApi: false,
            website: 'https://autopartner.com'
        },
        {
            name: 'gordon',
            displayName: 'Gordon',
            description: 'Hurtownia Motoryzacyjna mit Web-Katalog',
            hasApi: false,
            website: 'https://gordon.com.pl'
        }
    ];
}
