import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { serializeRequestForUser } from '@/lib/payment-request-serializer';

/** GET /api/payments/manual/:id — one of the caller's own requests (404 for anyone else's). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    const row = await prisma.paymentRequest.findFirst({
      where: { id: params.id, userId: session.userId as string },
      include: { product: true, plan: true },
    });
    if (!row) return apiError('Payment request not found', 404);
    return apiSuccess({ request: serializeRequestForUser(row) });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Internal server error', 500);
  }
}
