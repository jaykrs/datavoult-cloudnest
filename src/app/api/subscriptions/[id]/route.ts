import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAuth } from '@/lib/auth';

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const subscription = await prisma.subscription.findFirst({
      where: { id: params.id, userId: session.userId as string},
      include: { product: true, plan: true, serviceConfig: true, payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!subscription) return apiError('Subscription not found', 404);
    return apiSuccess({ subscription });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Internal server error', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const subscription = await prisma.subscription.findFirst({
      where: { id: params.id, userId: session.userId as string},
    });
    if (!subscription) return apiError('Subscription not found', 404);

    const updated = await prisma.subscription.update({
      where: { id: params.id },
      data: body,
      include: { product: true, plan: true, serviceConfig: true },
    });

    return apiSuccess({ subscription: updated });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const subscription = await prisma.subscription.findFirst({
      where: { id: params.id, userId: session.userId as string},
    });
    if (!subscription) return apiError('Subscription not found', 404);

    const updated = await prisma.subscription.update({
      where: { id: params.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    return apiSuccess({ subscription: updated });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Internal server error', 500);
  }
}
