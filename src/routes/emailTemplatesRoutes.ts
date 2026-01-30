/**
 * Email Templates API Routes
 * Handles AI email generation and sending for admin dashboard
 */

import { Router, type Request, type Response } from "express";
import * as db from "../services/core/database";
import { randomUUID } from "crypto";
import { generateEmailTemplate, improveEmailContent } from "../services/intelligence/geminiEmailGenerator";
import { sendMarketingEmail } from "../services/core/emailService";
import { logActivity, ACTION_TYPES, ENTITY_TYPES } from "../services/core/activityLogger";
import { getCompanies } from "@adapters/realInvenTreeAdapter";

const router = Router();

// Middleware to extract admin username from token
async function getAdminUsername(req: Request): Promise<string> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Token ')) {
        return 'Unknown';
    }

    const token = authHeader.substring(6);
    try {
        const session = await db.get<any>(
            `SELECT a.username FROM admin_sessions s 
             JOIN admin_users a ON s.admin_id = a.id 
             WHERE s.token = ?`,
            [token]
        );
        return session?.username || 'Unknown';
    } catch {
        return 'Unknown';
    }
}

/**
 * POST /api/admin/emails/generate
 * Generate email template using Gemini AI
 */
router.post("/generate", async (req: Request, res: Response) => {
    const { prompt, improve, existingContent } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "Prompt ist erforderlich" });
    }

    try {
        let result;
        if (improve && existingContent) {
            result = await improveEmailContent(existingContent, prompt);
        } else {
            result = await generateEmailTemplate(prompt);
        }

        return res.json({
            success: true,
            email: result
        });
    } catch (error: any) {
        console.error("Email generation error:", error);
        return res.status(500).json({
            error: error.message || "E-Mail-Generierung fehlgeschlagen"
        });
    }
});

/**
 * GET /api/admin/emails/recipients/:type
 * Get recipients by type
 */
router.get("/recipients/:type", async (req: Request, res: Response) => {
    const { type } = req.params;

    try {
        let recipients: { email: string; name: string; id: string }[] = [];

        switch (type) {
            case 'active':
                // Active dealers (is_customer=true, is_active=true)
                const activeCompanies = await getCompanies({ is_customer: true });
                recipients = activeCompanies
                    .filter((c: any) => c.active !== false)
                    .map((c: any) => ({
                        email: c.email || '',
                        name: c.name,
                        id: String(c.pk)
                    }))
                    .filter((r: any) => r.email);
                break;

            case 'cancelled':
                // Cancelled dealers (payment_status = overdue or inactive)
                const cancelledCompanies = await getCompanies({ is_customer: true });
                recipients = cancelledCompanies
                    .filter((c: any) => c.active === false)
                    .map((c: any) => ({
                        email: c.email || '',
                        name: c.name,
                        id: String(c.pk)
                    }))
                    .filter((r: any) => r.email);
                break;

            case 'trial':
                // Trial users from local DB
                const trialUsers = await db.all<any>(
                    `SELECT DISTINCT u.email, u.name, u.id 
                     FROM users u 
                     WHERE u.email IS NOT NULL AND u.email != ''`
                );
                recipients = trialUsers.map((u) => ({
                    email: u.email,
                    name: u.name || u.email.split('@')[0],
                    id: u.id
                }));
                break;

            case 'all':
                // All customers
                const allCompanies = await getCompanies({ is_customer: true });
                recipients = allCompanies
                    .map((c: any) => ({
                        email: c.email || '',
                        name: c.name,
                        id: String(c.pk)
                    }))
                    .filter((r: any) => r.email);
                break;

            default:
                return res.status(400).json({ error: "Ungültiger Empfängertyp" });
        }

        return res.json({
            type,
            count: recipients.length,
            recipients
        });

    } catch (error: any) {
        console.error("Error fetching recipients:", error);
        return res.status(500).json({ error: "Empfänger konnten nicht geladen werden" });
    }
});

/**
 * POST /api/admin/emails/send
 * Send email to selected recipients
 */
router.post("/send", async (req: Request, res: Response) => {
    const { subject, htmlContent, recipientType, customEmails } = req.body;
    const adminUsername = await getAdminUsername(req);

    if (!subject || !htmlContent) {
        return res.status(400).json({ error: "Betreff und Inhalt sind erforderlich" });
    }

    try {
        let emails: string[] = [];

        if (customEmails && Array.isArray(customEmails) && customEmails.length > 0) {
            // Use custom email list
            emails = customEmails.filter((e: string) => e && e.includes('@'));
        } else if (recipientType) {
            // Get recipients by type
            const recipientsResponse = await fetch(
                `http://localhost:${process.env.PORT || 3000}/api/admin/emails/recipients/${recipientType}`,
                { headers: req.headers as any }
            );
            const data = await recipientsResponse.json();
            emails = data.recipients?.map((r: any) => r.email) || [];
        }

        if (emails.length === 0) {
            return res.status(400).json({ error: "Keine gültigen Empfänger" });
        }

        // Send emails
        const result = await sendMarketingEmail(emails, subject, htmlContent);

        // Log activity
        await logActivity({
            adminUsername,
            actionType: ACTION_TYPES.EMAIL_CAMPAIGN_SENT,
            entityType: ENTITY_TYPES.EMAIL,
            entityName: subject,
            newValue: {
                recipientType: recipientType || 'custom',
                totalRecipients: emails.length,
                sent: result.sent,
                failed: result.failed
            },
            ipAddress: req.ip || req.socket.remoteAddress
        });

        return res.json({
            success: true,
            sent: result.sent,
            failed: result.failed,
            total: emails.length
        });

    } catch (error: any) {
        console.error("Email send error:", error);
        return res.status(500).json({ error: "E-Mail-Versand fehlgeschlagen" });
    }
});

/**
 * GET /api/admin/emails/templates
 * Get saved email templates
 */
router.get("/templates", async (req: Request, res: Response) => {
    try {
        const templates = await db.all<any>(
            `SELECT * FROM email_templates ORDER BY created_at DESC LIMIT 50`
        );
        return res.json(templates);
    } catch {
        // Table might not exist yet
        return res.json([]);
    }
});

/**
 * POST /api/admin/emails/templates
 * Save email template
 */
router.post("/templates", async (req: Request, res: Response) => {
    const { name, subject, htmlContent, prompt } = req.body;
    const adminUsername = await getAdminUsername(req);

    if (!name || !subject || !htmlContent) {
        return res.status(400).json({ error: "Name, Betreff und Inhalt sind erforderlich" });
    }

    try {
        // Ensure table exists
        await db.run(`
            CREATE TABLE IF NOT EXISTS email_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                subject TEXT NOT NULL,
                html_content TEXT NOT NULL,
                prompt TEXT,
                created_by TEXT,
                created_at TEXT NOT NULL
            )
        `);

        const id = randomUUID();
        await db.run(
            `INSERT INTO email_templates (id, name, subject, html_content, prompt, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, name, subject, htmlContent, prompt || null, adminUsername, new Date().toISOString()]
        );

        await logActivity({
            adminUsername,
            actionType: ACTION_TYPES.EMAIL_TEMPLATE_CREATED,
            entityType: ENTITY_TYPES.EMAIL,
            entityId: id,
            entityName: name,
            ipAddress: req.ip || req.socket.remoteAddress
        });

        return res.json({ success: true, id });
    } catch (error: any) {
        console.error("Error saving template:", error);
        return res.status(500).json({ error: "Template konnte nicht gespeichert werden" });
    }
});

export default router;
