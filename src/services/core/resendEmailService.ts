/**
 * Email Sending Service using Resend
 * Reliable email delivery for Railway deployments
 * 
 * Resend is used because direct SMTP connections to STRATO
 * are blocked/timeout from Railway's infrastructure.
 */

import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const DEFAULT_FROM_EMAIL = 'info@partsunion.de';
const DEFAULT_FROM_NAME = 'Partsunion';

// Initialize Resend client
let resendClient: Resend | null = null;

function getResendClient(): Resend {
    if (!resendClient) {
        if (!RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY nicht konfiguriert. Bitte in Railway setzen.');
        }
        resendClient = new Resend(RESEND_API_KEY);
    }
    return resendClient;
}

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    body: string;
    html?: string;
    from?: string;
    fromName?: string;
    replyTo?: string;
    signature?: string;
}

/**
 * Send an email using Resend API
 * More reliable than direct SMTP from cloud environments
 */
export async function sendEmailViaResend(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const {
        to,
        subject,
        body,
        html,
        from = DEFAULT_FROM_EMAIL,
        fromName = DEFAULT_FROM_NAME,
        replyTo,
        signature
    } = options;

    console.log(`[Resend] Sending email to ${Array.isArray(to) ? to.join(', ') : to}`);

    try {
        const resend = getResendClient();

        // Add signature if provided
        const fullBody = signature ? `${body}\n\n--\n${signature}` : body;

        // Generate HTML from plain text if not provided
        const htmlContent = html || fullBody.replace(/\n/g, '<br>');

        const result = await resend.emails.send({
            from: `${fromName} <${from}>`,
            to: Array.isArray(to) ? to : [to],
            subject,
            text: fullBody,
            html: htmlContent,
            replyTo: replyTo || from
        });

        if (result.error) {
            console.error('[Resend] API Error:', result.error);
            return {
                success: false,
                error: result.error.message || 'Resend API Fehler'
            };
        }

        console.log(`✉️ [Resend] Email sent successfully! ID: ${result.data?.id}`);
        return {
            success: true,
            messageId: result.data?.id
        };

    } catch (error: any) {
        console.error('[Resend] Send error:', error.message);
        return {
            success: false,
            error: error.message || 'E-Mail-Versand fehlgeschlagen'
        };
    }
}

/**
 * Send marketing/bulk emails using Resend
 */
export async function sendBulkEmailViaResend(
    recipients: string[],
    subject: string,
    htmlContent: string
): Promise<{ sent: number; failed: number; errors: string[] }> {
    console.log(`[Resend] Sending bulk email to ${recipients.length} recipients`);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send in batches to avoid rate limits
    const BATCH_SIZE = 10;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
            batch.map(email => sendEmailViaResend({
                to: email,
                subject,
                body: htmlContent.replace(/<[^>]*>/g, ''), // Strip HTML for plain text
                html: htmlContent
            }))
        );

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.success) {
                sent++;
            } else {
                failed++;
                if (result.status === 'rejected') {
                    errors.push(result.reason?.message || 'Unknown error');
                } else if (!result.value.success) {
                    errors.push(result.value.error || 'Unknown error');
                }
            }
        }

        // Small delay between batches to respect rate limits
        if (i + BATCH_SIZE < recipients.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    console.log(`[Resend] Bulk send complete: ${sent} sent, ${failed} failed`);
    return { sent, failed, errors };
}

/**
 * Check if Resend is configured
 */
export function isResendConfigured(): boolean {
    return !!RESEND_API_KEY;
}

export { DEFAULT_FROM_EMAIL, DEFAULT_FROM_NAME };
