// Tax Calculator Service - Period aggregation and tax calculations
// Implements IST vs SOLL logic, tax grouping, and Kleinunternehmer handling

import { randomUUID } from 'crypto';
import { db } from '@core/database';
import type {
    TaxProfile,
    Invoice,
    TaxPeriod,
    PeriodAggregation,
    TaxBreakdown,
    PeriodType,
    PeriodStatus
} from '../../types/tax';

/**
 * Get tax profile for tenant
 */
export async function getTaxProfile(tenantId: string): Promise<TaxProfile | null> {
    return db.get<TaxProfile>(
        'SELECT * FROM tax_profiles WHERE tenant_id = ?',
        [tenantId]
    );
}

/**
 * Create or update tax profile
 */
export async function upsertTaxProfile(tenantId: string, data: Partial<TaxProfile>): Promise<TaxProfile> {
    const existing = await getTaxProfile(tenantId);
    const now = new Date().toISOString();

    if (existing) {
        // Update
        const updates: string[] = [];
        const params: any[] = [];

        if (data.business_type) {
            updates.push('business_type = ?');
            params.push(data.business_type);
        }
        if (data.tax_number !== undefined) {
            updates.push('tax_number = ?');
            params.push(data.tax_number);
        }
        if (data.vat_id !== undefined) {
            updates.push('vat_id = ?');
            params.push(data.vat_id);
        }
        if (data.tax_method) {
            updates.push('tax_method = ?');
            params.push(data.tax_method);
        }
        if (data.small_business !== undefined) {
            updates.push('small_business = ?');
            params.push(data.small_business);
        }
        if (data.period_type) {
            updates.push('period_type = ?');
            params.push(data.period_type);
        }

        updates.push('updated_at = ?');
        params.push(now);
        params.push(tenantId);

        await db.run(
            `UPDATE tax_profiles SET ${updates.join(', ')} WHERE tenant_id = ?`,
            params
        );
    } else {
        // Create
        const id = randomUUID();
        await db.run(
            `INSERT INTO tax_profiles (
                id, tenant_id, business_type, tax_number, vat_id,
                tax_method, small_business, period_type, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                tenantId,
                data.business_type || 'company',
                data.tax_number || null,
                data.vat_id || null,
                data.tax_method || 'SOLL',
                data.small_business || false,
                data.period_type || 'monthly',
                now,
                now
            ]
        );
    }

    const updated = await getTaxProfile(tenantId);
    if (!updated) {
        throw new Error('Failed to create/update tax profile');
    }
    return updated;
}

/**
 * Calculate period dates based on period type
 */
export function calculatePeriodDates(year: number, period: number, periodType: PeriodType): { start: string; end: string } {
    if (periodType === 'monthly') {
        const start = new Date(year, period - 1, 1);
        const end = new Date(year, period, 0); // Last day of month
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    } else {
        // Quarterly
        const quarterStartMonth = (period - 1) * 3;
        const start = new Date(year, quarterStartMonth, 1);
        const end = new Date(year, quarterStartMonth + 3, 0);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    }
}

/**
 * Get invoices for period based on IST or SOLL method
 */
async function getInvoicesForPeriod(
    tenantId: string,
    periodStart: string,
    periodEnd: string,
    taxMethod: 'IST' | 'SOLL'
): Promise<Invoice[]> {
    // IST: Use paid_at (cash basis)
    // SOLL: Use issue_date (accrual basis)

    const dateField = taxMethod === 'IST' ? 'paid_at' : 'issue_date';

    // PostgreSQL-compatible query using json_build_object and string_agg
    const query = `
        SELECT i.*, 
            string_agg(
                json_build_object(
                    'id', il.id,
                    'description', il.description,
                    'quantity', il.quantity,
                    'unit_price', il.unit_price,
                    'tax_rate', il.tax_rate,
                    'tax_code', il.tax_code,
                    'line_total', il.line_total
                )::text,
                ','
            ) as lines_json
        FROM invoices i
        LEFT JOIN invoice_lines il ON il.invoice_id = i.id
        WHERE i.tenant_id = $1
          AND i.status = 'paid'
          AND ${dateField} >= $2
          AND ${dateField} <= $3
        GROUP BY i.id
        ORDER BY ${dateField}
    `;

    const rows = await db.all<any>(query, [tenantId, periodStart, periodEnd + ' 23:59:59']);

    // Parse lines JSON
    return rows.map(row => ({
        ...row,
        lines: row.lines_json ? JSON.parse(`[${row.lines_json}]`) : []
    }));
}

/**
 * Aggregate invoices into tax breakdown
 */
function aggregateInvoices(invoices: Invoice[]): PeriodAggregation['totals'] {
    const totals: PeriodAggregation['totals'] = {
        standard_19: { net: 0, vat: 0, gross: 0 },
        reduced_7: { net: 0, vat: 0, gross: 0 },
        zero_rated: { net: 0, vat: 0, gross: 0 },
        reverse_charge: { net: 0, vat: 0, gross: 0 },
        eu_sales: { net: 0, vat: 0, gross: 0 }
    };

    for (const invoice of invoices) {
        if (!invoice.lines) continue;

        for (const line of invoice.lines) {
            const line_net = line.quantity * line.unit_price;
            const line_vat = line_net * (line.tax_rate / 100);
            const line_gross = line_net + line_vat;

            // Categorize by tax_code and tax_rate
            if (line.tax_code === 'REVERSE') {
                totals.reverse_charge.net += line_net;
                totals.reverse_charge.vat += line_vat;
                totals.reverse_charge.gross += line_gross;
            } else if (line.tax_code === 'EU') {
                totals.eu_sales.net += line_net;
                totals.eu_sales.vat += line_vat;
                totals.eu_sales.gross += line_gross;
            } else if (line.tax_rate === 19) {
                totals.standard_19.net += line_net;
                totals.standard_19.vat += line_vat;
                totals.standard_19.gross += line_gross;
            } else if (line.tax_rate === 7) {
                totals.reduced_7.net += line_net;
                totals.reduced_7.vat += line_vat;
                totals.reduced_7.gross += line_gross;
            } else {
                totals.zero_rated.net += line_net;
                totals.zero_rated.vat += line_vat;
                totals.zero_rated.gross += line_gross;
            }
        }
    }

    // Round all values to 2 decimal places
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
        totals[key].net = Math.round(totals[key].net * 100) / 100;
        totals[key].vat = Math.round(totals[key].vat * 100) / 100;
        totals[key].gross = Math.round(totals[key].gross * 100) / 100;
    }

    return totals;
}

/**
 * Calculate tax period
 */
export async function calculateTaxPeriod(
    tenantId: string,
    periodStart: string,
    periodEnd: string
): Promise<PeriodAggregation> {
    const taxProfile = await getTaxProfile(tenantId);
    if (!taxProfile) {
        throw new Error('Tax profile not found. Please configure tax settings first.');
    }

    // Get invoices for period
    const invoices = await getInvoicesForPeriod(tenantId, periodStart, periodEnd, taxProfile.tax_method);

    // Aggregate totals
    const totals = aggregateInvoices(invoices);

    // Calculate tax due (Zahllast)
    // For Kleinunternehmer, tax_due is always 0
    const tax_due = taxProfile.small_business
        ? 0
        : totals.standard_19.vat + totals.reduced_7.vat;

    return {
        period_start: periodStart,
        period_end: periodEnd,
        invoices,
        totals,
        tax_due
    };
}

/**
 * Save/update tax period in database
 */
export async function saveTaxPeriod(
    tenantId: string,
    periodStart: string,
    periodEnd: string,
    status: PeriodStatus = 'calculated'
): Promise<TaxPeriod> {
    const aggregation = await calculateTaxPeriod(tenantId, periodStart, periodEnd);
    const taxProfile = await getTaxProfile(tenantId);

    if (!taxProfile) {
        throw new Error('Tax profile not found');
    }

    const now = new Date().toISOString();

    // Check if period already exists
    const existing = await db.get<TaxPeriod>(
        'SELECT * FROM tax_periods WHERE tenant_id = ? AND period_start = ? AND period_end = ?',
        [tenantId, periodStart, periodEnd]
    );

    if (existing) {
        // Update existing
        await db.run(
            `UPDATE tax_periods SET
                total_net = ?,
                vat_19 = ?,
                vat_7 = ?,
                vat_0 = ?,
                tax_due = ?,
                status = ?,
                updated_at = ?
            WHERE id = ?`,
            [
                aggregation.totals.standard_19.net + aggregation.totals.reduced_7.net + aggregation.totals.zero_rated.net,
                aggregation.totals.standard_19.vat,
                aggregation.totals.reduced_7.vat,
                aggregation.totals.zero_rated.vat,
                aggregation.tax_due,
                status,
                now,
                existing.id
            ]
        );

        return getTaxPeriodById(tenantId, existing.id);
    } else {
        // Create new
        const id = randomUUID();
        await db.run(
            `INSERT INTO tax_periods (
                id, tenant_id, period_type, period_start, period_end,
                total_net, vat_19, vat_7, vat_0, tax_due, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                tenantId,
                taxProfile.period_type,
                periodStart,
                periodEnd,
                aggregation.totals.standard_19.net + aggregation.totals.reduced_7.net + aggregation.totals.zero_rated.net,
                aggregation.totals.standard_19.vat,
                aggregation.totals.reduced_7.vat,
                aggregation.totals.zero_rated.vat,
                aggregation.tax_due,
                status,
                now,
                now
            ]
        );

        return getTaxPeriodById(tenantId, id);
    }
}

/**
 * Get tax period by ID
 */
export async function getTaxPeriodById(tenantId: string, periodId: string): Promise<TaxPeriod> {
    const period = await db.get<TaxPeriod>(
        'SELECT * FROM tax_periods WHERE id = ? AND tenant_id = ?',
        [periodId, tenantId]
    );

    if (!period) {
        throw new Error('Tax period not found');
    }

    return period;
}

/**
 * List tax periods for tenant
 */
export async function listTaxPeriods(tenantId: string, limit = 12): Promise<TaxPeriod[]> {
    return db.all<TaxPeriod>(
        'SELECT * FROM tax_periods WHERE tenant_id = ? ORDER BY period_start DESC LIMIT ?',
        [tenantId, limit]
    );
}

/**
 * Mark period as exported
 */
export async function markPeriodAsExported(tenantId: string, periodId: string): Promise<TaxPeriod> {
    const now = new Date().toISOString();

    await db.run(
        `UPDATE tax_periods SET status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`,
        ['exported', now, periodId, tenantId]
    );

    return getTaxPeriodById(tenantId, periodId);
}
