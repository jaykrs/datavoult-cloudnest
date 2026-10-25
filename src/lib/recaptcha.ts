import { apiError } from './api';

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export type RecaptchaFailure = 'missing' | 'invalid' | 'unavailable' | 'not_configured';
export type RecaptchaResult = { ok: true; skipped?: boolean } | { ok: false; reason: RecaptchaFailure };

/**
 * Verify a reCAPTCHA response token with Google (server-side — the browser's
 * word alone proves nothing).
 *
 * - No RECAPTCHA_SECRET_KEY, development: verification is skipped so the app
 *   works locally without Google keys.
 * - No RECAPTCHA_SECRET_KEY, production: FAILS CLOSED. A forgotten secret must
 *   never silently turn the protection off.
 * - Google unreachable: fails closed ("unavailable").
 */
export async function verifyRecaptcha(token: string | null | undefined, remoteIp?: string): Promise<RecaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return process.env.NODE_ENV === 'production'
      ? { ok: false, reason: 'not_configured' }
      : { ok: true, skipped: true };
  }
  if (!token) return { ok: false, reason: 'missing' };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, reason: 'unavailable' };

    const data = (await res.json()) as { success?: boolean };
    return data.success === true ? { ok: true } : { ok: false, reason: 'invalid' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

/** HTTP response for a failed check. */
export function recaptchaErrorResponse(result: Extract<RecaptchaResult, { ok: false }>) {
  switch (result.reason) {
    case 'missing':
      return apiError('Please complete the reCAPTCHA check.', 400);
    case 'invalid':
      return apiError('reCAPTCHA verification failed. Please try again.', 400);
    case 'not_configured':
      console.error('[recaptcha] RECAPTCHA_SECRET_KEY is not set — refusing the request');
      return apiError('The security check is not configured. Please try again later.', 503);
    default:
      return apiError('We could not run the security check. Please try again in a moment.', 503);
  }
}
