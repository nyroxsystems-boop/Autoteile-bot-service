/**
 * Tests for Zod Schemas
 * Verifies that schemas accept valid data and reject invalid data.
 */
import {
  loginSchema,
  createInvoiceSchema,
  createProductSchema,
  stockActionSchema,
  createLeadSchema,
  emailSendSchema,
  emailAssignSchema,
  oemLookupSchema,
  createTenantSchema,
  updateBillingSettingsSchema,
  imapSetupSchema,
} from '../schemas';

describe('loginSchema', () => {
  it('should accept valid login data', () => {
    const result = loginSchema.safeParse({ email: 'user@test.com', password: 'secret123' });
    expect(result.success).toBe(true);
  });

  it('should reject missing password', () => {
    const result = loginSchema.safeParse({ email: 'user@test.com' });
    expect(result.success).toBe(false);
  });

  it('should reject empty email', () => {
    const result = loginSchema.safeParse({ email: '', password: 'secret123' });
    expect(result.success).toBe(false);
  });

  it('should reject unknown fields (strict)', () => {
    const result = loginSchema.safeParse({
      email: 'user@test.com',
      password: 'secret123',
      admin: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('createInvoiceSchema', () => {
  it('should accept valid invoice data', () => {
    const result = createInvoiceSchema.safeParse({
      orderId: 'order-123',
      items: [{ description: 'Bremsscheibe', quantity: 2, unitPrice: 45.99 }],
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty items array', () => {
    const result = createInvoiceSchema.safeParse({ orderId: 'order-123', items: [] });
    expect(result.success).toBe(false);
  });

  it('should reject negative unit price', () => {
    const result = createInvoiceSchema.safeParse({
      orderId: 'order-123',
      items: [{ description: 'Test', quantity: 1, unitPrice: -10 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('createProductSchema', () => {
  it('should accept valid product', () => {
    const result = createProductSchema.safeParse({ name: 'Ölfilter', price: 12.99 });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = createProductSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});

describe('stockActionSchema', () => {
  it('should accept valid stock action', () => {
    const result = stockActionSchema.safeParse({ action: 'add', quantity: 10 });
    expect(result.success).toBe(true);
  });

  it('should reject invalid action', () => {
    const result = stockActionSchema.safeParse({ action: 'delete', quantity: 1 });
    expect(result.success).toBe(false);
  });

  it('should reject negative quantity', () => {
    const result = stockActionSchema.safeParse({ action: 'add', quantity: -5 });
    expect(result.success).toBe(false);
  });
});

describe('createLeadSchema', () => {
  it('should accept valid lead with optional fields', () => {
    const result = createLeadSchema.safeParse({ company: 'AutoHaus GmbH' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = createLeadSchema.safeParse({ email: 'not-email' });
    expect(result.success).toBe(false);
  });

  it('should accept empty email string', () => {
    const result = createLeadSchema.safeParse({ email: '' });
    expect(result.success).toBe(true);
  });
});

describe('emailSendSchema', () => {
  it('should accept valid email', () => {
    const result = emailSendSchema.safeParse({
      to: 'recipient@test.com',
      subject: 'Hello',
      body: 'Test content',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing subject', () => {
    const result = emailSendSchema.safeParse({ to: 'a@b.com', body: 'Content' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid recipient email', () => {
    const result = emailSendSchema.safeParse({
      to: 'invalid',
      subject: 'Hi',
      body: 'Test',
    });
    expect(result.success).toBe(false);
  });
});

describe('emailAssignSchema', () => {
  it('should accept valid assignment', () => {
    const result = emailAssignSchema.safeParse({
      messageId: 'msg-123',
      status: 'in_progress',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing messageId', () => {
    const result = emailAssignSchema.safeParse({ status: 'open' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const result = emailAssignSchema.safeParse({
      messageId: 'msg-1',
      status: 'invalid_status',
    });
    expect(result.success).toBe(false);
  });
});

describe('oemLookupSchema', () => {
  it('should accept valid OEM lookup', () => {
    const result = oemLookupSchema.safeParse({ make: 'VW', part: 'Bremsscheibe vorne' });
    expect(result.success).toBe(true);
  });

  it('should reject missing part description', () => {
    const result = oemLookupSchema.safeParse({ make: 'BMW' });
    expect(result.success).toBe(false);
  });
});

describe('createTenantSchema', () => {
  it('should accept valid tenant', () => {
    const result = createTenantSchema.safeParse({
      name: 'AutoTeile GmbH',
      email: 'info@autoteile.de',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty company name', () => {
    const result = createTenantSchema.safeParse({ name: '', email: 'a@b.com' });
    expect(result.success).toBe(false);
  });
});

describe('updateBillingSettingsSchema', () => {
  it('should accept partial update', () => {
    const result = updateBillingSettingsSchema.safeParse({ invoice_color: '#ff0000' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid logo_position', () => {
    const result = updateBillingSettingsSchema.safeParse({ logo_position: 'bottom' });
    expect(result.success).toBe(false);
  });
});

describe('imapSetupSchema', () => {
  it('should accept valid password', () => {
    const result = imapSetupSchema.safeParse({ imapPassword: 'mypassword123' });
    expect(result.success).toBe(true);
  });

  it('should reject empty password', () => {
    const result = imapSetupSchema.safeParse({ imapPassword: '' });
    expect(result.success).toBe(false);
  });
});
