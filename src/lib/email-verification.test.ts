import { describe, it, expect } from 'vitest';
import { generateVerificationToken, verifyEmailSchema, VERIFY_TTL_HOURS } from './email-verification';
import { hashResetToken } from './password-reset';
import { verifyEmailEmail } from './email-templates';

describe('email verification tokens', () => {
  it('stores only a hash and lasts 24 hours', () => {
    const t = generateVerificationToken();
    expect(t.token).toMatch(/^[a-f0-9]{64}$/);
    expect(t.tokenHash).toBe(hashResetToken(t.token));
    const hours = (t.expiresAt.getTime() - Date.now()) / 3600_000;
    expect(hours).toBeGreaterThan(VERIFY_TTL_HOURS - 0.1);
    expect(hours).toBeLessThanOrEqual(VERIFY_TTL_HOURS);
  });
  it('rejects malformed tokens', () => {
    expect(verifyEmailSchema.safeParse({ token: 'abc' }).success).toBe(false);
    expect(verifyEmailSchema.safeParse({ token: 'a'.repeat(64) }).success).toBe(true);
  });
  it('email carries the link and escapes the name', () => {
    const e = verifyEmailEmail('<i>x</i>', 'https://x.com/verify-email?token=abc', 24);
    expect(e.text).toContain('https://x.com/verify-email?token=abc');
    expect(e.html).not.toContain('<i>x</i>');
  });
});
