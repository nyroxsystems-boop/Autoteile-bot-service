// Billing Design Adapter
// Fetches invoice design settings from WAWI API for PDF generation

interface BillingDesign {
    invoice_color: string;
    invoice_font: string;
    logo_position: 'left' | 'center' | 'right';
    number_position: 'left' | 'right';
    address_layout: 'two-column' | 'gestapelt';
    table_style: 'grid' | 'minimal' | 'gestreift';
    accent_color: string;
    logo_base64?: string;
    company_name?: string;
    company_address?: string;
    company_city?: string;
    company_zip?: string;
}

import { getDesignSettings } from './designSettingsService';

/**
 * Fetch billing design settings from local database
 * Returns null if not found or on error (graceful fallback)
 */
export async function fetchBillingDesign(tenantId: string): Promise<BillingDesign | null> {
    try {
        console.log(`[BillingDesign] Fetching design for tenant: ${tenantId}`);

        const settings = await getDesignSettings(tenantId);

        if (!settings) {
            console.warn(`[BillingDesign] No design found for tenant ${tenantId}, using defaults`);
            return null;
        }

        console.log(`[BillingDesign] Design loaded successfully:`, {
            color: settings.invoice_color,
            font: settings.invoice_font,
            hasLogo: !!settings.logo_base64,
        });

        return {
            invoice_color: settings.invoice_color,
            invoice_font: settings.invoice_font,
            logo_position: settings.logo_position,
            number_position: settings.number_position,
            address_layout: settings.address_layout,
            table_style: settings.table_style,
            accent_color: settings.accent_color,
            logo_base64: settings.logo_base64 || undefined,
            company_name: settings.company_name || undefined,
            company_address: settings.company_address || undefined,
            company_city: settings.company_city || undefined,
            company_zip: settings.company_zip || undefined,
        };
    } catch (error: any) {
        console.warn('[BillingDesign] Failed to fetch design, using defaults:', error.message);
        return null;
    }
}

/**
 * Map designer font names to PDFKit-compatible fonts
 */
export function mapFont(designerFont: string): string {
    const fontMap: Record<string, string> = {
        'inter': 'Helvetica',
        'helvetica': 'Helvetica',
        'times': 'Times-Roman',
        'roboto': 'Helvetica',
        'arial': 'Helvetica',
    };

    return fontMap[designerFont] || 'Helvetica';
}

/**
 * Get logo X position based on designer setting
 */
export function getLogoXPosition(position: 'left' | 'center' | 'right', pageWidth: number = 595): number {
    switch (position) {
        case 'left':
            return 50;
        case 'center':
            return (pageWidth / 2) - 50; // Center logo (assuming 100px width)
        case 'right':
            return pageWidth - 150;
        default:
            return 50;
    }
}

export type { BillingDesign };
