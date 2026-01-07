// PDF Generation Service for German Invoices
// Generates §14 UStG compliant invoice PDFs

import PDFDocument from 'pdfkit';
import { Invoice } from '../../types/tax';
import { getTaxProfile } from '../tax/taxCalculator';
import { fetchBillingDesign, mapFont, getLogoXPosition } from './billingDesignAdapter';
import fs from 'fs';
import path from 'path';

interface CompanyInfo {
    name: string;
    address: string;
    city: string;
    zip: string;
    country: string;
    tax_number?: string;
    vat_id?: string;
    phone?: string;
    email?: string;
    website?: string;
}

// Default company info (can be loaded from tax profile)
const DEFAULT_COMPANY: CompanyInfo = {
    name: 'AutoTeile Müller GmbH',
    address: 'Musterstraße 123',
    city: 'München',
    zip: '80331',
    country: 'Deutschland',
    phone: '+49 89 1234567',
    email: 'info@autoteile-mueller.de',
    website: 'www.autoteile-mueller.de'
};

/**
 * Generate PDF for invoice
 * Returns buffer that can be sent as response or saved to file
 */
export async function generateInvoicePDF(tenantId: string, invoice: Invoice): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
        try {
            // Load company info from tax profile
            let companyInfo = DEFAULT_COMPANY;
            const profile = await getTaxProfile(tenantId);
            if (profile) {
                companyInfo = {
                    ...DEFAULT_COMPANY,
                    tax_number: profile.tax_number,
                    vat_id: profile.vat_id
                };
            }

            // Load billing design (colors, logo, fonts)
            const design = await fetchBillingDesign(tenantId);
            const primaryColor = design?.invoice_color || '#000000';
            const accentColor = design?.accent_color || '#f3f4f6';
            const font = design?.invoice_font ? mapFont(design.invoice_font) : 'Helvetica';

            // Create PDF document
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
                info: {
                    Title: `Rechnung ${invoice.invoice_number}`,
                    Author: companyInfo.name,
                }
            });

            const chunks: Buffer[] = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Logo (if available)
            let headerY = 50;
            if (design?.logo_base64) {
                try {
                    const logoX = getLogoXPosition(design.logo_position || 'left');
                    const logoBuffer = Buffer.from(design.logo_base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                    doc.image(logoBuffer, logoX, 40, { width: 100, height: 60, fit: [100, 60] });
                    headerY = 120; // Move text down if logo present
                } catch (error) {
                    console.warn('[PDF] Failed to embed logo:', error);
                }
            }

            // Header - Company Info
            doc.fontSize(20)
                .font(`${font}-Bold`)
                .fillColor(primaryColor)
                .text(companyInfo.name, 50, headerY);

            doc.fontSize(10)
                .font(font)
                .fillColor('#000000')
                .text(companyInfo.address, 50, headerY + 30)
                .text(`${companyInfo.zip} ${companyInfo.city}`, 50, headerY + 45);

            if (companyInfo.phone) doc.text(`Tel: ${companyInfo.phone}`, 50, 110);
            if (companyInfo.email) doc.text(`E-Mail: ${companyInfo.email}`, 50, 125);
            if (companyInfo.website) doc.text(companyInfo.website, 50, 140);

            // Invoice Details (Right Side)
            const rightX = 350;
            doc.fontSize(14)
                .font(`${font}-Bold`)
                .fillColor(primaryColor)
                .text('RECHNUNG', rightX, headerY);

            doc.fontSize(10)
                .font(font)
                .fillColor('#000000')
                .text(`Nummer:`, rightX, headerY + 20)
                .font(`${font}-Bold`)
                .text(invoice.invoice_number, rightX + 80, headerY + 20);

            doc.font(font)
                .text(`Datum:`, rightX, headerY + 35)
                .font(`${font}-Bold`)
                .text(formatDate(invoice.issue_date), rightX + 80, headerY + 35);

            if (invoice.due_date) {
                doc.font(font)
                    .text(`Fällig:`, rightX, headerY + 50)
                    .font(`${font}-Bold`)
                    .text(formatDate(invoice.due_date), rightX + 80, headerY + 50);
            }

            // Customer Address
            const customerY = 200;
            doc.fontSize(10)
                .font('Helvetica')
                .text('Rechnung an:', 50, customerY);

            doc.fontSize(11)
                .font('Helvetica-Bold')
                .text(invoice.customer_name || 'Kunde', 50, customerY + 20);

            // Line separator
            doc.moveTo(50, customerY + 60)
                .lineTo(550, customerY + 60)
                .stroke();

            // Table Header
            const tableTop = customerY + 80;
            const col1 = 50;
            const col2 = 250;
            const col3 = 340;
            const col4 = 390;
            const col5 = 450;
            const col6 = 510;

            doc.fontSize(9)
                .font('Helvetica-Bold')
                .text('Pos.', col1, tableTop)
                .text('Beschreibung', col2, tableTop)
                .text('Menge', col3, tableTop)
                .text('Preis', col4, tableTop)
                .text('MwSt.', col5, tableTop)
                .text('Summe', col6, tableTop, { align: 'right', width: 40 });

            // Table Lines
            let yPosition = tableTop + 20;
            doc.moveTo(50, yPosition - 5)
                .lineTo(550, yPosition - 5)
                .stroke();

            // Invoice Lines
            invoice.lines?.forEach((line, index) => {
                const lineTotal = line.quantity * line.unit_price;

                doc.fontSize(9)
                    .font('Helvetica')
                    .text((index + 1).toString(), col1, yPosition)
                    .text(line.description, col2, yPosition, { width: 80 })
                    .text(line.quantity.toString(), col3, yPosition)
                    .text(formatCurrency(line.unit_price), col4, yPosition)
                    .text(`${line.tax_rate}%`, col5, yPosition)
                    .text(formatCurrency(lineTotal), col6, yPosition, { align: 'right', width: 40 });

                yPosition += 25;
            });

            // Line before totals
            yPosition += 10;
            doc.moveTo(350, yPosition)
                .lineTo(550, yPosition)
                .stroke();

            // Totals
            yPosition += 15;
            doc.fontSize(10)
                .font('Helvetica')
                .text('Nettobetrag:', 400, yPosition)
                .text(formatCurrency(invoice.net_amount), 510, yPosition, { align: 'right', width: 40 });

            yPosition += 18;
            doc.text('MwSt.:', 400, yPosition)
                .text(formatCurrency(invoice.vat_amount), 510, yPosition, { align: 'right', width: 40 });

            yPosition += 5;
            doc.moveTo(350, yPosition)
                .lineTo(550, yPosition)
                .stroke();

            yPosition += 15;
            doc.fontSize(12)
                .font('Helvetica-Bold')
                .text('Gesamtbetrag:', 400, yPosition)
                .text(formatCurrency(invoice.gross_amount), 510, yPosition, { align: 'right', width: 40 });

            // Tax breakdown
            if (profile?.vat_id) {
                yPosition += 40;
                doc.fontSize(8)
                    .font('Helvetica')
                    .text('USt-IdNr: ' + profile.vat_id, 50, yPosition);
            }

            if (profile?.small_business) {
                yPosition += 25;
                doc.fontSize(8)
                    .font('Helvetica')
                    .text('Gemäß §19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung)', 50, yPosition, { width: 500 });
            }

            // Payment terms
            yPosition += 40;
            doc.fontSize(9)
                .font('Helvetica-Bold')
                .text('Zahlungsbedingungen:', 50, yPosition);

            yPosition += 15;
            doc.fontSize(9)
                .font('Helvetica')
                .text(`Bitte überweisen Sie den Betrag bis ${invoice.due_date ? formatDate(invoice.due_date) : 'auf Rechnung'}.`, 50, yPosition, { width: 500 });

            if (invoice.notes) {
                yPosition += 30;
                doc.fontSize(9)
                    .font('Helvetica-Bold')
                    .text('Hinweise:', 50, yPosition);

                yPosition += 15;
                doc.fontSize(9)
                    .font('Helvetica')
                    .text(invoice.notes, 50, yPosition, { width: 500 });
            }

            // Footer
            const footerY = 750;
            doc.fontSize(8)
                .font('Helvetica')
                .text(
                    `${companyInfo.name} | ${companyInfo.address} | ${companyInfo.zip} ${companyInfo.city}`,
                    50,
                    footerY,
                    { align: 'center', width: 500 }
                );

            if (companyInfo.tax_number) {
                doc.text(`Steuernummer: ${companyInfo.tax_number}`, 50, footerY + 12, { align: 'center', width: 500 });
            }

            // Finalize PDF
            doc.end();

        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Save invoice PDF to file system
 */
export async function saveInvoicePDF(tenantId: string, invoice: Invoice, outputPath: string): Promise<string> {
    const pdfBuffer = await generateInvoicePDF(tenantId, invoice);

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(outputPath, pdfBuffer);
    return outputPath;
}

// Helper functions
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}
