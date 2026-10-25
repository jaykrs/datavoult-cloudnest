import { describe, it, expect, vi, afterEach } from 'vitest';
import { verifyRecaptcha } from './recaptcha';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('verifyRecaptcha', () => {
  it('skips in development when no secret is set', async () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('RECAPTCHA_SECRET_KEY', '');
    expect(await verifyRecaptcha(undefined)).toEqual({ ok: true, skipped: true });
  });

  it('fails closed in production when no secret is set', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('RECAPTCHA_SECRET_KEY', '');
    expect(await verifyRecaptcha('tok')).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('rejects a missing token when configured', async () => {
    vi.stubEnv('RECAPTCHA_SECRET_KEY', 's');
    expect(await verifyRecaptcha(null)).toEqual({ ok: false, reason: 'missing' });
  });

  it('accepts when Google says success, sending secret/response/remoteip', async () => {
    vi.stubEnv('RECAPTCHA_SECRET_KEY', 's');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    expect(await verifyRecaptcha('tok', '1.2.3.4')).toEqual({ ok: true });
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('secret')).toBe('s');
    expect(body.get('response')).toBe('tok');
    expect(body.get('remoteip')).toBe('1.2.3.4');
  });

  it('rejects when Google says failure', async () => {
    vi.stubEnv('RECAPTCHA_SECRET_KEY', 's');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false }) }));
    expect(await verifyRecaptcha('tok')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('fails closed when Google is unreachable or errors', async () => {
    vi.stubEnv('RECAPTCHA_SECRET_KEY', 's');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await verifyRecaptcha('tok')).toEqual({ ok: false, reason: 'unavailable' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await verifyRecaptcha('tok')).toEqual({ ok: false, reason: 'unavailable' });
  });
});
