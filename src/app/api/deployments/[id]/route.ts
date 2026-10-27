import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { runSsh } from '@/lib/ssh';
import { buildTeardownScript } from '@/lib/app-deploy-script';
import { loadServerAccess, pinHostKeyIfUnset, accessErrorResponse } from '@/lib/deploy-access';
import { isDeployInProgress } from '@/lib/deployment-utils';
import { publicDeployment } from '@/lib/deployment-serializer';

interface Params { params: { id: string } }

async function loadOwned(id: string, userId: string) {
  return prisma.deployment.findFirst({
    where: { id, userId },
    include: { subscription: { select: { serviceConfig: { select: { ipAddress: true } } } } },
  });
}

/** GET /api/deployments/:id — status and the live log. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const d = await loadOwned(params.id, session.userId as string);
    if (!d) return apiError('Deployment not found', 404);
    return apiSuccess({ deployment: publicDeployment(d, d.subscription.serviceConfig?.ipAddress, true) });
  } catch (e) {
    return accessErrorResponse(e);
  }
}

/**
 * DELETE /api/deployments/:id — stop the app, remove its nginx config and files from the
 * server, then delete the record. `?force=1` deletes only the record (server unreachable).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;
    const d = await loadOwned(params.id, userId);
    if (!d) return apiError('Deployment not found', 404);
    if (isDeployInProgress(d)) return apiError('This deployment is still running. Wait for it to finish.', 409);

    const force = new URL(req.url).searchParams.get('force') === '1';
    if (!force) {
      const limit = rateLimit(`deployments-remove:${userId}`, 10, 10 * 60_000);
      if (!limit.allowed) return apiError('Too many requests. Please wait a moment.', 429);
      const access = await loadServerAccess(d.subscriptionId, userId);
      const script = buildTeardownScript({ appName: d.appName, mode: d.mode, domain: d.httpsMode === 'LETSENCRYPT' ? d.domain : null });
      const result = await runSsh(access.target, script, { timeoutMs: 3 * 60_000 });
      await pinHostKeyIfUnset(access.serviceConfigId, result.hostKeySha256).catch(() => {});
      if (result.code !== 0) {
        return apiError(`Could not clean up the server: ${(result.stderr || result.stdout || `exit ${result.code}`).trim().slice(-300)}`, 502);
      }
    }
    await prisma.deployment.delete({ where: { id: d.id } });
    return apiSuccess({ deleted: true });
  } catch (e) {
    return accessErrorResponse(e);
  }
}
