import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { decryptJson } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate-limit';
import { authType, sshCommand, sshPortOf, type StoredCredentials } from '@/lib/server-details';

interface Params { params: { id: string } }

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });

async function load(id: string, userId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { id, userId },
    include: { serviceConfig: true, product: { select: { category: true } } },
  });
  if (!sub) return { error: apiError('Service not found', 404) } as const;
  if (sub.status !== 'ACTIVE' && sub.status !== 'SUSPENDED') return { error: apiError('Access details are available for active services only', 409) } as const;
  const stored = (sub.serviceConfig?.credentials as { enc?: string } | null)?.enc;
  if (!sub.serviceConfig || !stored) return { error: apiError('No access details have been added for this service yet', 404) } as const;
  let creds: StoredCredentials;
  try { creds = decryptJson<StoredCredentials>(stored); } catch { return { error: apiError('Access details are temporarily unavailable', 503) } as const; }
  return { sub, cfg: sub.serviceConfig, creds } as const;
}

/** GET — what kind of access exists (username, auth type, port). No secrets. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const r = await load(params.id, session.userId as string);
    if ('error' in r) return r.error;
    const host = r.cfg.ipAddress || r.cfg.domain || r.cfg.hostname || '';
    const port = sshPortOf(r.cfg.config);
    return json({ success: true, data: {
      username: r.creds.username, authType: authType(r.creds), port, host,
      sshCommand: r.sub.product.category === 'VPS' && host ? sshCommand({ username: r.creds.username, host, port, keyFile: r.creds.privateKey ? 'server-key.pem' : undefined }) : null,
    } });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[credentials GET]', e);
    return apiError('Internal server error', 500);
  }
}

/**
 * POST — reveal the password / private key to the service's owner. POST + no-store so the
 * secret never lands in URLs, caches or access logs. Rate limited.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;
    const limit = rateLimit(`credentials:${userId}`, 20, 10 * 60_000);
    if (!limit.allowed) return apiError('Too many requests. Please wait a few minutes.', 429);

    const r = await load(params.id, userId);
    if ('error' in r) return r.error;
    console.log(`[credentials] revealed for subscription ${params.id} by user ${userId}`);
    return json({ success: true, data: { username: r.creds.username, password: r.creds.password ?? null, privateKey: r.creds.privateKey ?? null } });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[credentials POST]', e);
    return apiError('Internal server error', 500);
  }
}
