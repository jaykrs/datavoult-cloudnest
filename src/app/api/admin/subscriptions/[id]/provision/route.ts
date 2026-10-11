import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { encryptJson } from '@/lib/crypto';
import { z } from 'zod';

interface Params { params: { id: string } }

const bodySchema = z.object({
  hostname: z.string().trim().min(1).max(253),
  ipAddress: z.string().trim().max(45).optional(),
  domain: z.string().trim().max(253).optional(),
  region: z.string().trim().min(1).max(100),
  config: z.record(z.unknown()).optional(),
  /** Needed for CloudOps (install/deploy) on VPS products. Stored encrypted. */
  credentials: z
    .object({
      username: z.string().min(1).max(64),
      password: z.string().min(1).max(256).optional(),
      privateKey: z.string().min(1).max(16_384).optional(),
    })
    .refine((c) => c.password || c.privateKey, 'Provide a password or a privateKey')
    .optional(),
  /** Hex SHA-256 of the server's SSH host key (ssh-keygen -lf ... | or `ssh-keyscan`); pinned for all future connections. */
  hostKeySha256: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Expected 64 hex characters').optional(),
});

/**
 * POST /api/admin/subscriptions/[id]/provision
 *
 * The manual-provisioning step: an admin has created the server/mailbox out
 * of band and records its details here. This stores them (credentials
 * encrypted), marks the provisioning job DONE and activates the subscription.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const data = bodySchema.parse(await req.json());

    const sub = await prisma.subscription.findUnique({ where: { id: params.id } });
    if (!sub) return apiError('Subscription not found', 404);
    if (sub.status !== 'PENDING') {
      return apiError(`Only PENDING subscriptions can be provisioned (this one is ${sub.status})`, 409);
    }

    const credentials = data.credentials ? { enc: encryptJson(data.credentials) } : undefined;
    const fields = {
      hostname: data.hostname,
      ipAddress: data.ipAddress,
      domain: data.domain,
      region: data.region,
      config: (data.config ?? {}) as object,
      credentials,
      hostKeySha256: data.hostKeySha256?.toLowerCase(),
    };

    await prisma.$transaction([
      prisma.serviceConfig.upsert({
        where: { subscriptionId: sub.id },
        create: { subscriptionId: sub.id, ...fields },
        update: fields,
      }),
      prisma.subscription.update({ where: { id: sub.id }, data: { status: 'ACTIVE' } }),
      prisma.provisioningJob.upsert({
        where: { subscriptionId: sub.id },
        create: { subscriptionId: sub.id, status: 'DONE' },
        update: { status: 'DONE', lastError: null },
      }),
    ]);

    return apiSuccess({ provisioned: true });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    if ((e as Error).message.includes('CREDENTIALS_ENCRYPTION_KEY')) {
      return apiError('Server credential encryption is not configured (CREDENTIALS_ENCRYPTION_KEY)', 503);
    }
    console.error('[admin/provision]', e);
    return apiError('Internal server error', 500);
  }
}
