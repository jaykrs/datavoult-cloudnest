/**
 * Cookie-consent state, kept in one first-party cookie so the choice is
 * remembered (this cookie itself is strictly necessary and is not analytics).
 * Safe to import from client components.
 */

export type ConsentValue = 'accepted' | 'rejected';

export const CONSENT_COOKIE = 'dv_cookie_consent';
/** Fired on `window` whenever the choice changes in this tab. */
export const CONSENT_EVENT = 'dv-consent-change';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Read the choice out of a `document.cookie`-style string. Unknown values count as "no choice". */
export function parseConsent(cookieString: string | null | undefined): ConsentValue | null {
  if (!cookieString) return null;
  for (const part of cookieString.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== CONSENT_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    return value === 'accepted' || value === 'rejected' ? value : null;
  }
  return null;
}

/** `Set-Cookie`-style string for the choice; `null` clears it. */
export function consentCookieString(value: ConsentValue | null, secure: boolean): string {
  const parts = [
    `${CONSENT_COOKIE}=${value ?? ''}`,
    'Path=/',
    `Max-Age=${value ? ONE_YEAR_SECONDS : 0}`,
    'SameSite=Lax',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function readConsent(): ConsentValue | null {
  if (typeof document === 'undefined') return null;
  return parseConsent(document.cookie);
}

function persist(value: ConsentValue | null) {
  document.cookie = consentCookieString(value, window.location.protocol === 'https:');
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function writeConsent(value: ConsentValue) {
  persist(value);
}

export function clearConsent() {
  persist(null);
}
