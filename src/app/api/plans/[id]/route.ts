import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, updatePlanSchema } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { z } from 'zod';

interface Params { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { name, description, price, isPopular, limits } = updatePlanSchema.parse(await req.json());

    const plan = await prisma.plan.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(isPopular !== undefined && { isPopular }),
        ...(limits !== undefined && { limits: limits as object }),
      },
    });

    return apiSuccess({ plan });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[plans/:id PATCH]', e);
    return apiError('Internal server error', 500);
  }
}

/** Soft delete — subscriptions that already use the plan keep working. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    await prisma.plan.update({ where: { id: params.id }, data: { isDeleted: true, isPopular: false } });
    return apiSuccess({ deleted: true });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    console.error('[plans/:id DELETE]', e);
    return apiError('Internal server error', 500);
  }
}
