'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { readConsent, CONSENT_EVENT } from '@/lib/consent';
import { getGtmId, trackEvent } from '@/lib/analytics';

/**
 * Google Tag Manager, loaded ONLY after the visitor accepts cookies (and only
 * when NEXT_PUBLIC_GTM_ID is set). Sends a `page_view` on every client-side
 * navigation, since the App Router doesn't reload the page.
 */
export default function Analytics() {
  const gtmId = getGtmId();
  const pathname = usePathname();
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const sync = () => setAccepted(readConsent() === 'accepted');
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  // Inject the GTM snippet once consent is given.
  useEffect(() => {
    if (!accepted || !gtmId || document.getElementById('gtm-script')) return;
    (window.dataLayer = window.dataLayer || []).push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.id = 'gtm-script';
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
    document.head.appendChild(s);
  }, [accepted, gtmId]);

  useEffect(() => {
    if (accepted) trackEvent('page_view', { page_path: pathname });
  }, [accepted, pathname]);

  return null;
}
