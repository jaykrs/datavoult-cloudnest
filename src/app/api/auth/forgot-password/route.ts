import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { verifyRecaptcha, recaptchaErrorResponse } from '@/lib/recaptcha';
import { forgotPasswordSchema, generateResetToken } from '@/lib/password-reset';
import { notifyPasswordReset } from '@/lib/notifications';
import { z } from 'zod';

/**
 * POST /api/auth/forgot-password — emails a single-use reset link (valid 1 hour).
 * The response is identical whether or not the email has an account, so it cannot be used to
 * discover who is registered. Rate limited per IP and per address.
 */
export async function POST(req: NextRequest) {
  try {
    const ipLimit = rateLimit(`forgot:ip:${clientIp(req)}`, 10, 60 * 60_000);
    if (!ipLimit.allowed) return apiError(`Too many requests. Try again in ${ipLimit.retryAfterSeconds}s.`, 429);

    const { email, recaptchaToken } = forgotPasswordSchema.parse(await req.json());
    const captcha = await verifyRecaptcha(recaptchaToken, clientIp(req));
    if (!captcha.ok) return recaptchaErrorResponse(captcha);

    const generic = apiSuccess({ message: 'If an account exists for that email, a reset link is on its way.' });
    const emailLimit = rateLimit(`forgot:email:${email}`, 3, 60 * 60_000);
    if (!emailLimit.allowed) return generic; // silently stop — don't reveal anything or mail-bomb the owner

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
    if (user) {
      const { token, tokenHash, expiresAt } = generateResetToken();
      // One live link at a time: older unused ones stop working.
      await prisma.$transaction([
        prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
        prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } }),
      ]);
      await notifyPasswordReset(user, token);
    }
    return generic;
  } catch (e) {
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[auth/forgot-password]', e);
    return apiError('Internal server error', 500);
  }
}
