import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { publicServiceConfig, publicPaymentFields } from '@/lib/serializers';
import { z } from 'zod';

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const subscription = await prisma.subscription.findFirst({
      where: { id: params.id, userId: session.userId as string },
      include: {
        product: true,
        plan: true,
        serviceConfig: publicServiceConfig,
        payments: { orderBy: { createdAt: 'desc' }, select: publicPaymentFields },
      },
    });
    if (!subscription) return apiError('Subscription not found', 404);
    return apiSuccess({ subscription });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[subscriptions/:id GET]', e);
    return apiError('Internal server error', 500);
  }
}

// Customers may only rename their service. Status, plan, dates and the like
// are changed by payments, the billing job and admins — never by this body.
const patchSchema = z.object({ label: z.string().trim().max(100) }).strict();

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const { label } = patchSchema.parse(await req.json());

    const subscription = await prisma.subscription.findFirst({
      where: { id: params.id, userId: session.userId as string },
    });
    if (!subscription) return apiError('Subscription not found', 404);

    const metadata = {
      ...((subscription.metadata as Record<string, unknown> | null) ?? {}),
      label,
    };
    const updated = await prisma.subscription.update({
      where: { id: params.id },
      data: { metadata },
      include: { product: true, plan: true, serviceConfig: publicServiceConfig },
    });

    return apiSuccess({ subscription: updated });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if (e instanceof z.ZodError) return apiError('Only "label" can be changed');
    console.error('[subscriptions/:id PATCH]', e);
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const subscription = await prisma.subscription.findFirst({
      where: { id: params.id, userId: session.userId as string },
    });
    if (!subscription) return apiError('Subscription not found', 404);
    if (subscription.status === 'CANCELLED') return apiSuccess({ subscription });

    // Cancelling stops renewal; the paid-through date is kept as endDate and
    // the billing cron moves the subscription to EXPIRED once it passes.
    const updated = await prisma.subscription.update({
      where: { id: params.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), endDate: subscription.renewsAt },
    });

    return apiSuccess({ subscription: updated });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[subscriptions/:id DELETE]', e);
    return apiError('Internal server error', 500);
  }
}
