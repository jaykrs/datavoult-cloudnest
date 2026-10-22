'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

declare global {
  interface Window {
    grecaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => number;
      reset: (id?: number) => void;
    };
    __dvRecaptchaReady?: () => void;
  }
}

export interface RecaptchaHandle { reset: () => void }

const SCRIPT_ID = 'google-recaptcha-script';
export const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

/**
 * Google reCAPTCHA v2 checkbox. Renders nothing when no site key is
 * configured (local development) — the server then skips verification too,
 * and refuses requests in production.
 */
const Recaptcha = forwardRef<RecaptchaHandle, { onChange: (token: string | null) => void }>(function Recaptcha({ onChange }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current !== null) window.grecaptcha?.reset(widgetId.current);
      cb.current(null);
    },
  }));

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY || !box.current) return;
    const el = box.current;

    const render = () => {
      if (widgetId.current !== null || !window.grecaptcha?.render) return;
      widgetId.current = window.grecaptcha.render(el, {
        sitekey: RECAPTCHA_SITE_KEY,
        callback: (t: string) => cb.current(t),
        'expired-callback': () => cb.current(null),
        'error-callback': () => cb.current(null),
        theme: 'dark',
      });
    };

    if (window.grecaptcha?.render) render();
    else {
      window.__dvRecaptchaReady = render;
      if (!document.getElementById(SCRIPT_ID)) {
        const s = document.createElement('script');
        s.id = SCRIPT_ID;
        s.src = 'https://www.google.com/recaptcha/api.js?onload=__dvRecaptchaReady&render=explicit';
        s.async = true;
        s.defer = true;
        document.head.appendChild(s);
      }
    }
  }, []);

  if (!RECAPTCHA_SITE_KEY) return null;
  return <div ref={box} style={{ minHeight: 78 }} />;
});

export default Recaptcha;
