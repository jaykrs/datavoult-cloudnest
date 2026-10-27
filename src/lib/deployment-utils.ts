/** Pure helpers (no database / SSH imports) so they are easy to test. */

/** A DEPLOYING row older than this is assumed to belong to a crashed run and may be retried. */
export const STALE_DEPLOY_MS = 25 * 60_000;

export function isDeployInProgress(d: { status: string; updatedAt: Date }, now = Date.now()): boolean {
  return d.status === 'DEPLOYING' && now - d.updatedAt.getTime() < STALE_DEPLOY_MS;
}

/** Remove secrets (e.g. an access token) from text before it is stored or shown. */
export function redact(text: string, secrets: Array<string | undefined>): string {
  let out = text;
  for (const s of secrets) if (s && s.length >= 6) out = out.split(s).join('***');
  return out;
}

