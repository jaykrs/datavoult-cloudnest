import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { isAwaitingApproval } from '@/lib/gateway-approval';
import { notifyGatewayPaymentApproved } from '@/lib/notifications';
import { z } from 'zod';

const bodySchema = z.object({ note: z.string().trim().max(300).optional() });

/**
 * POST /api/admin/payments/:id/approve — the admin confirms an online payment (checked in the
 * Razorpay dashboard). After this the order shows as "awaiting provisioning" and the admin can add server details.
 * Idempotent: approving twice is a 409, not a second email.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const { note } = bodySchema.parse(await req.json().catch(() => ({})));

    const payment = await prisma.payment.findUnique({ where: { id: params.id } });
    if (!payment) return apiError('Payment not found', 404);
    if (!isAwaitingApproval(payment.gatewayData)) return apiError('This payment is not awaiting approval', 409);
    if (payment.status !== 'COMPLETED') return apiError('Only a completed payment can be approved', 409);

    const data = (payment.gatewayData ?? {}) as Record<string, unknown>;
    // Conditional write so two admins clicking at once cannot both win.
    const updated = await prisma.payment.updateMany({
      where: { id: payment.id, gatewayData: { path: '$.approval.status', equals: 'PENDING' } },
      data: {
        gatewayData: {
          ...data,
          approval: { status: 'APPROVED', by: session.userId as string, at: new Date().toISOString(), ...(note ? { note } : {}) },
        },
      },
    });
    if (updated.count === 0) return apiError('This payment was already approved', 409);

    void notifyGatewayPaymentApproved(payment.id);
    return apiSuccess({ approved: true });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[admin/payments approve]', e);
    return apiError('Internal server error', 500);
  }
}
