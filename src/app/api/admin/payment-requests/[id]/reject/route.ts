import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, rejectManualPaymentSchema } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { OPEN_STATUSES } from '@/lib/manual-payments';
import { notifyManualPaymentReviewed } from '@/lib/notifications';
import { z } from 'zod';

/** POST /api/admin/payment-requests/:id/reject — payment not found / wrong amount / etc. The customer is emailed the reason. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const { reason } = rejectManualPaymentSchema.parse(await req.json());

    const done = await prisma.paymentRequest.updateMany({
      where: { id: params.id, status: { in: [...OPEN_STATUSES] } },
      data: { status: 'REJECTED', reviewedById: session.userId as string, reviewedAt: new Date(), reviewNote: reason },
    });
    if (done.count === 0) {
      const exists = await prisma.paymentRequest.findUnique({ where: { id: params.id }, select: { status: true } });
      return exists
        ? apiError(`This request is already ${exists.status.toLowerCase()}`, 409)
        : apiError('Payment request not found', 404);
    }

    await notifyManualPaymentReviewed(params.id, false);
    return apiSuccess({ rejected: true });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[admin/payment-requests reject]', e);
    return apiError('Internal server error', 500);
  }
}
