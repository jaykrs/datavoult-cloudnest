import { describe, it, expect } from 'vitest';
import { parseConsent, consentCookieString, CONSENT_COOKIE } from './consent';

describe('consent cookie', () => {
  it('reads accepted / rejected among other cookies', () => {
    expect(parseConsent(`a=1; ${CONSENT_COOKIE}=accepted; b=2`)).toBe('accepted');
    expect(parseConsent(`${CONSENT_COOKIE}=rejected`)).toBe('rejected');
  });
  it('treats missing, empty or tampered values as no choice', () => {
    expect(parseConsent('')).toBeNull();
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent('a=1')).toBeNull();
    expect(parseConsent(`${CONSENT_COOKIE}=yes`)).toBeNull();
    expect(parseConsent(`x${CONSENT_COOKIE}=accepted`)).toBeNull();
  });
  it('builds a one-year Lax cookie, Secure on https, and a clearing cookie for null', () => {
    const c = consentCookieString('accepted', true);
    expect(c).toContain(`${CONSENT_COOKIE}=accepted`);
    expect(c).toContain('Max-Age=31536000');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Secure');
    expect(consentCookieString('rejected', false)).not.toContain('Secure');
    expect(consentCookieString(null, false)).toContain('Max-Age=0');
  });
});
