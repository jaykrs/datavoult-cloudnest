import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, getPaginationParams, buildPaginationMeta } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';

const STATUSES = ['NEW', 'READ', 'RESOLVED'] as const;
type Status = (typeof STATUSES)[number];

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const search = url.searchParams.get('search') || '';
    const statusParam = url.searchParams.get('status') as Status | null;
    const { page, limit, skip } = getPaginationParams(req);

    const where = {
      ...(statusParam && STATUSES.includes(statusParam) && { status: statusParam }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { subject: { contains: search } },
          { message: { contains: search } },
        ],
      }),
    };

    const [messages, total, newCount] = await Promise.all([
      prisma.contactMessage.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.contactMessage.count({ where }),
      prisma.contactMessage.count({ where: { status: 'NEW' } }),
    ]);

    return apiSuccess({ messages, newCount, meta: buildPaginationMeta(total, page, limit) });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    return apiError('Internal server error', 500);
  }
}
