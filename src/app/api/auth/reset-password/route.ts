import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { hashResetToken, isUsable, resetPasswordSchema } from '@/lib/password-reset';
import { z } from 'zod';

/** POST /api/auth/reset-password — set a new password with a valid, unused, unexpired link. */
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`reset:ip:${clientIp(req)}`, 20, 60 * 60_000);
    if (!limit.allowed) return apiError('Too many attempts. Please try again later.', 429);

    const { token, password } = resetPasswordSchema.parse(await req.json());
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) } });
    if (!record || !isUsable(record)) return apiError('This reset link is invalid or has expired. Please request a new one.', 400);

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    // Claim the token first (conditional), so a double submit can't reuse it.
    const claimed = await prisma.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count === 0) return apiError('This reset link has already been used.', 400);

    await prisma.$transaction([
      // passwordChangedAt invalidates every session issued before now (see requireAuth).
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash, passwordChangedAt: now, isVerified: true } }), // the emailed link proves the mailbox is theirs
      prisma.session.deleteMany({ where: { userId: record.userId } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } }),
    ]);
    return apiSuccess({ message: 'Your password has been reset. You can now sign in.' });
  } catch (e) {
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[auth/reset-password]', e);
    return apiError('Internal server error', 500);
  }
}
