import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, getPaginationParams, buildPaginationMeta } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { page, limit, skip } = getPaginationParams(req);
    const where = { userId: session.userId as string};
    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        include: {
          product: { include: { plans: true } },
          plan: true,
          serviceConfig: true,
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      prisma.subscription.count({ where }),
    ]);
    return apiSuccess({ subscriptions, meta: buildPaginationMeta(total, page, limit) });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Internal server error', 500);
  }
}

const subscribeSchema = z.object({
  productId: z.string(),
  planId: z.string(),
  paymentMethod: z.enum(['CARD', 'PAYPAL', 'CRYPTO', 'BANK_TRANSFER']).optional().default('CARD'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { productId, planId, paymentMethod } = subscribeSchema.parse(body);

    const plan = await prisma.plan.findFirst({ where: { id: planId, productId } });
    if (!plan) return apiError('Plan not found', 404);

    // Check existing active subscription for this product
    const existing = await prisma.subscription.findFirst({
      where: { userId: session.userId as string, productId, status: { in: ['ACTIVE', 'TRIAL'] } },
    });
    if (existing) return apiError('You already have an active subscription to this product', 409);

    const now = new Date();
    const renewsAt = new Date(now);
    renewsAt.setMonth(
      renewsAt.getMonth() + (plan.billingCycle === 'ANNUAL' ? 12 : plan.billingCycle === 'QUARTERLY' ? 3 : 1)
    );

    // Generate realistic service config values
    const randomHex = () => Math.random().toString(36).substr(2, 8);
    const randomIp = () => `${Math.floor(Math.random() * 200) + 50}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;
    const regions = ['us-east-1', 'us-west-1', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'];
    const region = regions[Math.floor(Math.random() * regions.length)];

    const product = await prisma.product.findUnique({ where: { id: productId } });
    const isEmail = product?.category === 'EMAIL';

    const subscription = await prisma.subscription.create({
      data: {
        userId: session.userId as string,
        productId,
        planId,
        renewsAt,
        serviceConfig: {
          create: {
            hostname: isEmail
              ? `mail-${randomHex()}.datavoult.io`
              : `srv-${randomHex()}.datavoult.io`,
            ipAddress: isEmail ? null : randomIp(),
            domain: isEmail ? null : undefined,
            region,
            config: isEmail
              ? { imapServer: 'imap.datavoult.io', smtpServer: 'smtp.datavoult.io' }
              : { os: 'Ubuntu 22.04 LTS' },
          },
        },
      },
      include: { product: true, plan: true, serviceConfig: true },
    });

    // Record payment
    await prisma.payment.create({
      data: {
        userId: session.userId as string,
        subscriptionId: subscription.id,
        amount: plan.price,
        status: 'COMPLETED',
        method: paymentMethod,
        paidAt: now,
        gatewayId: `demo_${randomHex()}`,
      },
    });

    return apiSuccess({ subscription }, 201);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    return apiError('Internal server error', 500);
  }
}
