import { Prisma } from '@prisma/client';
import type { PaymentMethod } from '@prisma/client';
import { prisma } from './prisma';
import { toPaise, CURRENCY } from './currency';
import { addBillingCycle, nextRenewal, type Cycle } from './billing';
import { runProvisioning, DEFAULT_REGION } from './provisioning';
import type { OrderNotes } from './razorpay';

/** A problem retrying will not fix (bad data, amount mismatch). Callers should not retry. */
export class FulfillmentError extends Error {
  constructor(public code: 'PLAN_NOT_FOUND' | 'AMOUNT_MISMATCH' | 'SUBSCRIPTION_NOT_FOUND' | 'NOT_RENEWABLE', message: string) {
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
  const { orderId, paymentId, amountPaise, method, notes } = input;

  const existing = await prisma.payment.findUnique({ where: { gatewayId: paymentId } });
  if (existing) return { outcome: 'duplicate', subscriptionId: existing.subscriptionId };

  const plan = await prisma.plan.findFirst({ where: { id: notes.planId, productId: notes.productId } });
  if (!plan) throw new FulfillmentError('PLAN_NOT_FOUND', `Plan ${notes.planId} not found`);

  if (amountPaise !== toPaise(plan.price.toNumber())) {
    throw new FulfillmentError(
      'AMOUNT_MISMATCH',
      `Paid ${amountPaise} paise but plan ${plan.id} costs ${toPaise(plan.price.toNumber())} paise`,
    );
  }

  const now = new Date();
  const paymentData = (subscriptionId: string): Prisma.PaymentUncheckedCreateInput => ({
    userId: notes.userId,
    subscriptionId,
    amount: plan.price,
    currency: CURRENCY,
    status: 'COMPLETED',
    method,
    gatewayId: paymentId,
    gatewayData: { orderId, paymentId, gateway: 'razorpay' },
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
            renewsAt: nextRenewal(now, sub.renewsAt, plan.billingCycle as Cycle),
            status: 'ACTIVE', // lifts a payment-lapse suspension / expiry
            endDate: null,
          },
        }),
      ]);
      return { outcome: 'renewed', subscriptionId: sub.id };
    }

    // ── New subscription ─────────────────────────────────────────────────────
    const subscription = await prisma.$transaction(async (tx) => {
      const created = await tx.subscription.create({
        data: {
          userId: notes.userId,
          productId: notes.productId,
          planId: plan.id,
          status: 'PENDING', // becomes ACTIVE only once the service really exists
          renewsAt: addBillingCycle(now, plan.billingCycle as Cycle),
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
