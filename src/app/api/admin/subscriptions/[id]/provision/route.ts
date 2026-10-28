import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { decryptJson, encryptJson } from '@/lib/crypto';
import { serverDetailsSchema, mergeCredentials, authType, sshPortOf, type StoredCredentials } from '@/lib/server-details';
import { notifyServerDetails } from '@/lib/notifications';
import { z } from 'zod';

interface Params { params: { id: string } }

function authError(e: unknown) {
  if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
  if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
  return null;
}

function readStored(creds: unknown): StoredCredentials | null {
  const enc = (creds as { enc?: string } | null)?.enc;
  if (!enc) return null;
  try { return decryptJson<StoredCredentials>(enc); } catch { return null; }
}

/**
 * GET — the server details recorded so far, to prefill the admin form.
 * Secrets are never returned: only the username and which kind of secret is stored.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const sub = await prisma.subscription.findUnique({ where: { id: params.id }, include: { serviceConfig: true } });
    if (!sub) return apiError('Subscription not found', 404);
    const cfg = sub.serviceConfig;
    const creds = readStored(cfg?.credentials);
    return apiSuccess({
      status: sub.status,
      details: cfg ? {
        hostname: cfg.hostname ?? '', ipAddress: cfg.ipAddress ?? '', domain: cfg.domain ?? '', region: cfg.region ?? '',
        os: ((cfg.config ?? {}) as { os?: string }).os ?? '', sshPort: sshPortOf(cfg.config),
        username: creds?.username ?? '', authType: authType(creds), hostKeySha256: cfg.hostKeySha256 ?? '',
      } : null,
    });
  } catch (e) {
    return authError(e) || (console.error('[admin/provision GET]', e), apiError('Internal server error', 500));
  }
}

/**
 * POST /api/admin/subscriptions/[id]/provision
 *
 * Records the server details (IP, username, password and/or private key) of a service an
 * admin has set up out of band. Credentials are stored encrypted. For a PENDING order this
 * activates the subscription; for an ACTIVE/SUSPENDED one it updates (or rotates) the
 * details. Unless `notifyCustomer` is false, the customer is emailed the access details.
 * Blank password/key on an update keep the stored secret.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const data = serverDetailsSchema.parse(await req.json());

    const sub = await prisma.subscription.findUnique({ where: { id: params.id }, include: { serviceConfig: true } });
    if (!sub) return apiError('Subscription not found', 404);
    if (!['PENDING', 'ACTIVE', 'SUSPENDED'].includes(sub.status)) {
      return apiError(`Server details cannot be changed for a ${sub.status.toLowerCase()} subscription`, 409);
    }

    const existing = readStored(sub.serviceConfig?.credentials);
    const merged = mergeCredentials(data.credentials, existing);
    if (merged === 'MISSING_SECRET') return apiError('Provide a password or a private key for this username', 400);
    const credentials = merged ? { enc: encryptJson(merged) } : undefined;

    const oldConfig = (sub.serviceConfig?.config ?? {}) as Record<string, unknown>;
    const config = { ...oldConfig, sshPort: data.sshPort, ...(data.os ? { os: data.os } : {}) };
    const fields = {
      hostname: data.hostname,
      ipAddress: data.ipAddress ?? null,
      domain: data.domain ?? null,
      region: data.region,
      config: config as object,
      ...(credentials ? { credentials } : {}),
      // A new host key replaces the pinned one; leaving it blank keeps what we have.
      ...(data.hostKeySha256 ? { hostKeySha256: data.hostKeySha256.toLowerCase() } : {}),
    };

    await prisma.$transaction([
      prisma.serviceConfig.upsert({
        where: { subscriptionId: sub.id },
        create: { subscriptionId: sub.id, ...fields },
        update: fields,
      }),
      ...(sub.status === 'PENDING' ? [prisma.subscription.update({ where: { id: sub.id }, data: { status: 'ACTIVE' } })] : []),
      prisma.provisioningJob.upsert({
        where: { subscriptionId: sub.id },
        create: { subscriptionId: sub.id, status: 'DONE' },
        update: { status: 'DONE', lastError: null },
      }),
    ]);

    const emailed = data.notifyCustomer ? await notifyServerDetails(sub.id) : false;
    return apiSuccess({ provisioned: true, emailed });
  } catch (e) {
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    if ((e as Error).message.includes('CREDENTIALS_ENCRYPTION_KEY') || (e as Error).message.includes('ENCRYPTION_KEY')) {
      return apiError('Server credential encryption is not configured (CREDENTIALS_ENCRYPTION_KEY)', 503);
    }
    return authError(e) || (console.error('[admin/provision]', e), apiError('Internal server error', 500));
  }
}
