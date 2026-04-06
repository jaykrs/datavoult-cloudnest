import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { z } from 'zod';

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const product = await prisma.product.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }] },
      include: { plans: true },
    });

    if (!product) return apiError('Product not found', 404);
    return apiSuccess({ product });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const body = await req.json();

    const product = await prisma.product.update({
      where: { id: params.id },
      data: body,
      include: { plans: true },
    });

    return apiSuccess({ product });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    await prisma.product.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    return apiError('Internal server error', 500);
  }
}
