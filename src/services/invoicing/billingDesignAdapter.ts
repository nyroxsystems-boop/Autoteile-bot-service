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

const WAWI_API_URL = process.env.WAWI_API_URL || 'http://localhost:8000';

/**
 * Fetch billing design settings from WAWI API
 * Returns null if not found or on error (graceful fallback)
 */
export async function fetchBillingDesign(tenantId: string): Promise<BillingDesign | null> {
    try {
        console.log(`[BillingDesign] Fetching design for tenant: ${tenantId}`);

        const response = await fetch(`${WAWI_API_URL}/api/billing/settings`, {
            method: 'GET',
            headers: {
                'X-Tenant-ID': tenantId,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.warn(`[BillingDesign] No design found (${response.status}), using defaults`);
            return null;
        }

        const design = await response.json();
        console.log(`[BillingDesign] Design loaded successfully:`, {
            color: design.invoice_color,
            font: design.invoice_font,
            hasLogo: !!design.logo_base64,
        });

        return design;
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
