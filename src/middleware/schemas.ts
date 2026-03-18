/**
 * Zod Schemas for all API routes
 * Centralized request validation schemas.
 */
import { z } from 'zod';

// ── Shared ──

const email = z.string().email('Ungültige E-Mail-Adresse').max(255);
const password = z.string().min(8, 'Mindestens 8 Zeichen').max(128);
const username = z.string().min(2, 'Mindestens 2 Zeichen').max(64).regex(/^[a-zA-Z0-9._-]+$/, 'Nur Buchstaben, Zahlen, Punkt, Bindestrich, Unterstrich');
const id = z.coerce.number().int().positive();

// ── Auth Routes ──

export const loginSchema = z.object({
    email: z.string().min(1, 'E-Mail erforderlich').max(255),
    password: z.string().min(1, 'Passwort erforderlich').max(128),
    device_id: z.string().max(128).optional(),
    device_name: z.string().max(128).optional(),
}).strict();

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Aktuelles Passwort erforderlich'),
    newPassword: password,
}).strict();

export const registerSchema = z.object({
    email: email,
    password: password,
    username: username.optional(),
    tenant_id: z.number().int().positive().optional(),
}).strict();

// ── Admin Auth Routes ──

export const adminLoginSchema = z.object({
    username: z.string().min(1, 'Benutzername erforderlich').max(64),
    password: z.string().min(1, 'Passwort erforderlich').max(128),
}).strict();

export const requestResetSchema = z.object({
    email: email,
}).strict();

export const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Token erforderlich'),
    newPassword: password,
}).strict();

export const updateEmailSchema = z.object({
    adminId: id.optional(),
    email: email,
}).strict();

export const updateSignatureSchema = z.object({
    signature: z.string().max(2000, 'Signatur zu lang').optional(),
}).strict();

export const adminChangePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: password,
}).strict();

// ── Admin Routes (Tenant/User Management) ──

export const createUserSchema = z.object({
    email: email,
    username: username,
    password: password,
    role: z.enum(['TENANT_ADMIN', 'TENANT_USER']).default('TENANT_USER'),
}).strict();

export const createTenantSchema = z.object({
    name: z.string().min(1, 'Firmenname erforderlich').max(255),
    email: email,
    phone: z.string().max(30).optional().default(''),
    website: z.string().max(255).optional().default(''),
    password: z.string().min(8).max(128).optional(),
    whatsapp_number: z.string().max(30).optional().default(''),
    logo_url: z.string().url().max(500).optional().or(z.literal('')).default(''),
}).strict();

export const updateTenantLimitsSchema = z.object({
    max_users: z.number().int().min(1).max(100),
    max_devices: z.number().int().min(1).max(50),
}).strict();

export const resetUserPasswordSchema = z.object({
    newPassword: password.optional(),
}).strict();

// ── Onboarding Routes ──

export const onboardingInitializeSchema = z.object({
    tenantId: id,
}).strict();

export const onboardingTwilioSchema = z.object({
    tenantId: id,
    accountSid: z.string().min(1),
    authToken: z.string().min(1),
    phoneNumber: z.string().min(1),
}).strict();

export const onboardingImportSchema = z.object({
    tenantId: id,
    source: z.enum(['csv', 'inventree', 'manual']).default('manual'),
}).strict();

export const onboardingShopSchema = z.object({
    tenantId: id,
    shopName: z.string().min(1).max(255),
    shopUrl: z.string().url().optional(),
}).strict();

export const seedOemDatabaseSchema = z.object({
    script: z.enum(['massive', 'remaining', 'standalone']),
}).strict();

// ── Invoice Routes ──

export const createInvoiceSchema = z.object({
    orderId: z.string().min(1, 'Order-ID erforderlich'),
    items: z.array(z.object({
        description: z.string().min(1),
        quantity: z.number().positive(),
        unitPrice: z.number().min(0),
        oem: z.string().optional(),
    })).min(1, 'Mindestens eine Position'),
    customerEmail: email.optional(),
    notes: z.string().max(1000).optional(),
}).strict();

// ── Inbox Routes ──

export const sendEmailSchema = z.object({
    to: email,
    subject: z.string().min(1, 'Betreff erforderlich').max(500),
    body: z.string().min(1, 'Nachricht erforderlich').max(50000),
    inReplyTo: z.string().optional(),
    references: z.string().optional(),
}).strict();

export const saveImapSettingsSchema = z.object({
    imap_host: z.string().min(1),
    imap_port: z.coerce.number().int().min(1).max(65535),
    imap_user: z.string().min(1),
    imap_password: z.string().min(1),
    smtp_host: z.string().min(1),
    smtp_port: z.coerce.number().int().min(1).max(65535),
    smtp_user: z.string().min(1),
    smtp_password: z.string().min(1),
}).strict();

// ── Supplier Routes ──

export const createSupplierSchema = z.object({
    name: z.string().min(1).max(255),
    email: email.optional(),
    phone: z.string().max(30).optional(),
    website: z.string().max(255).optional(),
    address: z.string().max(500).optional(),
    notes: z.string().max(2000).optional(),
}).strict();

// ── Product Routes ──

export const createProductSchema = z.object({
    name: z.string().min(1).max(255),
    sku: z.string().max(100).optional(),
    oem_number: z.string().max(100).optional(),
    description: z.string().max(2000).optional(),
    category: z.string().max(100).optional(),
    price: z.number().min(0).optional(),
    stock_quantity: z.number().int().min(0).optional(),
}).strict();

// ── OEM Routes ──

export const oemLookupSchema = z.object({
    make: z.string().min(1).max(50).optional(),
    model: z.string().max(100).optional(),
    year: z.coerce.number().int().min(1900).max(2030).optional(),
    vin: z.string().max(17).optional(),
    hsn: z.string().max(10).optional(),
    tsn: z.string().max(10).optional(),
    part: z.string().min(1, 'Teilebeschreibung erforderlich').max(500),
}).strict();

// ── Param Schemas ──

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const tenantDeviceParamSchema = z.object({
    id: z.coerce.number().int().positive(),
    deviceId: z.string().min(1),
});
