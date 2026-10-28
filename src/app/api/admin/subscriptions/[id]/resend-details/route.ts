import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { notifyServerDetails } from '@/lib/notifications';

/** POST /api/admin/subscriptions/[id]/resend-details — email the stored access details to the customer again. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
    const sub = await prisma.subscription.findUnique({ where: { id: params.id }, select: { id: true, status: true } });
    if (!sub) return apiError('Subscription not found', 404);
    if (sub.status !== 'ACTIVE') return apiError('Only active services can have their details re-sent', 409);
    const emailed = await notifyServerDetails(sub.id);
    if (!emailed) return apiError('The email could not be sent (no stored credentials, or email is not configured)', 502);
    return apiSuccess({ emailed: true });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    console.error('[admin/resend-details]', e);
    return apiError('Internal server error', 500);
  }
}
