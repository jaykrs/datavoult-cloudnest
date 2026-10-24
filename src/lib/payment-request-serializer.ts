import { buildInstructions, type ManualMethod, OPEN_STATUSES } from './manual-payments';

interface RequestRow {
  id: string;
  reference: string;
  status: string;
  method: string;
  days: number;
  amount: { toNumber(): number };
  subscriptionId: string | null;
  resultSubscriptionId: string | null;
  transactionRef: string | null;
  payerDetails: string | null;
  submittedAt: Date | null;
  expiresAt: Date;
  reviewNote: string | null;
  createdAt: Date;
  product?: { id: string; name: string; slug: string };
  plan?: { id: string; name: string; price: { toNumber(): number } };
}

/**
 * What a customer may see about their own request. Bank/UPI details are only
 * included while the request is still open; admin-only fields (reviewer id)
 * are never included.
 */
export function serializeRequestForUser(r: RequestRow, now = new Date()) {
  const open = (OPEN_STATUSES as readonly string[]).includes(r.status);
  const expired = r.status === 'AWAITING_PAYMENT' && r.expiresAt < now;
  const amount = r.amount.toNumber();
  return {
    id: r.id,
    reference: r.reference,
    status: expired ? 'EXPIRED' : r.status,
    method: r.method,
    days: r.days,
    amount,
    renewal: Boolean(r.subscriptionId),
    subscriptionId: r.resultSubscriptionId,
    transactionRef: r.transactionRef,
    payerDetails: r.payerDetails,
    submittedAt: r.submittedAt,
    expiresAt: r.expiresAt,
    reviewNote: r.status === 'REJECTED' ? r.reviewNote : null,
    createdAt: r.createdAt,
    product: r.product && { id: r.product.id, name: r.product.name, slug: r.product.slug },
    plan: r.plan && { id: r.plan.id, name: r.plan.name, pricePerDay: r.plan.price.toNumber() },
    instructions: open && !expired ? buildInstructions(r.method as ManualMethod, amount, r.reference) : null,
  };
}
