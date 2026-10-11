import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { safeEqual } from '@/lib/crypto';
import { toPaise } from '@/lib/currency';
import { fulfillPayment, FulfillmentError } from '@/lib/fulfillment';
import { getRazorpay, parseOrderNotes, mapPaymentMethod } from '@/lib/razorpay';

/**
 * POST /api/razorpay/webhook
 *
 * Razorpay → us. Configure in the Razorpay dashboard:
 *   URL:    https://<your-domain>/api/razorpay/webhook
 *   Secret: the same value as RAZORPAY_WEBHOOK_SECRET
 *   Events: payment.captured, payment.failed, refund.processed
 *
 * The signature is mandatory: with no secret configured the endpoint refuses
 * all traffic rather than accepting unauthenticated events.
 *
 * Status codes matter — Razorpay retries non-2xx responses:
 *   400/401 bad signature · 500 transient failure (retry) · 200 handled or
 *   permanently unprocessable (logged for manual review, retrying won't help).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook] RAZORPAY_WEBHOOK_SECRET is not set — rejecting');
    return Response.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const body = await req.text();
  const signature = req.headers.get('x-razorpay-signature') || '';
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  if (!safeEqual(expected, signature)) {
    console.warn('[webhook] Invalid Razorpay signature');
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    const event = JSON.parse(body);
    const payment = event.payload?.payment?.entity;

    switch (event.event) {
      // ── Payment captured: fulfil even if the browser never came back ───────
      case 'payment.captured': {
        if (!payment?.id || !payment?.order_id) break;

        // Notes come from the order we created, fetched from Razorpay.
        const order = await getRazorpay().orders.fetch(payment.order_id);
        const notes = parseOrderNotes(order.notes);
        if (!notes) {
          console.log('[webhook] payment for an order we did not create — ignoring', payment.id);
          break;
        }
        try {
          const result = await fulfillPayment({
            orderId: payment.order_id,
            paymentId: payment.id,
            amountPaise: Number(payment.amount),
            method: mapPaymentMethod(payment.method),
            notes,
          });
          console.log('[webhook] payment.captured', payment.id, result.outcome);
        } catch (e) {
          if (e instanceof FulfillmentError) {
            console.error('[webhook] FULFILMENT FAILED — manual review/refund needed', payment.id, e.code, e.message);
            break; // permanent: do not make Razorpay retry
          }
          throw e;
        }
        break;
      }

      // ── Payment failed ────────────────────────────────────────────────────
      // A failed attempt never suspends anything: access lapses only when the
      // paid-through period ends (see the billing cron). We just keep the record honest.
      case 'payment.failed': {
        if (payment?.id) {
          await prisma.payment.updateMany({
            where: { gatewayId: payment.id, status: { not: 'COMPLETED' } },
            data: { status: 'FAILED' },
          });
        }
        break;
      }

      // ── Refund processed ──────────────────────────────────────────────────
      case 'refund.processed': {
        const refund = event.payload?.refund?.entity;
        if (!refund?.payment_id) break;

        const paid = await prisma.payment.findUnique({ where: { gatewayId: refund.payment_id } });
        if (!paid) break;

        if (Number(refund.amount) < toPaise(paid.amount.toNumber())) {
          console.log('[webhook] partial refund recorded in logs only', refund.payment_id, refund.amount);
          break;
        }

        await prisma.payment.update({ where: { id: paid.id }, data: { status: 'REFUNDED' } });

        // Fully refunded and nothing else was ever paid on this subscription → end the service.
        if (paid.subscriptionId) {
          const otherPaid = await prisma.payment.count({
            where: { subscriptionId: paid.subscriptionId, status: 'COMPLETED', id: { not: paid.id } },
          });
          if (otherPaid === 0) {
            await prisma.subscription.updateMany({
              where: { id: paid.subscriptionId, status: { notIn: ['CANCELLED', 'EXPIRED'] } },
              data: { status: 'CANCELLED', cancelledAt: new Date() },
            });
          }
        }
        break;
      }

      default:
        console.log('[webhook] Unhandled event:', event.event);
    }

    return Response.json({ received: true, event: event.event });
  } catch (err) {
    console.error('[webhook] Error:', err);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
