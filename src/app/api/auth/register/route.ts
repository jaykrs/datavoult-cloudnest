import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken, createAuthResponse } from '@/lib/auth';
import { apiError, registerSchema } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { verifyRecaptcha, recaptchaErrorResponse } from '@/lib/recaptcha';
import { notifyUserSignedUp } from '@/lib/notifications';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`register:ip:${clientIp(req)}`, 10, 60 * 60_000);
    if (!limit.allowed) {
      return apiError(`Too many sign-ups from this address. Try again in ${limit.retryAfterSeconds}s.`, 429);
    }

    const body = await req.json();
    const { name, email, password, recaptchaToken } = registerSchema.parse(body);

    const captcha = await verifyRecaptcha(recaptchaToken, clientIp(req));
    if (!captcha.ok) return recaptchaErrorResponse(captcha);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return apiError('Email already in use', 409);

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, passwordHash, privacyAcceptedAt: new Date() },
    });

    await notifyUserSignedUp({ name: user.name, email: user.email });

    const token = await signToken({ userId: user.id, email: user.email, role: user.role });

    return createAuthResponse(token, {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    return apiError('Internal server error', 500);
  }
}
