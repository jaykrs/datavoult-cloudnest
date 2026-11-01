import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { sendVerificationEmail } from '@/lib/notifications';

/** POST /api/auth/resend-verification — the signed-in, still-unverified user asks for a fresh link. */
export async function POST() {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;
    const limit = rateLimit(`resendverify:${userId}`, 3, 60 * 60_000);
    if (!limit.allowed) return apiError('Too many requests. Please try again later.', 429);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, isVerified: true } });
    if (!user) return apiError('User not found', 404);
    if (user.isVerified) return apiSuccess({ alreadyVerified: true });
    await sendVerificationEmail(user);
    return apiSuccess({ sent: true });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[auth/resend-verification]', e);
    return apiError('Internal server error', 500);
  }
}
