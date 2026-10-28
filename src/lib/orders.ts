import { prisma } from './prisma';
import { assertValidDays, computeOrderAmounts, gstSettingFrom, InvalidDaysError, type OrderAmounts } from './pricing';
import { isInStock } from './inventory';

/** A reason an order can't be placed, with the HTTP status to answer with. */
export class OrderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface PreparedOrder {
  plan: { id: string; name: string; price: { toNumber(): number } };
  product: { id: string; name: string };
  days: number;
  /** Server-computed total in paise (per-day price × days, plus GST if added on top). Never taken from the client. */
  amountPaise: number;
  /** Taxable value / GST / total breakdown behind `amountPaise`. */
  amounts: OrderAmounts;
  subscriptionId?: string;
}

/**
 * Validate a purchase or renewal request and price it. Shared by every payment
 * method (Razorpay, UPI, bank transfer) so the rules cannot drift apart:
 * the amount always comes from the database plan × the validated number of
 * days (minimum 30) plus the product's GST setting, and stock/ownership checks are identical.
 */
export async function prepareOrder(input: {
  userId: string;
  productId: string;
  planId: string;
  days: unknown;
  subscriptionId?: string;
}): Promise<PreparedOrder> {
  const { userId, productId, planId, subscriptionId } = input;

  let days: number;
  try {
    days = assertValidDays(input.days);
  } catch (e) {
    if (e instanceof InvalidDaysError) throw new OrderError(400, e.message);
    throw e;
  }

  const plan = await prisma.plan.findFirst({ where: { id: planId, productId }, include: { product: true } });
  // A soft-deleted plan can still be renewed by people already on it, but not newly bought.
  if (!plan || (plan.isDeleted && !subscriptionId)) throw new OrderError(404, 'Plan not found');
  if (plan.product.status !== 'ACTIVE') throw new OrderError(409, 'This product is not available for purchase');
  if (plan.price.lte(0)) throw new OrderError(409, 'This plan has no price configured');

  if (subscriptionId) {
    // Renewal: must be the caller's own, on the same plan, and not cancelled.
    const sub = await prisma.subscription.findFirst({ where: { id: subscriptionId, userId } });
    if (!sub) throw new OrderError(404, 'Subscription not found');
    if (sub.planId !== plan.id) throw new OrderError(400, 'Plan does not match this subscription');
    if (!['ACTIVE', 'SUSPENDED', 'EXPIRED'].includes(sub.status)) {
      throw new OrderError(409, 'This subscription cannot be renewed');
    }
  } else {
    const existing = await prisma.subscription.findFirst({
      where: { userId, productId, status: { in: ['ACTIVE', 'TRIAL', 'PENDING'] } },
    });
    if (existing) throw new OrderError(409, 'You already have a subscription to this product');
    // Renewals bypass this: people already on the product keep their service.
    if (!isInStock(plan.product.inventoryCount)) throw new OrderError(409, 'This product is currently out of stock');
    if (!isInStock(plan.inventoryCount)) throw new OrderError(409, 'This plan is currently sold out');
  }

  const amounts = computeOrderAmounts(plan.price.toNumber(), days, gstSettingFrom(plan.product));
  return {
    plan,
    product: plan.product,
    days,
    amountPaise: amounts.totalPaise,
    amounts,
    ...(subscriptionId ? { subscriptionId } : {}),
  };
}
