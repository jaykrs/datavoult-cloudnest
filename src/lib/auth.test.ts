import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SignJWT } from 'jose';

vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }));

import { getJwtSecret, signToken, verifyToken, authCookie } from './auth';

const GOOD = 'x'.repeat(48);
const original = { secret: process.env.JWT_SECRET, env: process.env.NODE_ENV };

beforeEach(() => { process.env.JWT_SECRET = GOOD; });
afterEach(() => {
  if (original.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = original.secret;
  (process.env as Record<string, string | undefined>).NODE_ENV = original.env;
});

describe('JWT secret', () => {
  it('has no fallback: missing secret throws', () => {
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('rejects a short secret', () => {
    process.env.JWT_SECRET = 'short';
    expect(() => getJwtSecret()).toThrow(/at least 32/);
  });

  it('does not fall back to the old hard-coded default', async () => {
    // A token signed with the former public default must not verify.
    const legacy = new TextEncoder().encode('fallback-secret-change-in-production-32chars');
    const forged = await new SignJWT({ userId: 'u', email: 'a@b.c', role: 'ADMIN' })
      .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(legacy);
    expect(await verifyToken(forged)).toBeNull();
  });
});

describe('tokens', () => {
  it('round-trips', async () => {
    const t = await signToken({ userId: 'u1', email: 'a@b.c', role: 'USER' });
    expect(await verifyToken(t)).toMatchObject({ userId: 'u1', role: 'USER' });
  });

  it('rejects tampered, wrong-secret and unsigned tokens', async () => {
    const t = await signToken({ userId: 'u1', email: 'a@b.c', role: 'USER' });
    const [h, p, s] = t.split('.');
    const escalated = Buffer.from(JSON.stringify({ userId: 'u1', email: 'a@b.c', role: 'ADMIN' })).toString('base64url');
    expect(await verifyToken(`${h}.${escalated}.${s}`)).toBeNull();

    process.env.JWT_SECRET = 'y'.repeat(48);
    expect(await verifyToken(t)).toBeNull();

    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${p}.`;
    expect(await verifyToken(none)).toBeNull();
  });

  it('treats a misconfigured secret as unauthenticated rather than crashing', async () => {
    const t = await signToken({ userId: 'u1', email: 'a@b.c', role: 'USER' });
    delete process.env.JWT_SECRET;
    expect(await verifyToken(t)).toBeNull();
  });
});

describe('authCookie', () => {
  it('is HttpOnly + SameSite and Secure in production', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    const c = authCookie('tok');
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Secure');
    expect(c).toContain('Max-Age=604800');
  });

  it('omits Secure outside production so localhost login works', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    expect(authCookie('tok')).not.toContain('Secure');
  });

  it('clears the cookie when given null', () => {
    expect(authCookie(null)).toContain('Max-Age=0');
  });
});
