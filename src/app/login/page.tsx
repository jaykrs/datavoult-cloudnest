'use client';
import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Database, Eye, EyeOff, ArrowRight } from 'lucide-react';

function LoginForm() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const router       = useRouter();
  const searchParams = useSearchParams();
  const next         = searchParams.get('next') || '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); setLoading(false); return; }
      localStorage.setItem('dv_user', JSON.stringify(data.user));
      router.push(next || (data.user.role === 'ADMIN' || data.user.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard'));
    } catch { setError('Network error. Please try again.'); setLoading(false); }
  }

  function fill(role: 'user' | 'admin') {
    if (role === 'user')  { setEmail('john.doe@example.com');    setPassword('Password123!'); }
    else                  { setEmail('admin@datavoult.io'); setPassword('Password123!'); }
  }

  return (
    <div className="auth-page grid-bg">
      <div className="glow-orb" style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)' }} />

      <div className="auth-card-wrap">
        <div className="auth-logo-wrap">
          <Link href="/" className="auth-logo-link">
            <div className="auth-logo-icon"><Database size={24} color="white" /></div>
            <span className="auth-logo-text">DataVoult</span>
          </Link>
          <p className="auth-logo-sub">{next ? 'Sign in to continue your purchase' : 'Sign in to your account'}</p>
          {next && <div className="auth-logo-pill">🔒 You&apos;ll be redirected back after signing in</div>}
        </div>

        <div className="auth-box">
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="label">Email address</label>
              <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required autoFocus />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="label" style={{ margin: 0 }}>Password</label>
                <Link href="#" style={{ fontSize: 12, color: 'var(--accent-bright)' }}>Forgot password?</Link>
              </div>
              <div className="input-icon-wrap">
                <input type={showPass ? 'text' : 'password'} className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="input-icon-btn">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ padding: 12 }}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="auth-demo-box">
            <div className="auth-demo-title">Quick demo login</div>
            <div className="auth-demo-fills">
              <button type="button" onClick={() => fill('user')}  className="btn btn-secondary btn-sm btn-full" style={{ fontSize: 11 }}>👤 Fill User</button>
              <button type="button" onClick={() => fill('admin')} className="btn btn-secondary btn-sm btn-full" style={{ fontSize: 11 }}>🛡️ Fill Admin</button>
            </div>
            <div className="auth-demo-hint">Password for all accounts: <span style={{ color: 'var(--accent-bright)' }}>Password123!</span></div>
          </div>
        </div>

        <p className="auth-foot">
          Don&apos;t have an account?{' '}
          <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="auth-foot-link">Create one free</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="spinner" style={{ width: 32, height: 32 }} /></div>}>
      <LoginForm />
    </Suspense>
  );
}
