import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/razorpay/webhook
 *
 * Receives Razorpay webhook events (payment.captured, payment.failed, etc.)
 * Configure in Razorpay dashboard:
 *   URL: https://yourdomain.com/api/razorpay/webhook
 *   Secret: Set RAZORPAY_WEBHOOK_SECRET in your .env
 *   Events: payment.captured, payment.failed, subscription.cancelled
 */
export async function POST(req: NextRequest) {
  try {
    const body      = await req.text();
    const signature = req.headers.get('x-razorpay-signature') || '';
    const secret    = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    // ── Verify webhook signature ─────────────────────────────────────────────
    if (secret) {
      const expected = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      if (expected !== signature) {
        console.warn('[webhook] Invalid Razorpay signature');
        return Response.json({ error: 'Invalid signature' }, { status: 400 });
      }
    }

    const event = JSON.parse(body);
    const entity = event.payload?.payment?.entity;

    console.log('[webhook] Event:', event.event, '| PaymentId:', entity?.id);

    switch (event.event) {

      // ── Payment captured (authorised + captured) ──────────────────────────
      case 'payment.captured': {
        if (entity?.id) {
          await prisma.payment.updateMany({
            where:  { gatewayId: entity.id },
            data:   { status: 'COMPLETED', paidAt: new Date() },
          });
        }
        break;
      }

      // ── Payment failed ────────────────────────────────────────────────────
      case 'payment.failed': {
        if (entity?.id) {
          await prisma.payment.updateMany({
            where: { gatewayId: entity.id },
            data:  { status: 'FAILED' },
          });
          // Suspend subscription if payment for renewal failed
          const payment = await prisma.payment.findFirst({ where: { gatewayId: entity.id } });
          if (payment?.subscriptionId) {
            await prisma.subscription.update({
              where: { id: payment.subscriptionId },
              data:  { status: 'SUSPENDED' },
            });
          }
        }
        break;
      }

      // ── Refund processed ──────────────────────────────────────────────────
      case 'refund.processed': {
        const refundEntity = event.payload?.refund?.entity;
        if (refundEntity?.payment_id) {
          await prisma.payment.updateMany({
            where: { gatewayId: refundEntity.payment_id },
            data:  { status: 'REFUNDED' },
          });
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