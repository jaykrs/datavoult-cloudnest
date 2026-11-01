import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, getPaginationParams, buildPaginationMeta } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { paymentCategory, isAwaitingApproval } from '@/lib/gateway-approval';

export const dynamic = 'force-dynamic';

const STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];

/** GET /api/admin/payments?status=&approval=pending&page=&limit= — all payments with category and approval state. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { page, limit, skip } = getPaginationParams(req);
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const awaitingApproval = url.searchParams.get('approval') === 'pending';

    const where = {
      ...(status && STATUSES.includes(status) ? { status: status as 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' } : {}),
      ...(awaitingApproval ? { gatewayData: { path: '$.approval.status', equals: 'PENDING' } } : {}),
    };

    const [rows, total, pendingApproval] = await Promise.all([
      prisma.payment.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          subscription: { include: { product: { select: { name: true } }, plan: { select: { name: true } } } },
          invoice: { select: { number: true } },
        },
      }),
      prisma.payment.count({ where }),
      prisma.payment.count({ where: { gatewayData: { path: '$.approval.status', equals: 'PENDING' } } }),
    ]);

    const payments = rows.map((p) => {
      const { gatewayData, ...rest } = p;
      return {
        ...rest,
        category: paymentCategory(gatewayData, p.method),
        awaitingApproval: isAwaitingApproval(gatewayData),
        gatewayRef: (gatewayData as { paymentId?: string } | null)?.paymentId ?? null,
      };
    });
    return apiSuccess({ payments, pendingApproval, meta: buildPaginationMeta(total, page, limit) });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    console.error('[admin/payments GET]', e);
    return apiError('Internal server error', 500);
  }
}
