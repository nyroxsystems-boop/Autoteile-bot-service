import { logger } from './logger';

describe('logger PII redaction', () => {
  const origConsoleLog = console.log;
  beforeEach(() => {
    (console.log as any) = jest.fn();
  });
  afterEach(() => {
    console.log = origConsoleLog;
    jest.restoreAllMocks();
  });

  it('redacts VIN, phone and email in meta when logging', () => {
    const meta = {
      orderId: 'order-1',
      debug: 'VIN VWVZZZ1JZXW000001 and phone +49 170 1234567 and email test@example.com'
    };

    logger.info(meta, 'Test message');

    expect((console.log as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    const logged = (console.log as jest.Mock).mock.calls[0][0];
    expect(typeof logged).toBe('string');
    const parsed = JSON.parse(logged);
    expect(parsed).toHaveProperty('meta');
    const serialized = parsed.meta;
    // check redactions
    expect(serialized.debug).toContain('[REDACTED_VIN]');
    expect(serialized.debug).toContain('[REDACTED_PHONE]');
    expect(serialized.debug).toContain('[REDACTED_EMAIL]');
  });
});
