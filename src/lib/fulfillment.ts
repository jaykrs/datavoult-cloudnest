import { Prisma } from '@prisma/client';
import type { PaymentMethod } from '@prisma/client';
import { prisma } from './prisma';
import { CURRENCY } from './currency';
import { orderTotalPaise, addDays, nextRenewal } from './pricing';
import { runProvisioning, DEFAULT_REGION } from './provisioning';
import type { OrderNotes } from './razorpay';
import { notifyOrderSubscribed } from './notifications';

/** A problem retrying will not fix (bad data, amount mismatch). Callers should not retry. */
export class FulfillmentError extends Error {
  constructor(public code: 'PLAN_NOT_FOUND' | 'AMOUNT_MISMATCH' | 'SUBSCRIPTION_NOT_FOUND' | 'NOT_RENEWABLE' | 'OUT_OF_STOCK', message: string) {
    super(message);
  }
}

export interface FulfillInput {
  orderId: string;
  paymentId: string;
  /** Amount the gateway says was captured, in paise. */
  amountPaise: number;
  method: PaymentMethod;
  /** Notes read back from the Razorpay order (server-created, not client-supplied). */
  notes: OrderNotes;
  /** Where the money came from; recorded on the payment. Defaults to Razorpay. */
  gateway?: 'razorpay' | 'manual';
  /** Extra audit data stored on the payment (e.g. who approved a bank transfer). */
  gatewayExtra?: Record<string, unknown>;
}

export interface FulfillResult {
  outcome: 'created' | 'renewed' | 'duplicate';
  subscriptionId: string | null;
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && (e as { code?: string }).code === 'P2002';
}

/**
 * Turn a captured gateway payment into service. Safe to call any number of
 * times for the same payment (verify route, webhook, retries): `gatewayId` is
 * unique, so the payment is recorded — and the service granted — exactly once.
 *
 * - New order  → payment + PENDING subscription + provisioning job, in ONE
 *                transaction; provisioning then runs and activates it.
 * - Renewal    → payment + extended renewal date (and reactivation if lapsed).
 */
export async function fulfillPayment(input: FulfillInput): Promise<FulfillResult> {
  const { orderId, paymentId, amountPaise, method, notes, gateway = 'razorpay', gatewayExtra = {} } = input;

  const existing = await prisma.payment.findUnique({ where: { gatewayId: paymentId } });
  if (existing) return { outcome: 'duplicate', subscriptionId: existing.subscriptionId };

  const plan = await prisma.plan.findFirst({ where: { id: notes.planId, productId: notes.productId } });
  if (!plan) throw new FulfillmentError('PLAN_NOT_FOUND', `Plan ${notes.planId} not found`);

  // Price = per-day rate × days purchased; the days come from the server-created order.
  const expectedPaise = orderTotalPaise(plan.price.toNumber(), notes.days);
  if (amountPaise !== expectedPaise) {
    throw new FulfillmentError(
      'AMOUNT_MISMATCH',
      `Paid ${amountPaise} paise but ${notes.days} days of plan ${plan.id} cost ${expectedPaise} paise`,
    );
  }

  const now = new Date();
  const paymentData = (subscriptionId: string): Prisma.PaymentUncheckedCreateInput => ({
    userId: notes.userId,
    subscriptionId,
    amount: (expectedPaise / 100).toFixed(2),
    currency: CURRENCY,
    status: 'COMPLETED',
    method,
    gatewayId: paymentId,
    gatewayData: { orderId, paymentId, gateway, days: notes.days, ...gatewayExtra },
    paidAt: now,
  });

  try {
    // ── Renewal ──────────────────────────────────────────────────────────────
    if (notes.subscriptionId) {
      const sub = await prisma.subscription.findFirst({
        where: { id: notes.subscriptionId, userId: notes.userId },
      });
      if (!sub) throw new FulfillmentError('SUBSCRIPTION_NOT_FOUND', 'Subscription to renew not found');
      if (sub.planId !== plan.id || !['ACTIVE', 'SUSPENDED', 'EXPIRED'].includes(sub.status)) {
        throw new FulfillmentError('NOT_RENEWABLE', `Subscription ${sub.id} cannot be renewed (status ${sub.status})`);
      }

      await prisma.$transaction([
        prisma.payment.create({ data: paymentData(sub.id) }),
        prisma.subscription.update({
          where: { id: sub.id },
          data: {
            renewsAt: nextRenewal(now, sub.renewsAt, notes.days),
            status: 'ACTIVE', // lifts a payment-lapse suspension / expiry
            endDate: null,
          },
        }),
      ]);
      return { outcome: 'renewed', subscriptionId: sub.id };
    }

    // ── New subscription ─────────────────────────────────────────────────────
    const subscription = await prisma.$transaction(async (tx) => {
      // Take one unit of stock atomically. `inventoryCount: null` means
      // unlimited and is never touched. The conditional update can't oversell
      // even with concurrent payments; throwing rolls the whole transaction back.
      const product = await tx.product.findUnique({
        where: { id: notes.productId },
        select: { inventoryCount: true },
      });
      if (product && product.inventoryCount !== null) {
        const taken = await tx.product.updateMany({
          where: { id: notes.productId, inventoryCount: { gt: 0 } },
          data: { inventoryCount: { decrement: 1 } },
        });
        if (taken.count === 0) {
          throw new FulfillmentError('OUT_OF_STOCK', `Product ${notes.productId} is out of stock`);
        }
      }

      const created = await tx.subscription.create({
        data: {
          userId: notes.userId,
          productId: notes.productId,
          planId: plan.id,
          status: 'PENDING', // becomes ACTIVE only once the service really exists
          renewsAt: addDays(now, notes.days),
          serviceConfig: { create: { region: DEFAULT_REGION } },
          provisioningJob: { create: {} },
        },
      });
      await tx.payment.create({ data: paymentData(created.id) });
      return created;
    });

    // Best effort: a failure here leaves a FAILED job the cron/admin picks up.
    try {
      await runProvisioning(subscription.id);
    } catch (e) {
      console.error('[fulfillment] provisioning threw', subscription.id, e);
    }
    await notifyOrderSubscribed(subscription.id);
    return { outcome: 'created', subscriptionId: subscription.id };
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Lost a race with another fulfilment of the same payment.
      const winner = await prisma.payment.findUnique({ where: { gatewayId: paymentId } });
      return { outcome: 'duplicate', subscriptionId: winner?.subscriptionId ?? null };
    }
    throw e;
  }
}
