/**
 * 🚨 ESCALATION & NOTIFICATION SERVICE
 *
 * Fixes two critical production gaps:
 * 1. needs_human escalation → actual dealer notification (Fix 4)
 * 2. Order confirmed → dealer gets order summary (Fix 7)
 *
 * Uses existing STRATO SMTP via emailService.ts pattern.
 * All notifications are fire-and-forget (errors don't break the bot flow).
 */

import nodemailer from 'nodemailer';
import { logger } from '@utils/logger';

// ============================================================================
// Configuration
// ============================================================================

const STRATO_HOST = 'smtp.strato.de';
const STRATO_PORT = 587;
const STRATO_EMAIL = process.env.STRATO_EMAIL || 'info@partsunion.de';
const STRATO_PASSWORD = process.env.STRATO_PASSWORD || '';

/** Dealer notification email — override with DEALER_NOTIFICATION_EMAIL */
const DEALER_EMAIL = process.env.DEALER_NOTIFICATION_EMAIL || process.env.STRATO_EMAIL || 'info@partsunion.de';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!STRATO_PASSWORD) {
    logger.warn('[Escalation] STRATO_PASSWORD not set — notifications disabled');
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: STRATO_HOST,
      port: STRATO_PORT,
      secure: false,
      auth: { user: STRATO_EMAIL, pass: STRATO_PASSWORD },
      tls: { rejectUnauthorized: false },
    });
  }
  return transporter;
}

// ============================================================================
// Fix 4: Escalation — needs_human notification
// ============================================================================

export interface EscalationData {
  orderId: string;
  customerPhone: string;
  reason: string;
  vehicleSummary?: string;
  partDescription?: string;
  oemNumber?: string;
  oemConfidence?: number;
  language?: string;
}

/**
 * Notify the dealer when the bot can't handle a request.
 * Fire-and-forget: errors are logged but don't block the bot flow.
 */
export function escalateToDealer(data: EscalationData): void {
  (async () => {
    try {
      const transport = getTransporter();
      if (!transport) {
        logger.warn('[Escalation] Cannot send — no SMTP configured');
        return;
      }

      const html = `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, sans-serif; padding: 20px; background: #f8fafc;">
<div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
  <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 24px; color: #fff;">
    <h1 style="margin:0; font-size:20px;">🚨 Bot-Eskalation — Manuelle Bearbeitung nötig</h1>
  </div>
  <div style="padding: 24px;">
    <table style="width:100%; border-collapse:collapse;">
      <tr><td style="padding:8px 0; color:#64748b; width:140px;">Ticket-ID:</td><td style="padding:8px 0; font-weight:600;">${data.orderId}</td></tr>
      <tr><td style="padding:8px 0; color:#64748b;">Kunde:</td><td style="padding:8px 0;">${data.customerPhone}</td></tr>
      <tr><td style="padding:8px 0; color:#64748b;">Grund:</td><td style="padding:8px 0; color:#dc2626; font-weight:600;">${data.reason}</td></tr>
      ${data.vehicleSummary ? `<tr><td style="padding:8px 0; color:#64748b;">Fahrzeug:</td><td style="padding:8px 0;">${data.vehicleSummary}</td></tr>` : ''}
      ${data.partDescription ? `<tr><td style="padding:8px 0; color:#64748b;">Teil:</td><td style="padding:8px 0;">${data.partDescription}</td></tr>` : ''}
      ${data.oemNumber ? `<tr><td style="padding:8px 0; color:#64748b;">OEM-Nr:</td><td style="padding:8px 0; font-family:monospace;">${data.oemNumber} (${Math.round((data.oemConfidence || 0) * 100)}%)</td></tr>` : ''}
      <tr><td style="padding:8px 0; color:#64748b;">Sprache:</td><td style="padding:8px 0;">${data.language || 'de'}</td></tr>
    </table>
    <p style="margin-top:20px; padding:16px; background:#fef3c7; border-radius:8px; color:#92400e;">
      ⚡ Bitte antworten Sie dem Kunden auf WhatsApp (${data.customerPhone}) oder bearbeiten Sie das Ticket im Admin-Dashboard.
    </p>
  </div>
</div>
</body></html>`;

      await transport.sendMail({
        from: `"Partsunion Bot" <${STRATO_EMAIL}>`,
        to: DEALER_EMAIL,
        subject: `🚨 Eskalation: Ticket ${data.orderId} — ${data.reason}`,
        html,
      });

      logger.info('[Escalation] ✅ Dealer notified', {
        orderId: data.orderId,
        reason: data.reason,
        to: DEALER_EMAIL,
      });
    } catch (err: any) {
      logger.error('[Escalation] Failed to send notification', {
        error: err?.message,
        orderId: data.orderId,
      });
    }
  })();
}

// ============================================================================
// Fix 7: Order confirmed notification
// ============================================================================

export interface OrderNotificationData {
  orderId: string;
  customerPhone: string;
  vehicleSummary: string;
  partDescription: string;
  oemNumber?: string;
  selectedOffer: {
    shopName: string;
    brand: string;
    price: number;
    currency: string;
    deliveryTimeDays?: number;
  };
  deliveryType?: 'delivery' | 'pickup';
  deliveryAddress?: string;
  language?: string;
}

/**
 * Notify the dealer about a new confirmed (binding) order.
 * Fire-and-forget.
 */
export function notifyDealerNewOrder(data: OrderNotificationData): void {
  (async () => {
    try {
      const transport = getTransporter();
      if (!transport) {
        logger.warn('[OrderNotify] Cannot send — no SMTP configured');
        return;
      }

      const deliveryInfo = data.deliveryType === 'delivery'
        ? `🚚 Lieferung an: ${data.deliveryAddress || 'Adresse steht noch aus'}`
        : `📦 Abholung beim Händler`;

      const html = `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, sans-serif; padding: 20px; background: #f8fafc;">
<div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
  <div style="background: linear-gradient(135deg, #16a34a, #15803d); padding: 24px; color: #fff;">
    <h1 style="margin:0; font-size:20px;">✅ Neue verbindliche Bestellung!</h1>
  </div>
  <div style="padding: 24px;">
    <table style="width:100%; border-collapse:collapse;">
      <tr><td style="padding:8px 0; color:#64748b; width:140px;">Bestellnr:</td><td style="padding:8px 0; font-weight:600; font-size:16px;">${data.orderId}</td></tr>
      <tr><td style="padding:8px 0; color:#64748b;">Kunde:</td><td style="padding:8px 0;">${data.customerPhone}</td></tr>
      <tr><td style="padding:8px 0; color:#64748b;">Fahrzeug:</td><td style="padding:8px 0; font-weight:600;">${data.vehicleSummary}</td></tr>
      <tr><td style="padding:8px 0; color:#64748b;">Teil:</td><td style="padding:8px 0;">${data.partDescription}</td></tr>
      ${data.oemNumber ? `<tr><td style="padding:8px 0; color:#64748b;">OEM-Nr:</td><td style="padding:8px 0; font-family:monospace; font-weight:600;">${data.oemNumber}</td></tr>` : ''}
    </table>
    
    <div style="margin-top:20px; padding:16px; background:#f0fdf4; border-radius:8px; border:1px solid #bbf7d0;">
      <h3 style="margin:0 0 8px 0; color:#166534;">Gewähltes Angebot:</h3>
      <p style="margin:4px 0; color:#15803d;">🏷️ ${data.selectedOffer.brand} | 💰 <strong>${data.selectedOffer.price.toFixed(2)} ${data.selectedOffer.currency}</strong></p>
      <p style="margin:4px 0; color:#15803d;">🚚 Lieferzeit: ${data.selectedOffer.deliveryTimeDays ?? 'k.A.'} Tage</p>
    </div>

    <div style="margin-top:16px; padding:16px; background:#eff6ff; border-radius:8px; border:1px solid #bfdbfe;">
      <p style="margin:0; color:#1e40af;">${deliveryInfo}</p>
    </div>

    <p style="margin-top:20px; padding:16px; background:#fef3c7; border-radius:8px; color:#92400e;">
      ⚡ <strong>Verbindliche Bestellung!</strong> Bitte das Teil beim Lieferanten bestellen und den Kunden informieren.
    </p>
  </div>
</div>
</body></html>`;

      await transport.sendMail({
        from: `"Partsunion Bot" <${STRATO_EMAIL}>`,
        to: DEALER_EMAIL,
        subject: `✅ Neue Bestellung #${data.orderId} — ${data.vehicleSummary} — ${data.selectedOffer.price.toFixed(2)}€`,
        html,
      });

      logger.info('[OrderNotify] ✅ Dealer notified of new order', {
        orderId: data.orderId,
        price: data.selectedOffer.price,
        to: DEALER_EMAIL,
      });
    } catch (err: any) {
      logger.error('[OrderNotify] Failed to send notification', {
        error: err?.message,
        orderId: data.orderId,
      });
    }
  })();
}
