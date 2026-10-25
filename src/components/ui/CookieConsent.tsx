'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { readConsent, writeConsent } from '@/lib/consent';

/** Bottom banner shown until the visitor accepts or rejects. Reopens via the footer "Cookie settings" link. */
export default function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setOpen(readConsent() === null);
    const reopen = () => setOpen(true);
    sync();
    window.addEventListener('dv-cookie-settings', reopen);
    return () => window.removeEventListener('dv-cookie-settings', reopen);
  }, []);

  if (!open) return null;

  const choose = (v: 'accepted' | 'rejected') => {
    const previous = readConsent();
    writeConsent(v);
    setOpen(false);
    // Analytics already loaded this page view can't be unloaded — reload so a withdrawal takes effect.
    if (previous === 'accepted' && v === 'rejected') window.location.reload();
  };

  return (
    <div role="dialog" aria-label="Cookie consent" style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 1000, maxWidth: 560, margin: '0 auto', background: 'var(--bg-elevated, #14141c)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Cookie size={20} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent-bright)' }} />
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          We use cookies for essential site functions, and — only if you accept — analytics cookies to understand how the site is used.
          See our <Link href="/privacy" style={{ color: 'var(--accent-bright)' }}>Privacy Policy</Link>.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => choose('rejected')}>Reject</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => choose('accepted')}>Accept</button>
      </div>
    </div>
  );
}

