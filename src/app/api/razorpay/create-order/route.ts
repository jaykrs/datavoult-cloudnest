import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { toPaise, makeReceipt, CURRENCY } from '@/lib/currency';
import { getRazorpay, razorpayConfigured, type OrderNotes } from '@/lib/razorpay';
import { rateLimit } from '@/lib/rate-limit';
import { isInStock } from '@/lib/inventory';
import { z } from 'zod';

const schema = z.object({
  productId: z.string().min(1),
  planId: z.string().min(1),
  /** Set to renew an existing subscription instead of buying a new one. */
  subscriptionId: z.string().min(1).optional(),
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

    const { productId, planId, subscriptionId } = schema.parse(await req.json());

    if (!razorpayConfigured()) return apiError('Payments are not configured', 503);

    const plan = await prisma.plan.findFirst({ where: { id: planId, productId }, include: { product: true } });
    // A soft-deleted plan can still be renewed by people already on it, but not newly bought.
    if (!plan || (plan.isDeleted && !subscriptionId)) return apiError('Plan not found', 404);
    if (plan.product.status !== 'ACTIVE') return apiError('This product is not available for purchase', 409);
    if (plan.price.lte(0)) return apiError('This plan has no price configured', 409);

    if (subscriptionId) {
      // Renewal: must be the caller's own, on the same plan, and not cancelled.
      const sub = await prisma.subscription.findFirst({ where: { id: subscriptionId, userId } });
      if (!sub) return apiError('Subscription not found', 404);
      if (sub.planId !== plan.id) return apiError('Plan does not match this subscription', 400);
      if (!['ACTIVE', 'SUSPENDED', 'EXPIRED'].includes(sub.status)) {
        return apiError('This subscription cannot be renewed', 409);
      }
    } else {
      const existing = await prisma.subscription.findFirst({
        where: { userId, productId, status: { in: ['ACTIVE', 'TRIAL', 'PENDING'] } },
      });
      if (existing) return apiError('You already have a subscription to this product', 409);
      // Renewals bypass this: people already on the product keep their service.
      if (!isInStock(plan.product.inventoryCount)) return apiError('This product is currently out of stock', 409);
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    const amountPaise = toPaise(plan.price.toNumber());

    const notes: OrderNotes = { userId, productId, planId, ...(subscriptionId ? { subscriptionId } : {}) };
    const order = await getRazorpay().orders.create({
      amount: amountPaise,
      currency: CURRENCY,
      receipt: makeReceipt(crypto.randomUUID()),
      notes: notes as unknown as Record<string, string>,
    });

    return apiSuccess({
      orderId: order.id,
      amount: amountPaise,
      currency: CURRENCY,
      keyId: process.env.RAZORPAY_KEY_ID,
      planName: plan.name,
      planPrice: plan.price,
      userName: user?.name || '',
      userEmail: user?.email || '',
    });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[razorpay/create-order]', e);
    return apiError('Failed to create payment order', 500);
  }
}
