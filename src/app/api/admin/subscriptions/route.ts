import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, getPaginationParams, buildPaginationMeta } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import type { SubscriptionStatus } from '@prisma/client';

const STATUSES: SubscriptionStatus[] = ['PENDING', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'TRIAL'];

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const requested = url.searchParams.get('status')?.toUpperCase();
    const status = STATUSES.find((s) => s === requested);
    const { page, limit, skip } = getPaginationParams(req);

    const where = status ? { status } : {};

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, name: true, category: true } },
          plan: { select: { id: true, name: true, price: true } },
          provisioningJob: { select: { status: true, attempts: true, lastError: true, updatedAt: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.subscription.count({ where }),
    ]);

    return apiSuccess({ subscriptions, meta: buildPaginationMeta(total, page, limit) });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    console.error('[admin/subscriptions GET]', e);
    return apiError('Internal server error', 500);
  }
}
