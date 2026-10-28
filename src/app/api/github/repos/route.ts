import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { apiError, apiSuccess } from '@/lib/api';
import { rateLimit } from '@/lib/rate-limit';
import { GithubError, GITHUB_TOKEN_PATTERN, listDockerRepos } from '@/lib/github';

const bodySchema = z.object({ token: z.string().regex(GITHUB_TOKEN_PATTERN, 'That does not look like a GitHub access token') });

/**
 * POST /api/github/repos — the caller's GitHub repositories that contain a Dockerfile.
 * POST (not GET) and no-store so the token never ends up in a URL, cache or log; it is
 * forwarded to GitHub for this request only.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const limit = rateLimit(`github-repos:${session.userId}`, 15, 10 * 60_000);
    if (!limit.allowed) return apiError('Too many requests. Please wait a few minutes.', 429);

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return apiError(parsed.error.errors[0].message, 400);

    const result = await listDockerRepos(parsed.data.token);
    const res = apiSuccess(result);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if (e instanceof GithubError) return apiError(e.message, e.kind === 'BAD_TOKEN' ? 400 : e.kind === 'RATE_LIMIT' ? 429 : 502);
    console.error('[github/repos]', (e as Error).message);
    return apiError('Internal server error', 500);
  }
}
