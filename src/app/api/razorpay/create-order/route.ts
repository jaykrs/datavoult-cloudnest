import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { makeReceipt, CURRENCY } from '@/lib/currency';
import { getRazorpay, razorpayConfigured, notesForRazorpay, type OrderNotes } from '@/lib/razorpay';
import { prepareOrder, OrderError } from '@/lib/orders';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const schema = z.object({
  productId: z.string().min(1),
  planId: z.string().min(1),
  /** Set to renew an existing subscription instead of buying a new one. */
  subscriptionId: z.string().min(1).optional(),
  /** Days of service to buy (minimum 30). */
  days: z.number().int(),
});

/**
 * POST /api/razorpay/create-order
 *
 * Creates a Razorpay order for a plan and returns what the browser needs to
 * open the Razorpay Checkout modal. The price always comes from our database,
 * never from the client. The order notes (user, product, plan, renewal
 * target) are what the server later trusts when it fulfils the payment.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;

    const limit = rateLimit(`order:${userId}`, 20, 10 * 60_000);
    if (!limit.allowed) return apiError('Too many checkout attempts. Please wait a moment.', 429);

    const { productId, planId, subscriptionId, days: requestedDays } = schema.parse(await req.json());

    if (!razorpayConfigured()) return apiError('Payments are not configured', 503);

    // Validates the days (min 30), plan, stock and ownership, and prices the order
    // from the database: per-day price × days.
    const { plan, days, amountPaise } = await prepareOrder({ userId, productId, planId, subscriptionId, days: requestedDays });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const notes: OrderNotes = { userId, productId, planId, days, ...(subscriptionId ? { subscriptionId } : {}) };
    const order = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: CURRENCY,
      receipt: makeReceipt(crypto.randomUUID()),
      notes: notesForRazorpay(notes),
    });

    return apiSuccess({
      orderId: order.id,
      amount: amountPaise,
      currency: CURRENCY,
      keyId: process.env.RAZORPAY_KEY_ID,
      planName: plan.name,
      planPrice: plan.price,
      days,
      userName: user?.name || '',
      userEmail: user?.email || '',
    });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if (e instanceof OrderError) return apiError(e.message, e.status);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[razorpay/create-order]', e);
    return apiError('Failed to create payment order', 500);
  }
}
