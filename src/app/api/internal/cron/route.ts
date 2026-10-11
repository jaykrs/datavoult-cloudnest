import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { safeEqual } from '@/lib/crypto';
import { processProvisioningQueue } from '@/lib/provisioning';

const DAY = 24 * 60 * 60 * 1000;
const GRACE_DAYS = Number(process.env.RENEWAL_GRACE_DAYS ?? 3);
const EXPIRE_AFTER_DAYS = Number(process.env.SUSPENDED_EXPIRE_DAYS ?? 7);

/**
 * POST /api/internal/cron   (Authorization: Bearer $CRON_SECRET)
 *
 * Call this every 5–15 minutes from a scheduler (system cron, Vercel Cron,
 * GitHub Actions, ...). It:
 *   1. suspends ACTIVE subscriptions whose renewal date passed more than
 *      RENEWAL_GRACE_DAYS ago without a payment;
 *   2. expires SUSPENDED ones after a further SUSPENDED_EXPIRE_DAYS;
 *   3. ends cancelled subscriptions once their paid period is over;
 *   4. runs due provisioning jobs (no-op for the manual provider).
 * Every step is idempotent, so overlapping or repeated runs are harmless.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    return Response.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  }
  const auth = req.headers.get('authorization') || '';
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = Date.now();

    const suspended = await prisma.subscription.updateMany({
      where: { status: 'ACTIVE', renewsAt: { lt: new Date(now - GRACE_DAYS * DAY) } },
      data: { status: 'SUSPENDED' },
    });

    const expired = await prisma.subscription.updateMany({
      where: {
        status: 'SUSPENDED',
        renewsAt: { lt: new Date(now - (GRACE_DAYS + EXPIRE_AFTER_DAYS) * DAY) },
      },
      data: { status: 'EXPIRED', endDate: new Date(now) },
    });

    // Cancelled subscriptions keep access until the paid period ends, then become EXPIRED.
    const lapsedCancellations = await prisma.subscription.updateMany({
      where: { status: 'CANCELLED', endDate: { lt: new Date(now) }, renewsAt: { not: null } },
      data: { status: 'EXPIRED' },
    });

    const provisioning = await processProvisioningQueue();

    return Response.json({
      ok: true,
      suspended: suspended.count,
      expired: expired.count,
      cancellationsEnded: lapsedCancellations.count,
      provisioning,
    });
  } catch (e) {
    console.error('[cron]', e);
    return Response.json({ error: 'Cron run failed' }, { status: 500 });
  }
}
