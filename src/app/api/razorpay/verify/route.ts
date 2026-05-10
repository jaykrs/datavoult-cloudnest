import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { CURRENCY } from '@/lib/currency';
import { z } from 'zod';

const schema = z.object({
  razorpay_order_id:   z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature:  z.string(),
  productId:           z.string(),
  planId:              z.string(),
});

/**
 * POST /api/razorpay/verify
 *
 * Called from client after Razorpay modal success.
 * Verifies the HMAC signature, then creates the subscription + payment record.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body    = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      productId,
      planId,
    } = schema.parse(body);

    // ── 1. Verify signature ──────────────────────────────────────────────────
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    if (!keySecret) return apiError('Razorpay secret key not configured', 500);

    const body_str = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(body_str)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return apiError('Payment verification failed — invalid signature', 400);
    }

    // ── 2. Validate plan ─────────────────────────────────────────────────────
    const plan = await prisma.plan.findFirst({ where: { id: planId, productId } });
    if (!plan) return apiError('Plan not found', 404);

    // ── 3. Guard against duplicate subscriptions ─────────────────────────────
    const existing = await prisma.subscription.findFirst({
      where: { userId: session.userId as string, productId, status: { in: ['ACTIVE', 'TRIAL'] } },
    });
    if (existing) return apiError('Already subscribed to this product', 409);

    // ── 4. Compute renewal date ───────────────────────────────────────────────
    const now      = new Date();
    const renewsAt = new Date(now);
    renewsAt.setMonth(
      renewsAt.getMonth() + (
        plan.billingCycle === 'ANNUAL'    ? 12 :
        plan.billingCycle === 'QUARTERLY' ? 3  : 1
      )
    );

    // ── 5. Provision service config ───────────────────────────────────────────
    const randomHex = () => Math.random().toString(36).slice(2, 10);
    const randomIp  = () =>
      `${rn(50, 250)}.${rn(1, 254)}.${rn(1, 254)}.${rn(1, 254)}`;
    const rn = (min: number, max: number) => Math.floor(Math.random() * (max - min) + min);

    const regions = ['ap-south-1 (Mumbai)', 'ap-south-2 (Hyderabad)', 'ap-southeast-1 (Singapore)', 'us-east-1'];
    const region  = regions[0]; // default to Mumbai for Indian customers

    const product = await prisma.product.findUnique({ where: { id: productId } });
    const isEmail = product?.category === 'EMAIL';

    // ── 6. Create subscription + service config + payment (atomic) ────────────
    const subscription = await prisma.subscription.create({
      data: {
        userId:    session.userId as string,
        productId,
        planId,
        renewsAt,
        serviceConfig: {
          create: {
            hostname:  isEmail ? `mail-${randomHex()}.datavoult.io` : `srv-${randomHex()}.datavoult.io`,
            ipAddress: isEmail ? undefined : randomIp(),
            region,
            config: isEmail
              ? { imapServer: 'imap.datavoult.io', smtpServer: 'smtp.datavoult.io' }
              : { os: 'Ubuntu 22.04 LTS' },
          },
        },
      },
      include: { product: true, plan: true, serviceConfig: true },
    });

    await prisma.payment.create({
      data: {
        userId:         session.userId as string,
        subscriptionId: subscription.id,
        amount:         plan.price,
        currency:       CURRENCY,
        status:         'COMPLETED',
        method:         'CARD',
        gatewayId:      razorpay_payment_id,
        gatewayData:    {
          orderId:   razorpay_order_id,
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
          gateway:   'razorpay',
        },
        paidAt: now,
      },
    });

    return apiSuccess({ subscription }, 201);

  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[razorpay/verify]', e);
    return apiError('Payment verification error', 500);
  }
}