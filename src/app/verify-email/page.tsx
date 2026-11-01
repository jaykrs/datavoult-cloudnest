'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Database, CheckCircle, XCircle } from 'lucide-react';

function Verify() {
  const token = useSearchParams().get('token') || '';
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This verification link is incomplete.');

  useEffect(() => {
    if (!token) return;
    fetch('/api/auth/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(async r => {
        const d = await r.json().catch(() => ({}));
        if (r.ok) {
          setState('ok');
          // Keep the cached profile in step so the UI stops showing "Unverified".
          try { const u = JSON.parse(localStorage.getItem('dv_user') || 'null'); if (u) localStorage.setItem('dv_user', JSON.stringify({ ...u, isVerified: true })); } catch {}
        } else { setState('error'); setMessage(d.error || 'Could not verify your email.'); }
      })
      .catch(() => { setState('error'); setMessage('Network error. Please try again.'); });
  }, [token]);

  return (
    <div className="auth-page grid-bg">
      <div className="auth-card-wrap">
        <div className="auth-logo-wrap">
          <Link href="/" className="auth-logo-link">
            <div className="auth-logo-icon"><Database size={24} color="white" /></div>
            <span className="auth-logo-text">DataVoult</span>
          </Link>
        </div>
        <div className="auth-box" style={{ textAlign: 'center', padding: 32 }}>
          {state === 'loading' && <span className="spinner" style={{ width: 28, height: 28 }} />}
          {state === 'ok' && (<>
            <CheckCircle size={40} color="var(--green)" style={{ marginBottom: 12 }} />
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Email verified</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 18 }}>Thanks — your account is now verified.</p>
            <Link href="/dashboard" className="btn btn-primary btn-full">Go to dashboard</Link>
          </>)}
          {state === 'error' && (<>
            <XCircle size={40} color="var(--red)" style={{ marginBottom: 12 }} />
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Couldn&apos;t verify</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 18 }}>{message}</p>
            <Link href="/settings" className="btn btn-primary btn-full">Open account settings</Link>
          </>)}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() { return <Suspense><Verify /></Suspense>; }
