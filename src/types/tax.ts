// Tax Module Type Definitions
// German UStVA (Umsatzsteuervoranmeldung) Tax Compliance

export type BusinessType = 'sole_trader' | 'company';
export type TaxMethod = 'IST' | 'SOLL';  // Cash basis | Accrual basis
export type PeriodType = 'monthly' | 'quarterly';
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'canceled';
export type TaxCode = 'STANDARD' | 'REVERSE' | 'EU' | 'TAX_FREE';
export type TaxRate = 0 | 7 | 19;
export type PeriodStatus = 'open' | 'calculated' | 'exported';
export type ExportType = 'DOWNLOAD';
export type ExportStatus = 'ready' | 'failed';

// Tax Profile (per tenant)
export interface TaxProfile {
    id: string;
    tenant_id: string;
    business_type: BusinessType;
    tax_number?: string | null;
    vat_id?: string | null;
    tax_method: TaxMethod;
    small_business: boolean;
    period_type: PeriodType;
    created_at: string;
    updated_at: string;
}

// Invoice
export interface Invoice {
    id: string;
    tenant_id: string;
    invoice_number: string;
    issue_date: string;  // ISO date string
    due_date?: string | null;
    paid_at?: string | null;  // ISO datetime string
    customer_id?: string | null;
    customer_name?: string | null;
    billing_country: string;  // ISO 2-letter code (DE, FR, US, etc.)
    net_amount: number;
    vat_amount: number;
    gross_amount: number;
    status: InvoiceStatus;
    notes?: string | null;
    created_at: string;
    updated_at: string;
    lines?: InvoiceLine[];  // Populated on detail queries
}

// Invoice Line
export interface InvoiceLine {
    id: string;
    invoice_id: string;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: TaxRate;
    tax_code: TaxCode;
    line_total: number;
    created_at: string;
}

// Tax Period (Aggregated)
export interface TaxPeriod {
    id: string;
    tenant_id: string;
    period_type: PeriodType;
    period_start: string;  // ISO date string
    period_end: string;    // ISO date string
    total_net: number;
    vat_19: number;
    vat_7: number;
    vat_0: number;
    input_tax: number;     // Vorsteuer
    tax_due: number;       // Zahllast
    status: PeriodStatus;
    created_at: string;
    updated_at: string;
}

// Tax Export Log
export interface TaxExportLog {
    id: string;
    tax_period_id: string;
    export_type: ExportType;
    file_path?: string | null;
    exported_at: string;
    status: ExportStatus;
    error_message?: string | null;
}

// API Request/Response Types
export interface CreateInvoiceRequest {
    invoice_number?: string;  // Auto-generated if not provided
    issue_date: string;
    due_date?: string;
    customer_id?: string;
    customer_name?: string;
    billing_country?: string;  // Default: 'DE'
    notes?: string;
    source_order_id?: string;  // Track source order for automation
    lines: Array<{
        description: string;
        quantity: number;
        unit_price: number;
        tax_rate: TaxRate;
        tax_code?: TaxCode;  // Default: 'STANDARD'
    }>;
}

export interface UpdateInvoiceRequest {
    issue_date?: string;
    due_date?: string;
    paid_at?: string;
    customer_name?: string;
    notes?: string;
    status?: InvoiceStatus;
}

export interface CalculatePeriodRequest {
    period_start: string;
    period_end: string;
}

export interface TaxPeriodSummary extends TaxPeriod {
    invoice_count: number;
    export_count: number;
}

export interface UpdateTaxProfileRequest {
    business_type?: BusinessType;
    tax_number?: string;
    vat_id?: string;
    tax_method?: TaxMethod;
    small_business?: boolean;
    period_type?: PeriodType;
}

// Tax Calculation Helpers
export interface TaxBreakdown {
    net: number;
    vat: number;
    gross: number;
}

export interface PeriodAggregation {
    period_start: string;
    period_end: string;
    invoices: Invoice[];
    totals: {
        standard_19: TaxBreakdown;
        reduced_7: TaxBreakdown;
        zero_rated: TaxBreakdown;
        reverse_charge: TaxBreakdown;
        eu_sales: TaxBreakdown;
    };
    tax_due: number;
}

// Export Result
export interface ExportResult {
    export_id: string;
    xml_path: string;
    pdf_path: string;
    generated_at: string;
}
