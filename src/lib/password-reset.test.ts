import { describe, it, expect } from 'vitest';
import { generateResetToken, hashResetToken, isUsable, forgotPasswordSchema, resetPasswordSchema, RESET_TTL_MINUTES } from './password-reset';
import { isSessionStale } from './auth';
import { passwordResetEmail } from './email-templates';

describe('reset tokens', () => {
  it('stores only a hash and expires in an hour', () => {
    const t = generateResetToken();
    expect(t.token).toMatch(/^[a-f0-9]{64}$/);
    expect(t.tokenHash).toBe(hashResetToken(t.token));
    expect(t.tokenHash).not.toContain(t.token);
    const mins = (t.expiresAt.getTime() - Date.now()) / 60_000;
    expect(mins).toBeGreaterThan(RESET_TTL_MINUTES - 1);
    expect(mins).toBeLessThanOrEqual(RESET_TTL_MINUTES);
  });
  it('generates unique tokens', () => {
    expect(generateResetToken().token).not.toBe(generateResetToken().token);
  });
  it('is usable only when unused and unexpired', () => {
    const future = new Date(Date.now() + 60_000), past = new Date(Date.now() - 60_000);
    expect(isUsable({ expiresAt: future, usedAt: null })).toBe(true);
    expect(isUsable({ expiresAt: past, usedAt: null })).toBe(false);
    expect(isUsable({ expiresAt: future, usedAt: new Date() })).toBe(false);
  });
});

describe('validation', () => {
  it('normalises and validates the email', () => {
    expect(forgotPasswordSchema.parse({ email: '  A@B.com ' }).email).toBe('a@b.com');
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
  it('requires a well-formed token and a strong-enough password', () => {
    const token = 'a'.repeat(64);
    expect(resetPasswordSchema.safeParse({ token: 'short', password: 'longenough' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token, password: 'short' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token, password: 'longenough' }).success).toBe(true);
  });
});

describe('sessions after a password change', () => {
  const changed = new Date('2026-11-01T00:00:10Z');
  const sec = (d: string) => Math.floor(new Date(d).getTime() / 1000);
  it('rejects tokens issued before the change, accepts later ones', () => {
    expect(isSessionStale(sec('2026-11-01T00:00:00Z'), changed)).toBe(true);
    expect(isSessionStale(sec('2026-11-01T00:00:10Z'), changed)).toBe(false);
    expect(isSessionStale(sec('2026-11-02T00:00:00Z'), changed)).toBe(false);
  });
  it('ignores accounts that never reset', () => {
    expect(isSessionStale(1, null)).toBe(false);
  });
  it('rejects a token with no issue time once a reset happened', () => {
    expect(isSessionStale(undefined, changed)).toBe(true);
  });
});

describe('passwordResetEmail', () => {
  it('contains the link and escapes the name', () => {
    const e = passwordResetEmail('<b>x</b>', 'https://x.com/reset-password?token=abc', 60);
    expect(e.text).toContain('https://x.com/reset-password?token=abc');
    expect(e.html).not.toContain('<b>x</b>');
  });
});
