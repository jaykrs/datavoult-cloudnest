import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { stripStock } from '@/lib/inventory';
import { requireAuth } from '@/lib/auth';
import { safeEqual } from '@/lib/crypto';
import { fulfillPayment, FulfillmentError } from '@/lib/fulfillment';
import { getRazorpay, parseOrderNotes, mapPaymentMethod } from '@/lib/razorpay';
import { publicServiceConfig } from '@/lib/serializers';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

const schema = z.object({
  razorpay_order_id:   z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature:  z.string().min(1),
});

/**
 * POST /api/razorpay/verify
 *
 * Called by the browser after the Razorpay modal succeeds. The product and
 * plan are NOT taken from the request: they are read back from the order
 * Razorpay holds (which we created), so a payment for one plan can never be
 * redeemed for another. Idempotent — retrying returns the same subscription.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;

    const limit = rateLimit(`verify:${userId}`, 30, 10 * 60_000);
    if (!limit.allowed) return apiError('Too many requests. Please wait a moment.', 429);

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = schema.parse(await req.json());

    // 1. Signature proves the browser really completed this order/payment pair.
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) return apiError('Payments are not configured', 503);
    const expected = crypto.createHmac('sha256', keySecret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (!safeEqual(expected, razorpay_signature)) {
      return apiError('Payment verification failed — invalid signature', 400);
    }

    // 2. Read the order and payment from Razorpay itself.
    const razorpay = getRazorpay();
    const [order, payment] = await Promise.all([
      razorpay.orders.fetch(razorpay_order_id),
      razorpay.payments.fetch(razorpay_payment_id),
    ]);

    const notes = parseOrderNotes(order.notes);
    if (!notes) return apiError('Unrecognised order', 400);
    if (notes.userId !== userId) return apiError('This order belongs to another account', 403);
    if (payment.order_id !== razorpay_order_id) return apiError('Payment does not belong to this order', 400);

    if (payment.status === 'failed') return apiError('The payment failed. You have not been charged.', 402);
    if (payment.status !== 'captured') {
      // Authorised but not yet captured: the webhook fulfils it on capture.
      // The client retries this call, which is safe.
      return Response.json(
        { success: false, pending: true, error: 'Payment is being confirmed. This usually takes a few seconds.' },
        { status: 202 },
      );
    }

    // 3. Grant the service (idempotent).
    const result = await fulfillPayment({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amountPaise: Number(payment.amount),
      method: mapPaymentMethod(payment.method),
      notes,
    });

    const subscription = result.subscriptionId
      ? await prisma.subscription.findUnique({
          where: { id: result.subscriptionId },
          include: { product: true, plan: true, serviceConfig: publicServiceConfig },
        })
      : null;

    return apiSuccess(stripStock({ subscription, outcome: result.outcome }), result.outcome === 'created' ? 201 : 200);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    if (e instanceof FulfillmentError) {
      // Money was taken but we cannot grant the service: needs a human (and likely a refund).
      console.error('[razorpay/verify] FULFILMENT FAILED — manual review needed', e.code, e.message);
      if (e.code === 'OUT_OF_STOCK') {
        return apiError('This product just sold out, so we could not activate it. Your payment ID is on record and support will refund you — please contact us.', 409);
      }
      return apiError('We received your payment but could not activate the service. Support has been alerted — please contact us with your payment ID.', 409);
    }
    console.error('[razorpay/verify]', e);
    return apiError('Payment verification error', 500);
  }
}
