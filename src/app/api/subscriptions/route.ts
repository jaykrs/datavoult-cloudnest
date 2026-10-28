import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, getPaginationParams, buildPaginationMeta } from '@/lib/api';
import { stripStock } from '@/lib/inventory';
import { requireAuth } from '@/lib/auth';
import { publicServiceConfig, publicPaymentFields } from '@/lib/serializers';
import type { SubscriptionStatus } from '@prisma/client';

const STATUSES: SubscriptionStatus[] = ['PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'TRIAL'];

/**
 * GET /api/subscriptions — the caller's own subscriptions.
 *
 * There is intentionally no POST here. Subscriptions are created only by
 * fulfilling a verified gateway payment (see src/lib/fulfillment.ts); a
 * route that created them directly would hand out service for free.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { page, limit, skip } = getPaginationParams(req);

    const requested = new URL(req.url).searchParams.get('status')?.toUpperCase();
    const status = STATUSES.find((s) => s === requested);

    const where = { userId: session.userId as string, ...(status && { status }) };
    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          product: { include: { plans: { where: { isDeleted: false } } } },
          plan: true,
          serviceConfig: publicServiceConfig,
          payments: { orderBy: { createdAt: 'desc' }, take: 1, select: publicPaymentFields },
        },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      prisma.subscription.count({ where }),
    ]);
    return apiSuccess(stripStock({ subscriptions, meta: buildPaginationMeta(total, page, limit) }));
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[subscriptions GET]', e);
    return apiError('Internal server error', 500);
  }
}
