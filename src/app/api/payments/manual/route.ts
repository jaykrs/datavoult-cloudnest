import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, createManualPaymentSchema } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { prepareOrder, OrderError } from '@/lib/orders';
import {
  manualMethodAvailable, generateReference, REQUEST_TTL_HOURS, MAX_OPEN_REQUESTS, OPEN_STATUSES,
  getUpiDetails, getBankDetails, bankConfigProblems,
} from '@/lib/manual-payments';
import { serializeRequestForUser } from '@/lib/payment-request-serializer';
import { notifyManualPaymentSubmitted } from '@/lib/notifications';
import { z } from 'zod';

const include = { product: true, plan: true } as const;

/** GET /api/payments/manual — which offline methods are available, plus the caller's own requests. */
export async function GET() {
  try {
    const session = await requireAuth();
    const rows = await prisma.paymentRequest.findMany({
      where: { userId: session.userId as string },
      include,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    if (getBankDetails() === null) console.warn('[payments/manual] Bank transfer hidden:', bankConfigProblems().join('; '));
    return apiSuccess({
      bank: getBankDetails(),
      methods: { UPI: getUpiDetails() !== null, BANK_TRANSFER: getBankDetails() !== null },
      requests: rows.map((r) => serializeRequestForUser(r)),
    });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Internal server error', 500);
  }
}

/**
 * POST /api/payments/manual — start a UPI / bank-transfer order.
 *
 * The amount is computed here (plan price per day × days, min 30) — never taken
 * from the client — and shown to the customer with a unique reference to put in
 * the transfer remark. Nothing is granted until an admin approves the payment.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;

    const limit = rateLimit(`manualpay:${userId}`, 10, 60 * 60_000);
    if (!limit.allowed) return apiError('Too many payment requests. Please try again later.', 429);

    const body = createManualPaymentSchema.parse(await req.json());
    if (!manualMethodAvailable(body.method)) {
      return apiError('This payment method is not available right now', 503);
    }

    const order = await prepareOrder({ ...body, userId });

    // Idempotent: re-opening checkout with the same choices reuses the open request.
    const now = new Date();
    const same = await prisma.paymentRequest.findFirst({
      where: {
        userId, productId: body.productId, planId: body.planId, days: order.days, method: body.method,
        subscriptionId: body.subscriptionId ?? null,
        status: { in: [...OPEN_STATUSES] },
        expiresAt: { gt: now },
      },
      include,
    });
    if (same) return apiSuccess({ request: serializeRequestForUser(same) });

    const openCount = await prisma.paymentRequest.count({
      where: { userId, status: { in: [...OPEN_STATUSES] }, expiresAt: { gt: now } },
    });
    if (openCount >= MAX_OPEN_REQUESTS) {
      return apiError('You have several unpaid payment requests open. Complete or cancel one first.', 409);
    }

    // The reference is unique in the database; retry on the (very unlikely) collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const created = await prisma.paymentRequest.create({
          data: {
            reference: generateReference(),
            userId,
            productId: body.productId,
            planId: body.planId,
            subscriptionId: body.subscriptionId ?? null,
            days: order.days,
            amount: (order.amountPaise / 100).toFixed(2),
            method: body.method,
            expiresAt: new Date(now.getTime() + REQUEST_TTL_HOURS * 3600_000),
          },
          include,
        });
        // Bank transfers go straight to the admin's verification queue (the customer may add the UTR later).
        if (body.method === 'BANK_TRANSFER') void notifyManualPaymentSubmitted(created.id);
        return apiSuccess({ request: serializeRequestForUser(created) }, 201);
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e;
      }
    }
    return apiError('Could not create the payment request. Please try again.', 500);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if (e instanceof OrderError) return apiError(e.message, e.status);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[payments/manual POST]', e);
    return apiError('Could not create the payment request', 500);
  }
}
