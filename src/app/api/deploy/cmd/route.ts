import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { runSsh } from '@/lib/ssh';
import { buildInstallCommand, INSTALLABLE_SOFTWARE } from '@/lib/install-recipes';
import { loadServerAccess, pinHostKeyIfUnset, accessErrorResponse } from '@/lib/deploy-access';

const schema = z.object({
  subscriptionId: z.string().min(1),
  software: z.enum(INSTALLABLE_SOFTWARE),
});

/**
 * POST /api/deploy/cmd — install a supported package on the caller's own VPS.
 *
 * Requires a session. The caller names a subscription and one of a fixed set
 * of software keys; credentials and the actual command are server-side only.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;

    const limit = rateLimit(`deploy-cmd:${userId}`, 10, 10 * 60_000);
    if (!limit.allowed) return apiError('Too many operations. Please wait before trying again.', 429);

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return apiError('Choose a supported software package', 400);
    const { subscriptionId, software } = parsed.data;

    const access = await loadServerAccess(subscriptionId, userId);
    const result = await runSsh(access.target, buildInstallCommand(software));
    await pinHostKeyIfUnset(access.serviceConfigId, result.hostKeySha256);

    if (result.code === 0) {
      return Response.json({ success: true, message: `${software} installed`, output: result.stdout, truncated: result.truncated });
    }
    return Response.json(
      { error: 'Installation failed', details: `Exited with code ${result.code}`, stderr: result.stderr, exitCode: result.code },
      { status: 500 },
    );
  } catch (e) {
    return accessErrorResponse(e);
  }
}
