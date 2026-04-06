import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { name, description, price, billingCycle, isPopular, limits } = body;

    const plan = await prisma.plan.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(billingCycle !== undefined && { billingCycle }),
        ...(isPopular !== undefined && { isPopular }),
        ...(limits !== undefined && { limits }),
      },
    });

    return apiSuccess({ plan });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    await prisma.plan.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    return apiError('Internal server error', 500);
  }
}
