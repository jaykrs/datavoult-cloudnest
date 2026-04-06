import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  try {
    await requireAdmin();

    const [
      totalUsers,
      totalRevenue,
      activeSubscriptions,
      totalProducts,
      recentPayments,
      subsByCategory,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.payment.aggregate({ where: { status: 'COMPLETED' }, _sum: { amount: true } }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.product.count(),
      prisma.payment.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } }, subscription: { include: { product: true, plan: true } } },
      }),
      prisma.subscription.groupBy({
        by: ['productId'],
        _count: { id: true },
        where: { status: 'ACTIVE' },
      }),
    ]);

    // Revenue by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyPayments = await prisma.payment.findMany({
      where: { status: 'COMPLETED', createdAt: { gte: sixMonthsAgo } },
      select: { amount: true, createdAt: true },
    });

    const revenueByMonth: Record<string, number> = {};
    monthlyPayments.forEach((p) => {
      const key = p.createdAt.toISOString().slice(0, 7);
      revenueByMonth[key] = (revenueByMonth[key] || 0) + Number(p.amount);
    });

    // Subscriptions by category
    const productIds = subsByCategory.map((s) => s.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, category: true },
    });
    const productCategoryMap = Object.fromEntries(products.map((p) => [p.id, p.category]));

    const subscriptionsByCategory = Object.entries(
      subsByCategory.reduce((acc, s) => {
        const cat = productCategoryMap[s.productId] || 'UNKNOWN';
        acc[cat] = (acc[cat] || 0) + s._count.id;
        return acc;
      }, {} as Record<string, number>)
    ).map(([category, count]) => ({ category, count }));

    return apiSuccess({
      totalUsers,
      totalRevenue: Number(totalRevenue._sum.amount || 0),
      activeSubscriptions,
      totalProducts,
      recentPayments,
      subscriptionsByCategory,
      revenueByMonth: Object.entries(revenueByMonth).map(([month, revenue]) => ({ month, revenue })),
    });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    return apiError('Internal server error', 500);
  }
}
