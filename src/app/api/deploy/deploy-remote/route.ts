import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { runSsh } from '@/lib/ssh';
import { deployRequestSchema, parseRepoUrl, allowedGitHosts } from '@/lib/deploy-validation';
import { buildDeployScript } from '@/lib/deploy-script';
import { loadServerAccess, pinHostKeyIfUnset, accessErrorResponse } from '@/lib/deploy-access';

/**
 * POST /api/deploy/deploy-remote — deploy a public git repo to the caller's own VPS.
 *
 * Requires a session and ownership of the subscription. The repository must
 * be a public https URL on an allowed host; branch, port and environment
 * variables are strictly validated; credentials are looked up server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;

    const limit = rateLimit(`deploy-remote:${userId}`, 6, 10 * 60_000);
    if (!limit.allowed) return apiError('Too many deployments. Please wait before trying again.', 429);

    const parsed = deployRequestSchema.safeParse(await req.json());
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400);
    const { subscriptionId, repoUrl, branch, port, env } = parsed.data;

    const repo = parseRepoUrl(repoUrl);
    if (!repo) {
      return apiError(`Repository must be a public https URL on one of: ${allowedGitHosts().join(', ')}`, 400);
    }

    const access = await loadServerAccess(subscriptionId, userId);
    const { script, pm2AppName, targetFolder } = buildDeployScript({ repo, branch, port, env, stamp: Date.now() });

    const result = await runSsh(access.target, script, { timeoutMs: 20 * 60_000 });
    await pinHostKeyIfUnset(access.serviceConfigId, result.hostKeySha256);

    if (result.code === 0) {
      return Response.json({
        success: true,
        message: `Application built and managed by PM2 as '${pm2AppName}'`,
        pm2AppName,
        targetPath: `~/deployments/${targetFolder}`,
        runningPort: port,
      });
    }
    return Response.json(
      { error: 'Deployment failed', details: result.stderr || result.stdout || `Exited with code ${result.code}` },
      { status: 500 },
    );
  } catch (e) {
    return accessErrorResponse(e);
  }
}
