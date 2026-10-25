import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, contactSchema } from '@/lib/api';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { verifyRecaptcha, recaptchaErrorResponse } from '@/lib/recaptcha';
import { notifyContactMessage } from '@/lib/notifications';
import { z } from 'zod';

/** POST /api/contact — public "Contact us" form. Stored for the admin dashboard and emailed to admins. */
export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const limit = rateLimit(`contact:ip:${ip}`, 5, 60 * 60_000);
    if (!limit.allowed) {
      return apiError(`Too many messages. Please try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`, 429);
    }

    const { recaptchaToken, website, ...data } = contactSchema.parse(await req.json());

    // Honeypot: a bot filled the hidden field. Pretend success, store nothing.
    if (website) return apiSuccess({ received: true }, 201);

    const captcha = await verifyRecaptcha(recaptchaToken, ip);
    if (!captcha.ok) return recaptchaErrorResponse(captcha);

    // Deliberately no IP/user-agent stored: not needed, and less personal data to protect.
    const saved = await prisma.contactMessage.create({ data });
    await notifyContactMessage(data);

    return apiSuccess({ received: true, id: saved.id }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[contact]', e);
    return apiError('Could not send your message. Please try again.', 500);
  }
}
