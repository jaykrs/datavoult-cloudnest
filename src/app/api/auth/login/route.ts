import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { signToken, createAuthResponse } from '@/lib/auth';
import { apiError, loginSchema } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { verifyRecaptcha, recaptchaErrorResponse } from '@/lib/recaptcha';
import { z } from 'zod';

// Real bcrypt hash (same cost as user hashes) of a random value, compared
// against when the email is unknown so response time does not reveal which
// emails are registered. Generated lazily, once per process.
let dummyHash: string | null = null;
function getDummyHash(): string {
  if (!dummyHash) dummyHash = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);
  return dummyHash;
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const ipLimit = rateLimit(`login:ip:${ip}`, 30, 15 * 60_000);
    if (!ipLimit.allowed) {
      return apiError(`Too many attempts. Try again in ${ipLimit.retryAfterSeconds}s.`, 429);
    }

    const body = await req.json();
    const { email, password, recaptchaToken } = loginSchema.parse(body);

    const captcha = await verifyRecaptcha(recaptchaToken, ip);
    if (!captcha.ok) return recaptchaErrorResponse(captcha);

    const accountLimit = rateLimit(`login:acct:${email.toLowerCase()}`, 10, 15 * 60_000);
    if (!accountLimit.allowed) {
      return apiError(`Too many attempts. Try again in ${accountLimit.retryAfterSeconds}s.`, 429);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());
    if (!user || !valid) return apiError('Invalid email or password', 401);

    const token = await signToken({ userId: user.id, email: user.email, role: user.role });

    return createAuthResponse(token, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[auth/login]', e);
    return apiError('Internal server error', 500);
  }
}
