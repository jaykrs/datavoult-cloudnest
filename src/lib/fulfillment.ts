import { Prisma } from '@prisma/client';
import type { PaymentMethod } from '@prisma/client';
import { prisma } from './prisma';
import { CURRENCY } from './currency';
import { computeOrderAmounts, gstSettingFrom, addDays, nextRenewal } from './pricing';
import { runProvisioning, DEFAULT_REGION } from './provisioning';
import type { OrderNotes } from './razorpay';
import { notifyOrderSubscribed } from './notifications';
import { issueInvoiceForGatewayId } from './invoices';
import { PENDING_APPROVAL } from './gateway-approval';

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
  if (existing) {
    // Retry path: also covers an invoice that couldn't be issued the first time (e.g. seller details were missing).
    await issueInvoiceForGatewayId(paymentId);
    return { outcome: 'duplicate', subscriptionId: existing.subscriptionId };
  }

  const plan = await prisma.plan.findFirst({
    where: { id: notes.planId, productId: notes.productId },
    include: { product: true },
  });
  if (!plan) throw new FulfillmentError('PLAN_NOT_FOUND', `Plan ${notes.planId} not found`);

  // Price = per-day rate × days purchased (+ GST if the product adds it on top); the
  // days come from the server-created order.
  const gstSetting = gstSettingFrom(plan.product);
  const amounts = computeOrderAmounts(plan.price.toNumber(), notes.days, gstSetting);
  const expectedPaise = amounts.totalPaise;
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
    // The tax breakdown is snapshotted here: the invoice is built from it later.
    gatewayData: {
      orderId, paymentId, gateway, days: notes.days,
      basePaise: amounts.basePaise, gstPaise: amounts.gstPaise, gstRate: amounts.rate, gstInclusive: gstSetting.inclusive,
      ...gatewayExtra,
    },
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
      await issueInvoiceForGatewayId(paymentId);
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

      // Same for the plan's own stock. Skipped entirely for untracked (null) plans.
      if (plan.inventoryCount !== null && plan.inventoryCount !== undefined) {
        const takenPlan = await tx.plan.updateMany({
          where: { id: plan.id, inventoryCount: { gt: 0 } },
          data: { inventoryCount: { decrement: 1 } },
        });
        if (takenPlan.count === 0) {
          throw new FulfillmentError('OUT_OF_STOCK', `Plan ${plan.id} is sold out`);
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
      const base = paymentData(created.id);
      await tx.payment.create({
        data: gateway === 'razorpay'
          ? { ...base, gatewayData: { ...(base.gatewayData as object), approval: PENDING_APPROVAL } }
          : base,
      });
      return created;
    });

    // Online payments follow the same flow as UPI / bank transfer: the order waits for an admin to
    // confirm it and provision the server. Set AUTO_PROVISION=true only with a real automated provider.
    if (process.env.AUTO_PROVISION === 'true') {
      // Best effort: a failure here leaves a FAILED job the cron/admin picks up.
      try {
        await runProvisioning(subscription.id);
      } catch (e) {
        console.error('[fulfillment] provisioning threw', subscription.id, e);
      }
    }
    await issueInvoiceForGatewayId(paymentId);
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
