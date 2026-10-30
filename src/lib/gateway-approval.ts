/**
 * Online (Razorpay) payments on a NEW order are recorded as COMPLETED, but the order then waits for
 * an admin to approve the payment before a server can be provisioned — the same gate UPI and bank
 * transfers go through. The state lives in `Payment.gatewayData.approval` (no schema change):
 *   { status: 'PENDING' }                         set when the payment is recorded
 *   { status: 'APPROVED', by, at, note? }         set by an admin
 * Payments without the field (renewals, older rows, manual payments approved at request time) count as approved.
 */
export type PaymentCategory = 'PAYMENT_GATEWAY' | 'UPI' | 'BANK_TRANSFER';

type GatewayData = { gateway?: string; approval?: { status?: string } } | null | undefined;

export const PENDING_APPROVAL = { status: 'PENDING' } as const;

export function isGatewayPayment(gd: unknown): boolean {
  return (gd as GatewayData)?.gateway === 'razorpay';
}

export function isAwaitingApproval(gd: unknown): boolean {
  return (gd as GatewayData)?.approval?.status === 'PENDING';
}

/** Admin-facing category: online gateway vs the two offline methods. */
export function paymentCategory(gd: unknown, method?: string | null): PaymentCategory {
  if (isGatewayPayment(gd) || (gd as GatewayData)?.gateway === undefined) return 'PAYMENT_GATEWAY';
  return method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'UPI';
}

export const CATEGORY_LABELS: Record<PaymentCategory, string> = {
  PAYMENT_GATEWAY: 'Payment gateway', UPI: 'UPI', BANK_TRANSFER: 'Bank transfer',
};
