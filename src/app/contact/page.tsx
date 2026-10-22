'use client';
import { useRef, useState } from 'react';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import Recaptcha, { RECAPTCHA_SITE_KEY, type RecaptchaHandle } from '@/components/ui/Recaptcha';
import { trackEvent } from '@/lib/analytics';
import { Send, CheckCircle } from 'lucide-react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', website: '' });
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const captchaRef = useRef<RecaptchaHandle>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (RECAPTCHA_SITE_KEY && !captcha) { setError('Please complete the reCAPTCHA check'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, recaptchaToken: captcha || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not send your message'); captchaRef.current?.reset(); setLoading(false); return; }
      trackEvent('contact_submit');
      setSent(true);
    } catch { setError('Network error. Please try again.'); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <main className="container" style={{ maxWidth: 620, padding: '56px 24px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, marginBottom: 6 }}>Contact us</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>Questions about plans, billing or your services? Send us a message and we&apos;ll reply by email.</p>

        {sent ? (
          <div className="auth-box" style={{ textAlign: 'center', padding: 40 }}>
            <CheckCircle size={40} color="var(--green)" style={{ marginBottom: 12 }} />
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Message sent</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Thanks — we&apos;ll get back to you soon.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="auth-box" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && <div className="auth-error">{error}</div>}
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={set('name')} required minLength={2} maxLength={100} /></div>
            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={set('email')} required maxLength={200} /></div>
            <div><label className="label">Subject</label><input className="input" value={form.subject} onChange={set('subject')} required minLength={3} maxLength={200} /></div>
            <div><label className="label">Message</label><textarea className="input" rows={6} value={form.message} onChange={set('message')} required minLength={10} maxLength={5000} style={{ resize: 'vertical' }} /></div>
            {/* Honeypot — hidden from people, tempting to bots. */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set('website')} style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
            <Recaptcha ref={captchaRef} onChange={setCaptcha} />
            <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ padding: 12 }}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <>Send message <Send size={16} /></>}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
