'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Database, Eye, EyeOff, CheckCircle } from 'lucide-react';

function ResetForm() {
  const token = useSearchParams().get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || 'Could not reset the password'); else setDone(true);
    } catch { setError('Network error. Please try again.'); }
    setLoading(false);
  }

  return (
    <div className="auth-page grid-bg">
      <div className="auth-card-wrap">
        <div className="auth-logo-wrap">
          <Link href="/" className="auth-logo-link">
            <div className="auth-logo-icon"><Database size={24} color="white" /></div>
            <span className="auth-logo-text">DataVoult</span>
          </Link>
          <p className="auth-logo-sub">Choose a new password</p>
        </div>

        <div className="auth-box">
          {done ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <CheckCircle size={36} color="var(--green)" style={{ marginBottom: 10 }} />
              <h2 style={{ fontSize: 18, marginBottom: 6 }}>Password updated</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>You can now sign in with your new password.</p>
              <Link href="/login" className="btn btn-primary btn-full">Sign in</Link>
            </div>
          ) : !token ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>This reset link is incomplete. Please request a new one.</p>
              <Link href="/forgot-password" className="btn btn-primary btn-full">Request a new link</Link>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && (
                <div className="auth-error">
                  {error} {/expired|invalid|used/i.test(error) && <Link href="/forgot-password" style={{ textDecoration: 'underline' }}>Request a new link</Link>}
                </div>
              )}
              <div>
                <label className="label">New password</label>
                <div className="input-icon-wrap">
                  <input type={showPass ? 'text' : 'password'} className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" required minLength={8} maxLength={100} autoFocus style={{ paddingRight: 44 }} />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="input-icon-btn">{showPass ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input type={showPass ? 'text' : 'password'} className="input" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} maxLength={100} />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ padding: 12 }}>
                {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Reset password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}
