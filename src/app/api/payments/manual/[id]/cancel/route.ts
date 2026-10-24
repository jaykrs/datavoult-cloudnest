import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAuth } from '@/lib/auth';

/** POST /api/payments/manual/:id/cancel — withdraw a request that has not been reported as paid. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    const done = await prisma.paymentRequest.updateMany({
      where: { id: params.id, userId: session.userId as string, status: 'AWAITING_PAYMENT' },
      data: { status: 'CANCELLED' },
    });
    if (done.count === 0) {
      return apiError('Only a request that has not been marked as paid can be cancelled', 409);
    }
    return apiSuccess({ cancelled: true });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Internal server error', 500);
  }
}
