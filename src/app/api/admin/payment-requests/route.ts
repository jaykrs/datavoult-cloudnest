import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, getPaginationParams, buildPaginationMeta } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';

const STATUSES = ['AWAITING_PAYMENT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
type Status = (typeof STATUSES)[number];

/** GET /api/admin/payment-requests — offline payments to verify (newest first). */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const search = (url.searchParams.get('search') || '').trim();
    const statusParam = url.searchParams.get('status') as Status | null;
    const { page, limit, skip } = getPaginationParams(req);

    const where = {
      ...(statusParam && STATUSES.includes(statusParam) && { status: statusParam }),
      ...(search && {
        OR: [
          { reference: { contains: search } },
          { transactionRef: { contains: search } },
          { user: { is: { email: { contains: search } } } },
          { user: { is: { name: { contains: search } } } },
        ],
      }),
    };

    const [rows, total, toVerify] = await Promise.all([
      prisma.paymentRequest.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, name: true } },
          plan: { select: { id: true, name: true, price: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.paymentRequest.count({ where }),
      prisma.paymentRequest.count({ where: { status: 'SUBMITTED' } }),
    ]);

    // Flag a bank reference that was entered on more than one request — a classic reuse scam.
    const refs = rows.map((r) => r.transactionRef).filter((x): x is string => Boolean(x));
    const sameRef = refs.length
      ? await prisma.paymentRequest.findMany({
          where: { transactionRef: { in: refs } },
          select: { id: true, transactionRef: true, reference: true },
        })
      : [];

    const requests = rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      status: r.status,
      method: r.method,
      days: r.days,
      amount: r.amount.toNumber(),
      pricePerDay: r.plan.price.toNumber(),
      renewal: Boolean(r.subscriptionId),
      transactionRef: r.transactionRef,
      payerDetails: r.payerDetails,
      submittedAt: r.submittedAt,
      expiresAt: r.expiresAt,
      reviewedAt: r.reviewedAt,
      reviewNote: r.reviewNote,
      resultSubscriptionId: r.resultSubscriptionId,
      createdAt: r.createdAt,
      user: r.user,
      product: r.product,
      plan: { id: r.plan.id, name: r.plan.name },
      sameReferenceAs: r.transactionRef
        ? sameRef.filter((o) => o.transactionRef === r.transactionRef && o.id !== r.id).map((o) => o.reference)
        : [],
    }));

    return apiSuccess({ requests, toVerify, meta: buildPaginationMeta(total, page, limit) });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    console.error('[admin/payment-requests]', e);
    return apiError('Internal server error', 500);
  }
}
