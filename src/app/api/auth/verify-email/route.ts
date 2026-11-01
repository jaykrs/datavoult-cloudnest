import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { hashResetToken, isUsable } from '@/lib/password-reset';
import { verifyEmailSchema } from '@/lib/email-verification';
import { z } from 'zod';

/** POST /api/auth/verify-email { token } — confirms the address behind a valid, unused, unexpired link. */
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`verify:ip:${clientIp(req)}`, 30, 60 * 60_000);
    if (!limit.allowed) return apiError('Too many attempts. Please try again later.', 429);

    const { token } = verifyEmailSchema.parse(await req.json());
    const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashResetToken(token) } });
    if (!record) return apiError('This verification link is invalid or has expired. Request a new one from your account settings.', 400);

    // Already verified (e.g. link clicked twice) is a success, not an error.
    if (record.usedAt) return apiSuccess({ verified: true, already: true });
    if (!isUsable(record)) return apiError('This verification link has expired. Request a new one from your account settings.', 400);

    const claimed = await prisma.emailVerificationToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count > 0) await prisma.user.update({ where: { id: record.userId }, data: { isVerified: true } });
    return apiSuccess({ verified: true });
  } catch (e) {
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[auth/verify-email]', e);
    return apiError('Internal server error', 500);
  }
}
