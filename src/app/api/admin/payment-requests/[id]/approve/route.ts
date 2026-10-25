import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, approveManualPaymentSchema } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { fulfillPayment, FulfillmentError } from '@/lib/fulfillment';
import { receivedMatches, OPEN_STATUSES } from '@/lib/manual-payments';
import { rupeesToPaise } from '@/lib/pricing';
import { notifyManualPaymentReviewed } from '@/lib/notifications';
import { z } from 'zod';

/**
 * POST /api/admin/payment-requests/:id/approve
 *
 * The admin has checked the bank/UPI statement. They must type the amount they
 * actually saw credited; it has to equal the ordered amount to the paisa, so a
 * short payment can't be approved by mistake. Approval runs the same fulfilment
 * as an online payment (subscription, stock, provisioning, emails) and is
 * idempotent: the payment is keyed on the request id.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const { receivedAmount, note } = approveManualPaymentSchema.parse(await req.json());

    const request = await prisma.paymentRequest.findUnique({ where: { id: params.id } });
    if (!request) return apiError('Payment request not found', 404);
    if (request.status === 'APPROVED') return apiError('This payment was already approved', 409);
    if (!(OPEN_STATUSES as readonly string[]).includes(request.status)) {
      return apiError(`This request is ${request.status.toLowerCase()} and can't be approved`, 409);
    }

    const expected = request.amount.toNumber();
    if (!receivedMatches(receivedAmount, expected)) {
      return apiError(
        `Amount mismatch: the order is for ₹${expected.toFixed(2)} but you entered ₹${receivedAmount.toFixed(2)}. ` +
          'Reject it (asking for the balance) or fix the amount.',
        422,
      );
    }

    const result = await fulfillPayment({
      orderId: request.reference,
      paymentId: `manual:${request.id}`,
      amountPaise: rupeesToPaise(expected),
      method: request.method,
      gateway: 'manual',
      gatewayExtra: {
        reference: request.reference,
        transactionRef: request.transactionRef,
        approvedBy: session.userId,
        ...(note ? { note } : {}),
      },
      notes: {
        userId: request.userId,
        productId: request.productId,
        planId: request.planId,
        days: request.days,
        ...(request.subscriptionId ? { subscriptionId: request.subscriptionId } : {}),
      },
    });

    // Conditional update: two admins approving at once end up with one winner.
    const marked = await prisma.paymentRequest.updateMany({
      where: { id: request.id, status: { in: [...OPEN_STATUSES] } },
      data: {
        status: 'APPROVED',
        reviewedById: session.userId as string,
        reviewedAt: new Date(),
        reviewNote: note || null,
        resultSubscriptionId: result.subscriptionId,
      },
    });

    if (marked.count === 0) {
      // Someone rejected/cancelled it between our read and this write. The payment
      // record exists (idempotent), so surface it rather than silently disagreeing.
      console.error('[admin/payment-requests approve] request changed during approval', request.id);
      return apiError('This request was changed by someone else while you were approving it. Refresh and check the subscription.', 409);
    }

    await notifyManualPaymentReviewed(request.id, true);
    return apiSuccess({ approved: true, outcome: result.outcome, subscriptionId: result.subscriptionId });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    if (e instanceof FulfillmentError) {
      const hint: Record<string, string> = {
        OUT_OF_STOCK: 'The product sold out since the order was placed. Reject this request and refund the customer.',
        AMOUNT_MISMATCH: "The plan's price changed after the order was placed. Reject it and ask the customer to reorder.",
        PLAN_NOT_FOUND: 'The plan no longer exists. Reject it and refund the customer.',
        SUBSCRIPTION_NOT_FOUND: 'The subscription to renew no longer exists. Reject it and refund the customer.',
        NOT_RENEWABLE: 'This subscription can no longer be renewed. Reject it and refund the customer.',
      };
      return apiError(hint[e.code] || e.message, 409);
    }
    console.error('[admin/payment-requests approve]', e);
    return apiError('Could not approve the payment', 500);
  }
}
