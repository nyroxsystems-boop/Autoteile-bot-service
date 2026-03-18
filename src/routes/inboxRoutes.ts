/**
 * Inbox Routes - Email Management API
 * IMAP-based email access for admin dashboard
 */

import { Router, type Request, type Response } from 'express';
import { logger } from "@utils/logger";
import * as db from '../services/core/database';
import {
    fetchEmails,
    fetchEmailByUid,
    markEmailRead,
    testConnection,
    SHARED_MAILBOX
} from '../services/core/imapEmailService';
import { sendEmailViaResend, isResendConfigured } from '../services/core/resendEmailService';
import { generateEmailReply } from '../services/intelligence/geminiEmailReply';
import { encrypt, decrypt, isEncrypted } from '../utils/encryption';

const router = Router();

// Debug log on startup
logger.info(`[Inbox] SHARED_MAILBOX: ${SHARED_MAILBOX}`);

// STRATO password for IMAP and SMTP
const SHARED_MAILBOX_PASSWORD = process.env.STRATO_PASSWORD || process.env.SHARED_MAILBOX_PASSWORD || '';
logger.info(`[Inbox] STRATO_PASSWORD: ${SHARED_MAILBOX_PASSWORD ? 'SET' : 'NOT SET'}`);
// Previous log leaked password length — removed for security

/**
 * Middleware: Get current admin from token
 */
async function getAdminFromToken(req: Request): Promise<any | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Token ')) {
        logger.info('[Inbox] No Token header found');
        return null;
    }

    const token = authHeader.substring(6);
    logger.info(`[Inbox] Checking admin token (length: ${token.length})`);

    try {
        const session = await db.get<any>(
            `SELECT s.*, a.* FROM admin_sessions s 
             JOIN admin_users a ON s.admin_id = a.id 
             WHERE s.token = ? AND s.expires_at::TIMESTAMP > NOW()`,
            [token]
        );

        logger.info(`[Inbox] Admin session found: ${!!session}, username: ${session?.username || 'none'}`);
        return session;
    } catch (error: any) {
        logger.error('[Inbox] Token check error:', error.message);
        return null;
    }
}

/**
 * GET /api/inbox/emails
 * Fetch emails from personal or shared mailbox
 */
router.get('/emails', async (req: Request, res: Response) => {
    const admin = await getAdminFromToken(req);
    if (!admin) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const mailbox = req.query.mailbox as string || 'personal';
    const folder = req.query.folder as string || 'INBOX';
    const limit = parseInt(req.query.limit as string) || 50;

    try {
        let email: string;
        let password: string;

        if (mailbox === 'shared') {
            email = SHARED_MAILBOX;
            password = SHARED_MAILBOX_PASSWORD;
        } else {
            email = admin.email;
            // For personal mailbox, admin needs to have set their IMAP password
            if (!admin.imap_password_encrypted) {
                return res.status(400).json({
                    error: 'IMAP-Passwort nicht konfiguriert',
                    needsSetup: true
                });
            }
            // Decrypt password (AES-256-GCM, with base64 fallback for legacy)
            password = isEncrypted(admin.imap_password_encrypted)
                ? decrypt(admin.imap_password_encrypted)
                : Buffer.from(admin.imap_password_encrypted, 'base64').toString('utf8');
        }

        if (!password) {
            const errorMsg = mailbox === 'shared'
                ? 'STRATO_PASSWORD Umgebungsvariable nicht gesetzt. Bitte in Railway konfigurieren.'
                : 'E-Mail-Passwort nicht konfiguriert';
            logger.error(`[Inbox] Password missing for ${mailbox}: ${errorMsg}`);
            return res.status(400).json({ error: errorMsg });
        }

        const allEmails = await fetchEmails(email, password, folder, limit * 2); // Fetch more to account for filtering

        // Filter emails by recipient address
        // For shared mailbox: only show emails TO info@partsunion.de
        // For personal mailbox: only show emails TO user's email
        const targetEmail = email.toLowerCase();
        const filteredEmails = allEmails.filter(e => {
            const recipients = e.to.map(addr => addr.toLowerCase());
            return recipients.some(addr => addr === targetEmail);
        }).slice(0, limit); // Limit after filtering

        logger.info(`[Inbox] Fetched ${allEmails.length} emails, filtered to ${filteredEmails.length} for ${targetEmail}`);

        // Enrich with assignment info
        const messageIds = filteredEmails.map(e => e.messageId).filter(Boolean);
        const assignments = messageIds.length > 0 ? await db.all<any>(
            `SELECT * FROM email_assignments WHERE message_id IN (${messageIds.map(() => '?').join(',')})`,
            messageIds
        ) : [];

        const assignmentMap = new Map(assignments.map(a => [a.message_id, a]));

        const enrichedEmails = filteredEmails.map(e => ({
            ...e,
            assignment: assignmentMap.get(e.messageId) || null
        }));

        return res.json({
            mailbox,
            folder,
            count: enrichedEmails.length,
            emails: enrichedEmails
        });

    } catch (error: any) {
        logger.error('Inbox fetch error:', error);
        return res.status(500).json({ error: error.message || 'E-Mails konnten nicht abgerufen werden' });
    }
});

/**
 * GET /api/inbox/email/:uid
 * Fetch single email details
 */
router.get('/email/:uid', async (req: Request, res: Response) => {
    const admin = await getAdminFromToken(req);
    if (!admin) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const uid = parseInt(req.params.uid);
    const mailbox = req.query.mailbox as string || 'personal';
    const folder = req.query.folder as string || 'INBOX';

    try {
        let email: string;
        let password: string;

        if (mailbox === 'shared') {
            email = SHARED_MAILBOX;
            password = SHARED_MAILBOX_PASSWORD;
        } else {
            email = admin.email;
            if (!admin.imap_password_encrypted) {
                return res.status(400).json({ error: 'IMAP-Passwort nicht konfiguriert' });
            }
            password = isEncrypted(admin.imap_password_encrypted)
                ? decrypt(admin.imap_password_encrypted)
                : Buffer.from(admin.imap_password_encrypted, 'base64').toString('utf8');
        }

        const emailData = await fetchEmailByUid(email, password, uid, folder);

        if (!emailData) {
            return res.status(404).json({ error: 'E-Mail nicht gefunden' });
        }

        // Get assignment
        const assignment = await db.get<any>(
            'SELECT * FROM email_assignments WHERE message_id = ?',
            [emailData.messageId]
        );

        return res.json({
            ...emailData,
            assignment
        });

    } catch (error: any) {
        logger.error('Email fetch error:', error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/inbox/email/:uid/assign
 * Assign email to an admin
 */
router.post('/email/:uid/assign', async (req: Request, res: Response) => {
    const admin = await getAdminFromToken(req);
    if (!admin) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const { messageId, mailbox, assignedTo, status, notes } = req.body;

    if (!messageId) {
        return res.status(400).json({ error: 'Message ID erforderlich' });
    }

    try {
        const now = new Date().toISOString();

        // Upsert assignment
        await db.run(`
            INSERT INTO email_assignments (message_id, mailbox, assigned_to, status, notes, assigned_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(message_id) DO UPDATE SET
                assigned_to = ?,
                status = ?,
                notes = ?,
                assigned_at = ?,
                completed_at = CASE WHEN ? = 'done' THEN ? ELSE completed_at END
        `, [
            messageId, mailbox, assignedTo, status || 'in_progress', notes, now, now,
            assignedTo, status || 'in_progress', notes, now, status, now
        ]);

        return res.json({ success: true });

    } catch (error: any) {
        logger.error('Assignment error:', error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/inbox/email/send
 * Send an email (reply or new)
 */
router.post('/email/send', async (req: Request, res: Response) => {
    const admin = await getAdminFromToken(req);
    if (!admin) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const { to, subject, body, htmlContent, useSharedMailbox, replyToMessageId } = req.body;

    if (!to || !subject || !body) {
        return res.status(400).json({ error: 'Empfänger, Betreff und Text erforderlich' });
    }

    // Resend is required because Railway blocks outbound SMTP connections
    if (!isResendConfigured()) {
        logger.error('[Inbox Send] RESEND_API_KEY not configured!');
        return res.status(500).json({
            error: 'RESEND_API_KEY nicht konfiguriert. Bitte in Railway als Environment Variable setzen.'
        });
    }

    const fromEmail = useSharedMailbox ? SHARED_MAILBOX : (admin.email || SHARED_MAILBOX);
    logger.info(`[Inbox Send] User: ${admin.username}, From: ${fromEmail}, To: ${to} via Resend`);

    try {
        const result = await sendEmailViaResend({
            to,
            subject,
            body,
            html: htmlContent || undefined,
            from: fromEmail,
            fromName: useSharedMailbox ? 'Partsunion' : admin.username,
            replyTo: replyToMessageId,
            signature: admin.signature || undefined
        });

        if (result.success) {
            logger.info(`[Inbox Send] ✅ Success! Email sent to ${to}, ID: ${result.messageId}`);
            return res.json({ success: true, message: 'E-Mail gesendet', messageId: result.messageId });
        } else {
            logger.error('[Inbox Send] ❌ Failed:', result.error);
            return res.status(500).json({ error: result.error || 'E-Mail konnte nicht gesendet werden' });
        }

    } catch (error: any) {
        logger.error('[Inbox Send] Error:', error.message);
        return res.status(500).json({ error: error.message || 'E-Mail-Versand fehlgeschlagen' });
    }
});


/**
 * POST /api/inbox/email/ai-reply
 * Generate AI reply suggestion
 */
router.post('/email/ai-reply', async (req: Request, res: Response) => {
    const admin = await getAdminFromToken(req);
    if (!admin) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const { originalEmail, prompt, tone } = req.body;

    if (!originalEmail) {
        return res.status(400).json({ error: 'Original-E-Mail erforderlich' });
    }

    try {
        const reply = await generateEmailReply(
            originalEmail,
            prompt || 'Antworte professionell auf diese E-Mail',
            tone || 'professional',
            admin.signature || undefined,
            admin.full_name || admin.username
        );

        return res.json({ reply });

    } catch (error: any) {
        logger.error('AI reply error:', error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * PATCH /api/inbox/email/:uid/read
 * Mark email as read/unread
 */
router.patch('/email/:uid/read', async (req: Request, res: Response) => {
    const admin = await getAdminFromToken(req);
    if (!admin) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const uid = parseInt(req.params.uid);
    const { read, mailbox, folder } = req.body;

    try {
        let email: string;
        let password: string;

        if (mailbox === 'shared') {
            email = SHARED_MAILBOX;
            password = SHARED_MAILBOX_PASSWORD;
        } else {
            email = admin.email;
            if (!admin.imap_password_encrypted) {
                return res.status(400).json({ error: 'IMAP-Passwort nicht konfiguriert' });
            }
            password = isEncrypted(admin.imap_password_encrypted)
                ? decrypt(admin.imap_password_encrypted)
                : Buffer.from(admin.imap_password_encrypted, 'base64').toString('utf8');
        }

        await markEmailRead(email, password, uid, read, folder || 'INBOX');

        return res.json({ success: true });

    } catch (error: any) {
        logger.error('Mark read error:', error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/inbox/setup
 * Setup personal mailbox (store IMAP password)
 */
router.post('/setup', async (req: Request, res: Response) => {
    const admin = await getAdminFromToken(req);
    if (!admin) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const { imapPassword } = req.body;

    if (!imapPassword) {
        return res.status(400).json({ error: 'IMAP-Passwort erforderlich' });
    }

    try {
        // Test connection first
        const connected = await testConnection(admin.email, imapPassword);
        if (!connected) {
            return res.status(400).json({ error: 'IMAP-Verbindung fehlgeschlagen. Passwort prüfen.' });
        }

        // Store encrypted password (AES-256-GCM)
        const encryptedPassword = encrypt(imapPassword);

        await db.run(
            'UPDATE admin_users SET imap_password_encrypted = ? WHERE id = ?',
            [encryptedPassword, admin.admin_id]
        );

        return res.json({ success: true, message: 'IMAP-Zugang konfiguriert' });

    } catch (error: any) {
        logger.error('IMAP setup error:', error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/inbox/test
 * Test IMAP connection
 */
router.get('/test', async (req: Request, res: Response) => {
    const admin = await getAdminFromToken(req);
    if (!admin) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const mailbox = req.query.mailbox as string || 'shared';

    try {
        let email: string;
        let password: string;

        if (mailbox === 'shared') {
            email = SHARED_MAILBOX;
            password = SHARED_MAILBOX_PASSWORD;
        } else {
            email = admin.email;
            if (!admin.imap_password_encrypted) {
                return res.json({ connected: false, reason: 'IMAP-Passwort nicht konfiguriert' });
            }
            password = isEncrypted(admin.imap_password_encrypted)
                ? decrypt(admin.imap_password_encrypted)
                : Buffer.from(admin.imap_password_encrypted, 'base64').toString('utf8');
        }

        const connected = await testConnection(email, password);

        return res.json({ connected, email });

    } catch (error: any) {
        return res.json({ connected: false, reason: error.message });
    }
});

export default router;
