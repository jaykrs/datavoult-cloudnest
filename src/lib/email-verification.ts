import { randomBytes } from 'crypto';
import { z } from 'zod';
import { hashResetToken } from './password-reset';

export const VERIFY_TTL_HOURS = 24;

export function generateVerificationToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + VERIFY_TTL_HOURS * 3600_000) };
}

export const verifyEmailSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'This verification link is invalid') });
