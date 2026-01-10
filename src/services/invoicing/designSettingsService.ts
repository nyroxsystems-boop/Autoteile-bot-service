// Billing Design Settings Service
// Manages PDF design customization settings per tenant

import { randomUUID } from 'crypto';
import { db } from '@core/database';

export interface BillingDesignSettings {
    id: string;
    tenant_id: string;
    invoice_color: string;
    accent_color: string;
    invoice_font: string;
    logo_position: 'left' | 'center' | 'right';
    number_position: 'left' | 'right';
    address_layout: 'two-column' | 'gestapelt';
    table_style: 'grid' | 'minimal' | 'gestreift';
    logo_base64?: string;
    company_name?: string;
    company_address?: string;
    company_city?: string;
    company_zip?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateDesignSettingsRequest {
    invoice_color?: string;
    accent_color?: string;
    invoice_font?: string;
    logo_position?: 'left' | 'center' | 'right';
    number_position?: 'left' | 'right';
    address_layout?: 'two-column' | 'gestapelt';
    table_style?: 'grid' | 'minimal' | 'gestreift';
    logo_base64?: string;
    company_name?: string;
    company_address?: string;
    company_city?: string;
    company_zip?: string;
}

/**
 * Get design settings for a tenant
 * Returns null if not configured
 */
export async function getDesignSettings(tenantId: string): Promise<BillingDesignSettings | null> {
    const settings = await db.get<BillingDesignSettings>(
        'SELECT * FROM billing_design_settings WHERE tenant_id = ?',
        [tenantId]
    );

    return settings || null;
}

/**
 * Create or update design settings for a tenant
 */
export async function upsertDesignSettings(
    tenantId: string,
    data: CreateDesignSettingsRequest
): Promise<BillingDesignSettings> {
    const existing = await getDesignSettings(tenantId);
    const now = new Date().toISOString();

    if (existing) {
        // Update existing settings
        await db.run(
            `UPDATE billing_design_settings 
             SET invoice_color = ?,
                 accent_color = ?,
                 invoice_font = ?,
                 logo_position = ?,
                 number_position = ?,
                 address_layout = ?,
                 table_style = ?,
                 logo_base64 = ?,
                 company_name = ?,
                 company_address = ?,
                 company_city = ?,
                 company_zip = ?,
                 updated_at = ?
             WHERE tenant_id = ?`,
            [
                data.invoice_color || existing.invoice_color,
                data.accent_color || existing.accent_color,
                data.invoice_font || existing.invoice_font,
                data.logo_position || existing.logo_position,
                data.number_position || existing.number_position,
                data.address_layout || existing.address_layout,
                data.table_style || existing.table_style,
                data.logo_base64 !== undefined ? data.logo_base64 : existing.logo_base64,
                data.company_name !== undefined ? data.company_name : existing.company_name,
                data.company_address !== undefined ? data.company_address : existing.company_address,
                data.company_city !== undefined ? data.company_city : existing.company_city,
                data.company_zip !== undefined ? data.company_zip : existing.company_zip,
                now,
                tenantId
            ]
        );
    } else {
        // Create new settings
        const id = randomUUID();
        await db.run(
            `INSERT INTO billing_design_settings (
                id, tenant_id, invoice_color, accent_color, invoice_font,
                logo_position, number_position, address_layout, table_style,
                logo_base64, company_name, company_address, company_city, company_zip,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                tenantId,
                data.invoice_color || '#000000',
                data.accent_color || '#f3f4f6',
                data.invoice_font || 'helvetica',
                data.logo_position || 'left',
                data.number_position || 'right',
                data.address_layout || 'two-column',
                data.table_style || 'grid',
                data.logo_base64 || null,
                data.company_name || null,
                data.company_address || null,
                data.company_city || null,
                data.company_zip || null,
                now,
                now
            ]
        );
    }

    // Return updated settings
    const updated = await getDesignSettings(tenantId);
    if (!updated) {
        throw new Error('Failed to create/update design settings');
    }

    return updated;
}

/**
 * Delete design settings for a tenant
 */
export async function deleteDesignSettings(tenantId: string): Promise<void> {
    await db.run(
        'DELETE FROM billing_design_settings WHERE tenant_id = ?',
        [tenantId]
    );
}
