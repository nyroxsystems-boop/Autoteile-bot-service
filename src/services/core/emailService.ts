/**
 * Email Service for Partsunion Admin Dashboard
 * Uses STRATO SMTP for sending emails (password resets, marketing)
 */

import nodemailer from 'nodemailer';

// STRATO SMTP Configuration
const STRATO_HOST = 'smtp.strato.de';
const STRATO_PORT = 587;
const STRATO_EMAIL = process.env.STRATO_EMAIL || 'info@partsunion.de';
const STRATO_PASSWORD = process.env.STRATO_PASSWORD || '';

// Create reusable transporter
const createTransporter = () => {
    if (!STRATO_PASSWORD) {
        console.warn('⚠️ STRATO_PASSWORD not set - email sending disabled');
        return null;
    }

    return nodemailer.createTransport({
        host: STRATO_HOST,
        port: STRATO_PORT,
        secure: false, // TLS
        auth: {
            user: STRATO_EMAIL,
            pass: STRATO_PASSWORD
        },
        tls: {
            rejectUnauthorized: false
        }
    });
};

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
    if (!transporter) {
        transporter = createTransporter();
    }
    return transporter;
};

// Partsunion Email Template Wrapper
const wrapEmailHtml = (content: string, title: string = 'Partsunion'): string => {
    return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1a1a2e;
            background-color: #f8fafc;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
        }
        .header {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            padding: 32px;
            text-align: center;
        }
        .logo {
            max-width: 180px;
            height: auto;
        }
        .content {
            padding: 40px 32px;
        }
        .footer {
            background: #f1f5f9;
            padding: 24px 32px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: #ffffff !important;
            padding: 14px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            margin: 16px 0;
        }
        h1 { color: #0f172a; margin: 0 0 16px 0; font-size: 24px; }
        h2 { color: #1e293b; margin: 24px 0 12px 0; font-size: 18px; }
        p { margin: 0 0 16px 0; color: #475569; }
        a { color: #2563eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <img src="https://partsunion.de/logo.png" alt="Partsunion" class="logo" />
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>Partsunion GmbH • B2B Autoteile-Plattform</p>
            <p>Diese E-Mail wurde automatisch generiert. Bei Fragen kontaktieren Sie uns unter info@partsunion.de</p>
        </div>
    </div>
</body>
</html>
`;
};

// Password Reset Email
export async function sendPasswordResetEmail(
    to: string,
    username: string,
    resetToken: string,
    baseUrl: string = 'https://admin.partsunion.de'
): Promise<boolean> {
    const transport = getTransporter();
    if (!transport) {
        console.error('Email transporter not available');
        return false;
    }

    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    const htmlContent = `
        <h1>Passwort zurücksetzen</h1>
        <p>Hallo <strong>${username}</strong>,</p>
        <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts für das Partsunion Admin Dashboard gestellt.</p>
        <p>Klicken Sie auf den folgenden Button, um ein neues Passwort zu erstellen:</p>
        <p style="text-align: center;">
            <a href="${resetLink}" class="button">Passwort zurücksetzen</a>
        </p>
        <p style="font-size: 12px; color: #94a3b8;">
            Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.<br/>
            Der Link ist 1 Stunde gültig.
        </p>
    `;

    try {
        await transport.sendMail({
            from: `"Partsunion Admin" <${STRATO_EMAIL}>`,
            to,
            subject: 'Passwort zurücksetzen - Partsunion Admin',
            html: wrapEmailHtml(htmlContent, 'Passwort zurücksetzen')
        });
        console.log(`✅ Password reset email sent to ${to}`);
        return true;
    } catch (error: any) {
        console.error(`❌ Failed to send password reset email:`, error.message);
        return false;
    }
}

// Welcome Email for new admins
export async function sendWelcomeAdminEmail(
    to: string,
    username: string,
    tempPassword: string
): Promise<boolean> {
    const transport = getTransporter();
    if (!transport) {
        console.error('Email transporter not available');
        return false;
    }

    const htmlContent = `
        <h1>Willkommen im Admin-Bereich!</h1>
        <p>Hallo <strong>${username}</strong>,</p>
        <p>Ihr Admin-Zugang für das Partsunion Dashboard wurde erstellt.</p>
        <h2>Ihre Zugangsdaten:</h2>
        <p><strong>Benutzername:</strong> ${username}</p>
        <p><strong>Temporäres Passwort:</strong> ${tempPassword}</p>
        <p style="background: #fef3c7; padding: 16px; border-radius: 8px; color: #92400e;">
            ⚠️ Bitte ändern Sie Ihr Passwort nach dem ersten Login über die "Passwort vergessen" Funktion.
        </p>
        <p style="text-align: center;">
            <a href="https://admin.partsunion.de" class="button">Zum Admin Dashboard</a>
        </p>
    `;

    try {
        await transport.sendMail({
            from: `"Partsunion Admin" <${STRATO_EMAIL}>`,
            to,
            subject: 'Willkommen - Partsunion Admin Zugang',
            html: wrapEmailHtml(htmlContent, 'Willkommen')
        });
        console.log(`✅ Welcome email sent to ${to}`);
        return true;
    } catch (error: any) {
        console.error(`❌ Failed to send welcome email:`, error.message);
        return false;
    }
}

// Marketing/Bulk Email
export async function sendMarketingEmail(
    recipients: string[],
    subject: string,
    htmlContent: string
): Promise<{ sent: number; failed: number }> {
    const transport = getTransporter();
    if (!transport) {
        console.error('Email transporter not available');
        return { sent: 0, failed: recipients.length };
    }

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
        try {
            await transport.sendMail({
                from: `"Partsunion" <${STRATO_EMAIL}>`,
                to: recipient,
                subject,
                html: wrapEmailHtml(htmlContent, subject)
            });
            sent++;

            // Rate limiting: wait 100ms between emails
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error: any) {
            console.error(`Failed to send to ${recipient}:`, error.message);
            failed++;
        }
    }

    console.log(`📧 Marketing email campaign: ${sent} sent, ${failed} failed`);
    return { sent, failed };
}

// Test SMTP connection
export async function testEmailConnection(): Promise<boolean> {
    const transport = getTransporter();
    if (!transport) {
        return false;
    }

    try {
        await transport.verify();
        console.log('✅ STRATO SMTP connection verified');
        return true;
    } catch (error: any) {
        console.error('❌ STRATO SMTP connection failed:', error.message);
        return false;
    }
}
