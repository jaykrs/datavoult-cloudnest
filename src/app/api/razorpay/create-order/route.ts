import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { toPaise, makeReceipt, CURRENCY } from '@/lib/currency';
import { z } from 'zod';

const schema = z.object({
  productId: z.string(),
  planId: z.string(),
});

/**
 * POST /api/razorpay/create-order
 *
 * Creates a Razorpay order and returns {orderId, amount, currency, keyId}
 * so the frontend can open the Razorpay checkout modal.
 *
 * Razorpay SDK is loaded server-side using the secret key.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body    = await req.json();
    const { productId, planId } = schema.parse(body);

    // Validate plan
    const plan = await prisma.plan.findFirst({ where: { id: planId, productId } });
    if (!plan) return apiError('Plan not found', 404);
    if (!plan?.price) apiError('Plan price not found', 404);
    // Check for duplicate active subscription
    const existing = await prisma.subscription.findFirst({
      where: { userId: session.userId as string, productId, status: { in: ['ACTIVE', 'TRIAL'] } },
    });
    if (existing) return apiError('You already have an active subscription to this product', 409);

    // Fetch user for Razorpay notes
    const user = await prisma.user.findUnique({ where: { id: session.userId as string}, select: { name: true, email: true } });

    const amountPaise = toPaise(plan.price.toNumber()); // e.g. ₹499 → 49900 paise

    // ── Dynamic Razorpay import (avoids build errors if package not installed) ──
    let Razorpay: typeof import('razorpay');
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('razorpay');
      Razorpay = mod.default || mod;
    } catch {
      return apiError('Razorpay SDK not installed. Run: npm install razorpay', 500);
    }

    const keyId     = process.env.RAZORPAY_KEY_ID     || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    if (!keyId || !keySecret) {
      return apiError('Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env', 500);
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    // Temporary receipt id — will be linked to subscription after payment
    const receipt = makeReceipt(`${session.userId}-${planId}`);

    const order = await (razorpay.orders.create as Function)({
      amount:   amountPaise,
      currency: CURRENCY,
      receipt,
      notes: {
        userId:    session.userId,
        productId,
        planId,
        userName:  user?.name  || '',
        userEmail: user?.email || '',
        planName:  plan.name,
        amount:    String(plan.price),
      },
    });

    return apiSuccess({
      orderId:  order.id,
      amount:   amountPaise,
      currency: CURRENCY,
      keyId,
      planName: plan.name,
      planPrice: plan.price,
      userName:  user?.name  || '',
      userEmail: user?.email || '',
    });

  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[razorpay/create-order]', e);
    return apiError('Failed to create Razorpay order', 500);
  }
}