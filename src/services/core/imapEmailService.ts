/**
 * IMAP Email Service
 * Connects to STRATO IMAP to fetch and manage emails
 */

import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import { createTransport, Transporter } from 'nodemailer';

// STRATO Server Config
const IMAP_CONFIG = {
    host: 'imap.strato.de',
    port: 993,
    tls: true
};

const SMTP_CONFIG = {
    host: 'smtp.strato.de',
    port: 587,
    secure: false, // Use STARTTLS instead of implicit SSL
    requireTLS: true
};

// Shared mailbox (all admins have access)
const SHARED_MAILBOX = 'info@partsunion.de';

export interface EmailMessage {
    uid: number;
    messageId: string;
    from: { name: string; address: string };
    to: string[];
    subject: string;
    date: Date;
    snippet: string;
    body: string;
    html?: string;
    isRead: boolean;
    hasAttachments: boolean;
    attachments: { filename: string; size: number }[];
}

export interface EmailFolder {
    name: string;
    count: number;
    unread: number;
}

/**
 * Connect to IMAP and fetch emails
 */
export async function fetchEmails(
    email: string,
    password: string,
    folder: string = 'INBOX',
    limit: number = 50
): Promise<EmailMessage[]> {
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user: email,
            password: password,
            ...IMAP_CONFIG
        });

        const emails: EmailMessage[] = [];

        imap.once('ready', () => {
            imap.openBox(folder, true, (err, box) => {
                if (err) {
                    imap.end();
                    return reject(err);
                }

                if (box.messages.total === 0) {
                    imap.end();
                    return resolve([]);
                }

                // Fetch last N messages
                const start = Math.max(1, box.messages.total - limit + 1);
                const fetchRange = `${start}:*`;

                const fetch = imap.seq.fetch(fetchRange, {
                    bodies: '',
                    struct: true
                });

                fetch.on('message', (msg, seqno) => {
                    let uid = 0;

                    msg.on('attributes', (attrs) => {
                        uid = attrs.uid;
                    });

                    msg.on('body', (stream) => {
                        let buffer = '';
                        stream.on('data', (chunk) => {
                            buffer += chunk.toString('utf8');
                        });
                        stream.once('end', async () => {
                            try {
                                const parsed = await simpleParser(buffer);
                                emails.push(parsedMailToEmail(parsed, uid));
                            } catch (parseErr) {
                                console.error('Failed to parse email:', parseErr);
                            }
                        });
                    });
                });

                fetch.once('error', (fetchErr) => {
                    imap.end();
                    reject(fetchErr);
                });

                fetch.once('end', () => {
                    imap.end();
                    // Sort by date descending (newest first)
                    emails.sort((a, b) => b.date.getTime() - a.date.getTime());
                    resolve(emails);
                });
            });
        });

        imap.once('error', (imapErr: Error) => {
            reject(imapErr);
        });

        imap.connect();
    });
}

/**
 * Fetch a single email by UID
 */
export async function fetchEmailByUid(
    email: string,
    password: string,
    uid: number,
    folder: string = 'INBOX'
): Promise<EmailMessage | null> {
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user: email,
            password: password,
            ...IMAP_CONFIG
        });

        imap.once('ready', () => {
            imap.openBox(folder, true, (err) => {
                if (err) {
                    imap.end();
                    return reject(err);
                }

                const fetch = imap.fetch(uid, { bodies: '', struct: true });
                let foundEmail: EmailMessage | null = null;

                fetch.on('message', (msg) => {
                    msg.on('body', (stream) => {
                        let buffer = '';
                        stream.on('data', (chunk) => {
                            buffer += chunk.toString('utf8');
                        });
                        stream.once('end', async () => {
                            try {
                                const parsed = await simpleParser(buffer);
                                foundEmail = parsedMailToEmail(parsed, uid);
                            } catch (parseErr) {
                                console.error('Failed to parse email:', parseErr);
                            }
                        });
                    });
                });

                fetch.once('end', () => {
                    imap.end();
                    resolve(foundEmail);
                });

                fetch.once('error', (fetchErr) => {
                    imap.end();
                    reject(fetchErr);
                });
            });
        });

        imap.once('error', (imapErr: Error) => {
            reject(imapErr);
        });

        imap.connect();
    });
}

/**
 * Send an email via SMTP
 */
export async function sendEmail(
    fromEmail: string,
    password: string,
    to: string,
    subject: string,
    body: string,
    signature?: string,
    replyTo?: string
): Promise<boolean> {
    console.log(`[Email] Attempting to send from ${fromEmail} to ${to}`);

    if (!password) {
        console.error('[Email] No password provided for SMTP');
        throw new Error('SMTP-Passwort fehlt');
    }

    try {
        const transporter: Transporter = createTransport({
            ...SMTP_CONFIG,
            auth: {
                user: fromEmail,
                pass: password
            },
            connectionTimeout: 30000, // 30 seconds
            greetingTimeout: 30000,
            socketTimeout: 60000 // 60 seconds for sending
        });

        const fullBody = signature ? `${body}\n\n--\n${signature}` : body;

        console.log(`[Email] Connecting to SMTP ${SMTP_CONFIG.host}:${SMTP_CONFIG.port}...`);

        const result = await transporter.sendMail({
            from: fromEmail,
            to,
            subject,
            text: fullBody,
            html: fullBody.replace(/\n/g, '<br>'),
            inReplyTo: replyTo,
            references: replyTo ? [replyTo] : undefined
        });

        console.log(`✉️ Email sent from ${fromEmail} to ${to}, messageId: ${result.messageId}`);
        return true;
    } catch (error: any) {
        console.error('[Email] Failed to send:', error.message);
        console.error('[Email] Full error:', error);
        throw new Error(`E-Mail-Versand fehlgeschlagen: ${error.message}`);
    }
}

/**
 * Get folder list with counts
 */
export async function getFolders(
    email: string,
    password: string
): Promise<EmailFolder[]> {
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user: email,
            password: password,
            ...IMAP_CONFIG
        });

        imap.once('ready', () => {
            imap.getBoxes((err, boxes) => {
                if (err) {
                    imap.end();
                    return reject(err);
                }

                const folders: EmailFolder[] = [];

                const processBox = (name: string) => {
                    folders.push({
                        name,
                        count: 0,
                        unread: 0
                    });
                };

                // Standard folders
                ['INBOX', 'Sent', 'Drafts', 'Trash', 'Spam'].forEach(processBox);

                imap.end();
                resolve(folders);
            });
        });

        imap.once('error', (imapErr: Error) => {
            reject(imapErr);
        });

        imap.connect();
    });
}

/**
 * Mark email as read/unread
 */
export async function markEmailRead(
    email: string,
    password: string,
    uid: number,
    read: boolean,
    folder: string = 'INBOX'
): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const imap = new Imap({
            user: email,
            password: password,
            ...IMAP_CONFIG
        });

        imap.once('ready', () => {
            imap.openBox(folder, false, (err) => {
                if (err) {
                    imap.end();
                    return reject(err);
                }

                const flags = ['\\Seen'];
                const method = read ? 'addFlags' : 'delFlags';

                imap[method](uid, flags, (flagErr) => {
                    imap.end();
                    if (flagErr) {
                        reject(flagErr);
                    } else {
                        resolve(true);
                    }
                });
            });
        });

        imap.once('error', (imapErr: Error) => {
            reject(imapErr);
        });

        imap.connect();
    });
}

/**
 * Helper: Convert ParsedMail to our EmailMessage format
 */
function parsedMailToEmail(parsed: ParsedMail, uid: number): EmailMessage {
    // Handle from address (can be AddressObject or AddressObject[])
    let fromAddr: { name: string; address: string } = { name: 'Unknown', address: 'unknown@unknown.com' };
    if (parsed.from) {
        const fromValue = Array.isArray(parsed.from.value) ? parsed.from.value : [parsed.from.value];
        const firstFrom = fromValue[0];
        if (firstFrom) {
            fromAddr = { name: firstFrom.name || firstFrom.address || 'Unknown', address: firstFrom.address || '' };
        }
    }

    // Handle to address (can be AddressObject or AddressObject[])
    let toAddrs: string[] = [];
    if (parsed.to) {
        const toObj = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
        for (const t of toObj) {
            if (t.value) {
                const vals = Array.isArray(t.value) ? t.value : [t.value];
                toAddrs.push(...vals.map((v: any) => v.address || '').filter(Boolean));
            }
        }
    }

    // Create snippet from text body
    const textBody = parsed.text || '';
    const snippet = textBody.substring(0, 150).replace(/\s+/g, ' ').trim();

    return {
        uid,
        messageId: parsed.messageId || '',
        from: fromAddr,
        to: toAddrs,
        subject: parsed.subject || '(Kein Betreff)',
        date: parsed.date || new Date(),
        snippet,
        body: textBody,
        html: parsed.html || undefined,
        isRead: false, // Would need to check flags from IMAP
        hasAttachments: (parsed.attachments?.length || 0) > 0,
        attachments: (parsed.attachments || []).map(a => ({
            filename: a.filename || 'attachment',
            size: a.size || 0
        }))
    };
}

/**
 * Test IMAP connection
 */
export async function testConnection(
    email: string,
    password: string
): Promise<boolean> {
    return new Promise((resolve) => {
        const imap = new Imap({
            user: email,
            password: password,
            ...IMAP_CONFIG
        });

        const timeout = setTimeout(() => {
            imap.end();
            resolve(false);
        }, 10000);

        imap.once('ready', () => {
            clearTimeout(timeout);
            imap.end();
            resolve(true);
        });

        imap.once('error', () => {
            clearTimeout(timeout);
            resolve(false);
        });

        imap.connect();
    });
}

export { SHARED_MAILBOX };
