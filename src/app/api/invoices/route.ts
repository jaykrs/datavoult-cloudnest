import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, getPaginationParams, buildPaginationMeta } from '@/lib/api';
import { requireAuth } from '@/lib/auth';

/** GET /api/invoices — the caller's own invoices, newest first. */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { page, limit, skip } = getPaginationParams(req);
    const where = { userId: session.userId as string };
    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({
        where, skip, take: limit, orderBy: { issuedAt: 'desc' },
        select: { id: true, number: true, paymentId: true, issuedAt: true, description: true, total: true, gstRate: true },
      }),
      prisma.invoice.count({ where }),
    ]);
    const invoices = rows.map((r) => ({ ...r, total: r.total.toNumber(), gstRate: r.gstRate.toNumber() }));
    return apiSuccess({ invoices, meta: buildPaginationMeta(total, page, limit) });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Internal server error', 500);
  }
}
