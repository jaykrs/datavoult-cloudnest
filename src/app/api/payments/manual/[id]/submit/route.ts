import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, submitManualPaymentSchema } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { OPEN_STATUSES } from '@/lib/manual-payments';
import { serializeRequestForUser } from '@/lib/payment-request-serializer';
import { notifyManualPaymentSubmitted } from '@/lib/notifications';
import { z } from 'zod';

/**
 * POST /api/payments/manual/:id/submit — the customer reports they have paid and
 * gives the bank/UPI transaction reference (UTR). Moves the request to SUBMITTED
 * so it shows up for admin review. The reference can be corrected until review.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;

    const limit = rateLimit(`manualsubmit:${userId}`, 20, 60 * 60_000);
    if (!limit.allowed) return apiError('Too many attempts. Please try again later.', 429);

    const { transactionRef, payerDetails } = submitManualPaymentSchema.parse(await req.json());

    const existing = await prisma.paymentRequest.findFirst({ where: { id: params.id, userId } });
    if (!existing) return apiError('Payment request not found', 404);
    if (!(OPEN_STATUSES as readonly string[]).includes(existing.status)) {
      return apiError('This payment request is already closed', 409);
    }
    if (existing.status === 'AWAITING_PAYMENT' && existing.expiresAt < new Date()) {
      return apiError('This payment request has expired. Please start a new order.', 410);
    }

    // The same bank reference can't back two orders.
    const clash = await prisma.paymentRequest.findFirst({
      where: { transactionRef, id: { not: existing.id }, status: { in: ['SUBMITTED', 'APPROVED'] } },
      select: { id: true },
    });
    if (clash) return apiError('That transaction reference has already been used for another order.', 409);

    // Atomic: only moves an open request, so it can't race with an admin decision.
    const moved = await prisma.paymentRequest.updateMany({
      where: { id: existing.id, userId, status: { in: [...OPEN_STATUSES] } },
      data: { status: 'SUBMITTED', transactionRef, payerDetails: payerDetails || null, submittedAt: new Date() },
    });
    if (moved.count === 0) return apiError('This payment request was just closed', 409);

    await notifyManualPaymentSubmitted(existing.id);

    const row = await prisma.paymentRequest.findUnique({ where: { id: existing.id }, include: { product: true, plan: true } });
    return apiSuccess({ request: serializeRequestForUser(row!) });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[payments/manual submit]', e);
    return apiError('Internal server error', 500);
  }
}
