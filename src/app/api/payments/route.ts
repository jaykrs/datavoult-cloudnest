import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, getPaginationParams, buildPaginationMeta } from '@/lib/api';
import { stripStock } from '@/lib/inventory';
import { requireAuth } from '@/lib/auth';
import { publicPaymentFields } from '@/lib/serializers';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { page, limit, skip } = getPaginationParams(req);

    const where = { userId: session.userId as string };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        select: {
          ...publicPaymentFields,
          subscription: { include: { product: true, plan: true } },
          invoice: { select: { number: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    return apiSuccess(stripStock({ payments, meta: buildPaginationMeta(total, page, limit) }));
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[payments GET]', e);
    return apiError('Internal server error', 500);
  }
}
