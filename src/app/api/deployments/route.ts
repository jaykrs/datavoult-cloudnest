import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { encryptJson } from '@/lib/crypto';
import { parseRepoUrl, allowedGitHosts } from '@/lib/deploy-validation';
import { createDeploymentSchema, makeAppName, normalizeDomain, resolveHttpsMode } from '@/lib/app-deploy-validation';
import { buildAppDeployScript } from '@/lib/app-deploy-script';
import { loadServerAccess, accessErrorResponse } from '@/lib/deploy-access';
import { runDeployment } from '@/lib/deployment-runner';
import { publicDeployment } from '@/lib/deployment-serializer';

/** GET /api/deployments?subscriptionId= — the caller's deployments on one of their services. */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const subscriptionId = new URL(req.url).searchParams.get('subscriptionId');
    if (!subscriptionId) return apiError('subscriptionId is required', 400);
    const sub = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId: session.userId as string },
      select: { serviceConfig: { select: { ipAddress: true } } },
    });
    if (!sub) return apiError('Service not found', 404);
    const rows = await prisma.deployment.findMany({ where: { subscriptionId }, orderBy: { createdAt: 'desc' } });
    return apiSuccess({ deployments: rows.map((d) => publicDeployment(d, sub.serviceConfig?.ipAddress)) });
  } catch (e) {
    return accessErrorResponse(e);
  }
}

/**
 * POST /api/deployments — deploy a git repo to the caller's VPS (clone, build, run with
 * PM2 or Docker, nginx on 80/443). Returns 202 immediately; poll GET /api/deployments/:id.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;

    const limit = rateLimit(`deployments:${userId}`, 8, 10 * 60_000);
    if (!limit.allowed) return apiError('Too many deployments. Please wait before trying again.', 429);

    const parsed = createDeploymentSchema.safeParse(await req.json());
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400);
    const input = parsed.data;

    const repo = parseRepoUrl(input.repoUrl);
    if (!repo) return apiError(`Repository must be an https URL on one of: ${allowedGitHosts().join(', ')}`, 400);

    const access = await loadServerAccess(input.subscriptionId, userId);
    const domain = input.domain ? normalizeDomain(input.domain) ?? undefined : undefined;
    const httpsMode = resolveHttpsMode(input.httpsMode, domain);
    const appName = makeAppName(repo.repoName, input.port);

    const existing = await prisma.deployment.findUnique({ where: { subscriptionId_port: { subscriptionId: input.subscriptionId, port: input.port } } });
    if (existing) return apiError(`Port ${input.port} is already used by "${existing.appName}" on this server. Redeploy it or choose another port.`, 409);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    const { script } = buildAppDeployScript({
      repo, appName, branch: input.branch, port: input.port, mode: input.mode, httpsMode, domain,
      email: user?.email, env: input.env, gitToken: input.gitToken, stamp: Date.now(),
    });

    const deployment = await prisma.deployment.create({
      data: {
        subscriptionId: input.subscriptionId, userId, appName, repoUrl: repo.cloneUrl, branch: input.branch,
        port: input.port, mode: input.mode, httpsMode, domain: domain ?? null,
        envEnc: input.env.length ? encryptJson(input.env) : null,
        status: 'DEPLOYING', log: '',
      },
    });

    // Fire and forget: the run records its own progress and never throws.
    void runDeployment({ deploymentId: deployment.id, serviceConfigId: access.serviceConfigId, target: access.target, script, secrets: [input.gitToken, ...input.env.map((v) => v.value)] });

    return apiSuccess({ deployment: publicDeployment(deployment, access.target.host, true) }, 202);
  } catch (e) {
    return accessErrorResponse(e);
  }
}
