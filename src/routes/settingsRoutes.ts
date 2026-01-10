// Settings API Routes
// Endpoints for billing/design settings management

import { Router, Request, Response } from 'express';
import { getDesignSettings, upsertDesignSettings } from '../services/invoicing/designSettingsService';

const router = Router();

/**
 * GET /api/settings/billing/:tenantId
 * Get billing/design settings for a tenant
 */
router.get('/billing/:tenantId', async (req: Request, res: Response) => {
    try {
        const { tenantId } = req.params;
        console.log(`[Settings] Fetching billing settings for tenant: ${tenantId}`);

        const settings = await getDesignSettings(tenantId);

        if (!settings) {
            // Return default settings if none exist
            console.log(`[Settings] No settings found for tenant ${tenantId}, returning defaults`);
            return res.json({
                company_name: '',
                address_line1: '',
                address_line2: '',
                city: '',
                postal_code: '',
                country: 'Deutschland',
                tax_id: '',
                iban: '',
                email: '',
                phone: '',
                invoice_template: 'clean',
                invoice_color: '#000000',
                invoice_font: 'helvetica',
                logo_position: 'left',
                number_position: 'right',
                address_layout: 'two-column',
                table_style: 'grid',
                accent_color: '#f3f4f6',
            });
        }

        console.log(`[Settings] Settings found for tenant ${tenantId}`);

        // Map database fields to frontend expected format
        res.json({
            company_name: settings.company_name || '',
            address_line1: settings.company_address || '',
            address_line2: '',
            city: settings.company_city || '',
            postal_code: settings.company_zip || '',
            country: 'Deutschland',
            tax_id: '',
            iban: '',
            email: '',
            phone: '',
            invoice_template: 'clean',
            invoice_color: settings.invoice_color,
            invoice_font: settings.invoice_font,
            logo_position: settings.logo_position,
            number_position: settings.number_position,
            address_layout: settings.address_layout,
            table_style: settings.table_style,
            accent_color: settings.accent_color,
            logo_base64: settings.logo_base64,
        });
    } catch (error: any) {
        console.error('[Settings] Error fetching billing settings:', error);
        res.status(500).json({ error: 'Failed to fetch billing settings', message: error.message });
    }
});

/**
 * PUT /api/settings/billing/:tenantId
 * Update billing/design settings for a tenant
 */
router.put('/billing/:tenantId', async (req: Request, res: Response) => {
    try {
        const { tenantId } = req.params;
        console.log(`[Settings] Updating billing settings for tenant: ${tenantId}`);
        console.log(`[Settings] Request body:`, JSON.stringify(req.body, null, 2));

        // Map frontend fields to database fields
        const settingsData = {
            invoice_color: req.body.invoice_color,
            accent_color: req.body.accent_color,
            invoice_font: req.body.invoice_font,
            logo_position: req.body.logo_position,
            number_position: req.body.number_position,
            address_layout: req.body.address_layout,
            table_style: req.body.table_style,
            logo_base64: req.body.logo_base64,
            company_name: req.body.company_name,
            company_address: req.body.address_line1,
            company_city: req.body.city,
            company_zip: req.body.postal_code,
        };

        const updatedSettings = await upsertDesignSettings(tenantId, settingsData);
        console.log(`[Settings] Settings updated successfully for tenant ${tenantId}`);

        res.json({
            success: true,
            settings: updatedSettings
        });
    } catch (error: any) {
        console.error('[Settings] Error updating billing settings:', error);
        res.status(500).json({ error: 'Failed to update billing settings', message: error.message });
    }
});

export default router;
