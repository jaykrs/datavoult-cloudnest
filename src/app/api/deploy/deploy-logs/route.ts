import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { runSsh } from '@/lib/ssh';
import { shellQuote } from '@/lib/shell';
import { logsQuerySchema } from '@/lib/deploy-validation';
import { loadServerAccess, pinHostKeyIfUnset, accessErrorResponse } from '@/lib/deploy-access';

/**
 * GET /api/deploy/deploy-logs?subscriptionId=…&pm2AppName=…&type=out|error&lines=100
 *
 * Tails a PM2 log on the caller's own VPS. No credentials in the URL: the
 * server looks them up from the subscription.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;

    // The UI polls every few seconds; allow that, block abuse.
    const limit = rateLimit(`deploy-logs:${userId}`, 60, 60_000);
    if (!limit.allowed) return apiError('Too many requests', 429);

    const q = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = logsQuerySchema.safeParse(q);
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400);
    const { subscriptionId, pm2AppName, type, lines } = parsed.data;

    const access = await loadServerAccess(subscriptionId, userId);

    const logFile = `${pm2AppName}-${type}.log`;
    const result = await runSsh(access.target, `tail -n ${lines} "$HOME/.pm2/logs/"${shellQuote(logFile)}`, {
      timeoutMs: 30_000,
    });
    await pinHostKeyIfUnset(access.serviceConfigId, result.hostKeySha256);

    if (result.code !== 0) {
      return Response.json(
        { error: 'Log file could not be read', details: result.stderr.trim() || `${logFile} may not exist yet.` },
        { status: 404 },
      );
    }
    return Response.json({
      success: true,
      pm2AppName,
      logPath: `~/.pm2/logs/${logFile}`,
      logs: result.stdout || '[Log file is currently empty]',
    });
  } catch (e) {
    return accessErrorResponse(e);
  }
}
