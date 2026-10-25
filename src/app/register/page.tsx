'use client';
import { useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Database, Eye, EyeOff, ArrowRight, Check } from 'lucide-react';
import Recaptcha, { RECAPTCHA_SITE_KEY, type RecaptchaHandle } from '@/components/ui/Recaptcha';
import { trackEvent } from '@/lib/analytics';

function RegisterForm() {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [captcha,  setCaptcha]  = useState<string | null>(null);
  const captchaRef = useRef<RecaptchaHandle>(null);
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get('next') || '';

  const strength      = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3;
  const strengthColor = ['transparent','var(--red)','var(--amber)','var(--green)'][strength];
  const strengthLabel = ['','Weak','Good','Strong'][strength];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!acceptPrivacy) { setError('Please accept the Privacy Policy to continue'); return; }
    if (RECAPTCHA_SITE_KEY && !captcha) { setError('Please complete the reCAPTCHA check'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password, acceptPrivacy, recaptchaToken: captcha || undefined }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed'); setLoading(false); captchaRef.current?.reset(); return; }
      localStorage.setItem('dv_user', JSON.stringify(data.user));
      trackEvent('sign_up', { method: 'email' });
      router.push(next || '/dashboard');
    } catch { setError('Network error. Please try again.'); setLoading(false); }
  }

  return (
    <div className="auth-page grid-bg">
      <div className="glow-orb" style={{ position: 'fixed', top: '30%', right: '20%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)' }} />

      <div className="auth-card-wrap" style={{ maxWidth: 440 }}>
        <div className="auth-logo-wrap">
          <Link href="/" className="auth-logo-link">
            <div className="auth-logo-icon"><Database size={24} color="white" /></div>
            <span className="auth-logo-text">DataVoult</span>
          </Link>
          <p className="auth-logo-sub">{next ? 'Create an account to continue' : 'Create your free account'}</p>
        </div>

        <div className="auth-box">
          <div className="auth-benefits">
            {['No credit card required','Free trial on all plans','Cancel anytime'].map(b => (
              <div key={b} className="auth-benefit-row"><Check size={14} color="var(--green)" /> {b}</div>
            ))}
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Full name</label>
              <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required minLength={2} autoFocus />
            </div>
            <div>
              <label className="label">Email address</label>
              <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="input-icon-wrap">
                <input type={showPass ? 'text' : 'password'} className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" required style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="input-icon-btn">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div className="pass-strength-bars">
                    {[1,2,3].map(n => (
                      <div key={n} className="pass-strength-bar" style={{ background: n <= strength ? strengthColor : 'var(--border)' }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: strengthColor }}>{strengthLabel}</div>
                </div>
              )}
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={acceptPrivacy} onChange={e => setAcceptPrivacy(e.target.checked)} style={{ marginTop: 3 }} required />
              <span>I have read and agree to the <Link href="/privacy" target="_blank" style={{ color: 'var(--accent-bright)' }}>Privacy Policy</Link>.</span>
            </label>
            <Recaptcha ref={captchaRef} onChange={setCaptcha} />
            <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ padding: 12 }}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <>Create account <ArrowRight size={16} /></>}
            </button>
          </form>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 16 }}>
            Your data is handled as described in our <Link href="/privacy" style={{ color: 'var(--accent-bright)' }}>Privacy Policy</Link>.
          </p>
        </div>

        <p className="auth-foot">
          Already have an account?{' '}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="auth-foot-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="spinner" style={{ width: 32, height: 32 }} /></div>}>
      <RegisterForm />
    </Suspense>
  );
}
