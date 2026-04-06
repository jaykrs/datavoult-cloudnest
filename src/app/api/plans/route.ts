import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, createPlanSchema } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const data = createPlanSchema.parse(body);

    const product = await prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) return apiError('Product not found', 404);

    const plan = await prisma.plan.create({
      data: {
        productId: data.productId,
        name: data.name,
        description: data.description,
        price: data.price,
        billingCycle: data.billingCycle,
        isPopular: data.isPopular,
        limits: data.limits as object,
      },
    });

    return apiSuccess({ plan }, 201);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    return apiError('Internal server error', 500);
  }
}
