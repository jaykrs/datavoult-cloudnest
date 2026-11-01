'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Database, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import Recaptcha, { RECAPTCHA_SITE_KEY, type RecaptchaHandle } from '@/components/ui/Recaptcha';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const captchaRef = useRef<RecaptchaHandle>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (RECAPTCHA_SITE_KEY && !captcha) { setError('Please complete the reCAPTCHA check'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recaptchaToken: captcha || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not send the reset link'); captchaRef.current?.reset(); }
      else setSent(true);
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
          <p className="auth-logo-sub">Reset your password</p>
        </div>

        <div className="auth-box">
          {sent ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <CheckCircle size={36} color="var(--green)" style={{ marginBottom: 10 }} />
              <h2 style={{ fontSize: 18, marginBottom: 6 }}>Check your email</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                If an account exists for <b>{email}</b>, we&apos;ve sent a link to reset your password. It works once and expires in 1 hour.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && <div className="auth-error">{error}</div>}
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>Enter the email you signed up with and we&apos;ll send you a link to choose a new password.</p>
              <div>
                <label className="label">Email address</label>
                <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoFocus maxLength={200} />
              </div>
              <Recaptcha ref={captchaRef} onChange={setCaptcha} />
              <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ padding: 12 }}>
                {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <>Send reset link <Mail size={16} /></>}
              </button>
            </form>
          )}
        </div>

        <p className="auth-foot">
          <Link href="/login" className="auth-foot-link"><ArrowLeft size={13} style={{ verticalAlign: 'middle' }} /> Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
