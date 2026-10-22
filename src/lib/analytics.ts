import { readConsent } from './consent';

declare global {
  interface Window { dataLayer?: Record<string, unknown>[] }
}

/** GTM container IDs look like GTM-XXXXXXX. Validated because the ID is placed into a script. */
export const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/;

/** The configured Google Tag Manager container, or null when unset/invalid. */
export function getGtmId(): string | null {
  const id = process.env.NEXT_PUBLIC_GTM_ID;
  return id && GTM_ID_PATTERN.test(id) ? id : null;
}

/**
 * Push an event to GTM's dataLayer — only when the visitor accepted cookies
 * and a container is configured. Otherwise it is a silent no-op, so call
 * sites never need to check consent themselves.
 */
export function trackEvent(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  if (readConsent() !== 'accepted' || !getGtmId()) return;
  (window.dataLayer = window.dataLayer || []).push({ event, ...params });
}
