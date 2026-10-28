import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { decryptJson, encryptJson } from '@/lib/crypto';
import { parseRepoUrl } from '@/lib/deploy-validation';
import { redeploySchema } from '@/lib/app-deploy-validation';
import { buildAppDeployScript } from '@/lib/app-deploy-script';
import { loadServerAccess, accessErrorResponse } from '@/lib/deploy-access';
import { planDeployOptions } from '@/lib/docker-limits';
import { runDeployment } from '@/lib/deployment-runner';
import { isDeployInProgress } from '@/lib/deployment-utils';
import { publicDeployment } from '@/lib/deployment-serializer';

/**
 * POST /api/deployments/:id/redeploy — pull the latest code and restart. Port, run mode,
 * domain and HTTPS stay as deployed; branch and environment variables may be changed.
 * Omit `env` to keep the stored variables.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;

    const limit = rateLimit(`deployments:${userId}`, 8, 10 * 60_000);
    if (!limit.allowed) return apiError('Too many deployments. Please wait before trying again.', 429);

    const body = await req.json().catch(() => ({}));
    const parsed = redeploySchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400);

    const d = await prisma.deployment.findFirst({ where: { id: params.id, userId } });
    if (!d) return apiError('Deployment not found', 404);
    if (isDeployInProgress(d)) return apiError('This deployment is already running.', 409);

    const repo = parseRepoUrl(d.repoUrl);
    if (!repo) return apiError('The stored repository URL is no longer allowed', 400);

    let env: { key: string; value: string }[] = [];
    try { env = parsed.data.env ?? (d.envEnc ? decryptJson(d.envEnc) : []); } catch { return apiError('Stored environment variables could not be read — please re-enter them', 409); }

    const access = await loadServerAccess(d.subscriptionId, userId, ['VPS', 'DOCKER']);
    const opts = planDeployOptions(access.category, access.planLimits);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const branch = parsed.data.branch ?? d.branch;
    const { script } = buildAppDeployScript({
      repo, appName: d.appName, branch, port: d.port, mode: d.mode, httpsMode: d.httpsMode,
      domain: d.domain ?? undefined, email: user?.email, env, gitToken: parsed.data.gitToken, stamp: Date.now(),
      requireDockerfile: opts.requireDockerfile, limits: opts.limits,
    });

    const updated = await prisma.deployment.update({
      where: { id: d.id },
      data: { status: 'DEPLOYING', log: '', branch, ...(parsed.data.env ? { envEnc: parsed.data.env.length ? encryptJson(parsed.data.env) : null } : {}) },
    });
    void runDeployment({ deploymentId: d.id, serviceConfigId: access.serviceConfigId, target: access.target, script, secrets: [parsed.data.gitToken, ...env.map((v) => v.value)] });

    return apiSuccess({ deployment: publicDeployment(updated, access.target.host, true) }, 202);
  } catch (e) {
    return accessErrorResponse(e);
  }
}
