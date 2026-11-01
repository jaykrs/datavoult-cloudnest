import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';

export const RESET_TTL_MINUTES = 60;

export function generateResetToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000) };
}

/** Only this hash is stored, so a database leak does not expose usable reset links. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isUsable(t: { expiresAt: Date; usedAt: Date | null }, now = new Date()): boolean {
  return !t.usedAt && t.expiresAt.getTime() > now.getTime();
}

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
  recaptchaToken: z.string().max(4000).optional(),
});

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'This reset link is invalid'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});
