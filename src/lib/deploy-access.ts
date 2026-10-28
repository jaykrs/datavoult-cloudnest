import { prisma } from './prisma';
import { decryptJson } from './crypto';
import { SshError, type SshTarget } from './ssh';
import { apiError } from './api';
import { sshPortOf } from './server-details';

/** An error that maps directly to an HTTP response. */
export class AccessError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type ServiceCategory = 'VPS' | 'DOCKER' | 'EMAIL';

export interface ServerAccess {
  target: SshTarget;
  serviceConfigId: string;
  category: ServiceCategory;
  planLimits: Record<string, unknown>;
}

/**
 * Resolve the SSH target for one of the CALLER's subscriptions.
 *
 * Credentials never come from the request. They are looked up server-side by
 * subscription id, after checking that the subscription belongs to the
 * caller, is active, and is a VPS.
 */
export async function loadServerAccess(subscriptionId: string, userId: string, categories: ServiceCategory[] = ['VPS']): Promise<ServerAccess> {
  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, userId },
    include: { product: { select: { category: true } }, plan: { select: { limits: true } }, serviceConfig: true },
  });

  if (!sub) throw new AccessError(404, 'Service not found');
  if (!categories.includes(sub.product.category as ServiceCategory)) {
    throw new AccessError(400, categories.length === 1 && categories[0] === 'VPS'
      ? 'CloudOps is only available for VPS services'
      : 'App deployment is only available for VPS and Docker hosting services');
  }
  if (sub.status !== 'ACTIVE') throw new AccessError(409, `This service is ${sub.status.toLowerCase()}`);

  const cfg = sub.serviceConfig;
  const stored = cfg?.credentials as { enc?: string } | null | undefined;
  if (!cfg?.ipAddress || !stored?.enc) {
    throw new AccessError(409, 'Your server is not ready for remote management yet');
  }

  let creds: { username: string; password?: string; privateKey?: string };
  try {
    creds = decryptJson(stored.enc);
  } catch (e) {
    console.error('[deploy-access] cannot decrypt credentials for', subscriptionId, (e as Error).message);
    throw new AccessError(503, 'Remote management is temporarily unavailable');
  }

  return {
    serviceConfigId: cfg.id,
    category: sub.product.category as ServiceCategory,
    planLimits: (sub.plan.limits ?? {}) as Record<string, unknown>,
    target: {
      host: cfg.ipAddress,
      port: sshPortOf(cfg.config),
      username: creds.username,
      password: creds.password,
      privateKey: creds.privateKey,
      hostKeySha256: cfg.hostKeySha256,
    },
  };
}

/** Trust-on-first-use: remember the host key we saw, only if none is pinned yet. */
export async function pinHostKeyIfUnset(serviceConfigId: string, observed: string): Promise<void> {
  if (!observed) return;
  await prisma.serviceConfig.updateMany({
    where: { id: serviceConfigId, hostKeySha256: null },
    data: { hostKeySha256: observed },
  });
}

/** Turn any failure from the access/SSH path into the right HTTP response. */
export function accessErrorResponse(e: unknown) {
  if (e instanceof AccessError) return apiError(e.message, e.status);
  if (e instanceof SshError) {
    switch (e.kind) {
      case 'HOST_KEY_MISMATCH':
        return apiError(e.message, 409);
      case 'TIMEOUT':
        return apiError('The server took too long to respond', 504);
      case 'CONNECT':
        return apiError(`Could not connect to your server: ${e.message}`, 502);
      default:
        return apiError('Command could not be started on your server', 502);
    }
  }
  if ((e as Error)?.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
  console.error('[deploy]', e);
  return apiError('Internal server error', 500);
}
