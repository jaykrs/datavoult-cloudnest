import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, createProductSchema, getPaginationParams, buildPaginationMeta } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const status = url.searchParams.get('status') || 'ACTIVE';
    const { page, limit, skip } = getPaginationParams(req);

    const where = {
      ...(category && { category: category as 'VPS' | 'DOCKER' | 'EMAIL' }),
      ...(status !== 'all' && { status: status as 'ACTIVE' | 'INACTIVE' | 'COMING_SOON' }),
    };

  const [products, total] = await Promise.all([
  prisma.product.findMany({
    where,
    include: {
      plans: {
        where: {
          isDeleted: false, // This ensures only active plans are returned
        },
      },
    },
    skip,
    take: limit,
    orderBy: { createdAt: 'desc' },
  }),
  prisma.product.count({ where }),
]);

    return apiSuccess({ products, meta: buildPaginationMeta(total, page, limit) });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const data = createProductSchema.parse(body);

    const product = await prisma.product.create({
      data: {
        ...data,
        features: data.features,
        specs: data.specs as object,
      },
      include: { plans: true },
    });

    return apiSuccess({ product }, 201);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    return apiError('Internal server error', 500);
  }
}
