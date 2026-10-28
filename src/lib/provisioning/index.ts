import { prisma } from '../prisma';
import { encryptJson } from '../crypto';
import { manualProvider, mockProvider } from './providers';
import { notifyServerDetails } from '../notifications';
import type { ProvisioningProvider } from './types';

export const MAX_PROVISIONING_ATTEMPTS = 3;
export const DEFAULT_REGION = process.env.DEFAULT_REGION || 'ap-south-1 (Mumbai)';

const PROVIDERS: Record<string, ProvisioningProvider> = {
  manual: manualProvider,
  mock: mockProvider,
};

export function getProvider(): ProvisioningProvider {
  const name = (process.env.PROVISIONING_PROVIDER || 'manual').toLowerCase();
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`Unknown PROVISIONING_PROVIDER "${name}". Available: ${Object.keys(PROVIDERS).join(', ')}`);
  }
  return provider;
}

export type ProvisionOutcome = 'done' | 'failed' | 'manual' | 'skipped';

/**
 * Run the provisioning job for a subscription.
 *
 * The job row is claimed with a conditional update, so concurrent callers
 * (the payment handler, the webhook, the cron endpoint) cannot provision the
 * same subscription twice. On success the subscription flips PENDING → ACTIVE
 * in the same transaction that stores the service details.
 */
export async function runProvisioning(subscriptionId: string): Promise<ProvisionOutcome> {
  const provider = getProvider();
  if (provider.manual) return 'manual';

  const claimed = await prisma.provisioningJob.updateMany({
    where: {
      subscriptionId,
      status: { in: ['QUEUED', 'FAILED'] },
      attempts: { lt: MAX_PROVISIONING_ATTEMPTS },
    },
    data: { status: 'RUNNING', attempts: { increment: 1 }, lastError: null },
  });
  if (claimed.count === 0) return 'skipped';

  try {
    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: { select: { email: true } }, product: true, plan: true, serviceConfig: true },
    });
    if (!sub) throw new Error('Subscription not found');

    const result = await provider.provision({
      subscriptionId,
      category: sub.product.category,
      planName: sub.plan.name,
      planLimits: (sub.plan.limits ?? {}) as Record<string, unknown>,
      userEmail: sub.user.email,
      region: sub.serviceConfig?.region || DEFAULT_REGION,
    });
    if (!result) throw new Error(`Provider "${provider.name}" returned no service`);

    // Encrypt before opening the transaction so a missing key fails the job cleanly.
    const credentials = result.credentials ? { enc: encryptJson(result.credentials) } : undefined;

    await prisma.$transaction([
      prisma.serviceConfig.upsert({
        where: { subscriptionId },
        create: {
          subscriptionId,
          hostname: result.hostname,
          ipAddress: result.ipAddress,
          domain: result.domain,
          region: result.region,
          config: result.config as object,
          credentials,
          hostKeySha256: result.hostKeySha256,
        },
        update: {
          hostname: result.hostname,
          ipAddress: result.ipAddress,
          domain: result.domain,
          region: result.region,
          config: result.config as object,
          credentials,
          hostKeySha256: result.hostKeySha256,
        },
      }),
      // Only activate a still-pending subscription; never resurrect a cancelled one.
      prisma.subscription.updateMany({
        where: { id: subscriptionId, status: 'PENDING' },
        data: { status: 'ACTIVE' },
      }),
      prisma.provisioningJob.update({ where: { subscriptionId }, data: { status: 'DONE' } }),
    ]);
    // Automated providers hand over credentials too: tell the customer (never throws).
    if (credentials) await notifyServerDetails(subscriptionId);
    return 'done';
  } catch (e) {
    console.error('[provisioning]', subscriptionId, e);
    await prisma.provisioningJob.update({
      where: { subscriptionId },
      data: { status: 'FAILED', lastError: (e as Error).message.slice(0, 2000) },
    });
    return 'failed';
  }
}

/** Reset jobs stuck in RUNNING (process died mid-run), then run what is due. */
export async function processProvisioningQueue(limit = 10): Promise<{ ran: number; done: number; failed: number }> {
  if (getProvider().manual) return { ran: 0, done: 0, failed: 0 };

  const staleBefore = new Date(Date.now() - 15 * 60_000);
  await prisma.provisioningJob.updateMany({
    where: { status: 'RUNNING', updatedAt: { lt: staleBefore } },
    data: { status: 'FAILED', lastError: 'Timed out while running' },
  });

  const jobs = await prisma.provisioningJob.findMany({
    where: { status: { in: ['QUEUED', 'FAILED'] }, attempts: { lt: MAX_PROVISIONING_ATTEMPTS } },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: { subscriptionId: true },
  });

  let done = 0;
  let failed = 0;
  for (const job of jobs) {
    const outcome = await runProvisioning(job.subscriptionId);
    if (outcome === 'done') done++;
    if (outcome === 'failed') failed++;
  }
  return { ran: jobs.length, done, failed };
}
