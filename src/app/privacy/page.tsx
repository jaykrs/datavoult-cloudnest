import type { Metadata } from 'next';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';

export const metadata: Metadata = { title: 'Privacy Policy — DataVoult' };

const h2 = { fontSize: 20, fontWeight: 600, margin: '32px 0 10px' } as const;
const p = { color: 'var(--text-secondary)', lineHeight: 1.7, margin: '0 0 12px', fontSize: 15 } as const;

/*
 * TEMPLATE: describes what this application actually does with data today.
 * Have it reviewed by a lawyer and add your legal entity, address and contact
 * details before relying on it.
 */
export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <main className="container" style={{ maxWidth: 780, padding: '56px 24px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, marginBottom: 6 }}>Privacy Policy</h1>
        <p style={{ ...p, fontSize: 13 }}>Last updated: October 2026</p>

        <h2 style={h2}>What we collect</h2>
        <p style={p}><b>Account data</b> — your name, email address and a securely hashed password, plus the time you accepted this policy.</p>
        <p style={p}><b>Order data</b> — the products and plans you subscribe to and payment records. Card details are handled by our payment provider (Razorpay) and are never stored on our servers.</p>
        <p style={p}><b>Contact messages</b> — the name, email, subject and message you send through our contact form.</p>
        <p style={p}><b>Service data</b> — configuration and access details for the infrastructure you purchase.</p>

        <h2 style={h2}>How we use it</h2>
        <p style={p}>To run your account, provision and bill your services, respond to your messages, send transactional emails (welcome and order confirmations) and keep the platform secure.</p>

        <h2 style={h2}>Cookies and analytics</h2>
        <p style={p}><b>Essential cookies</b> keep you signed in and remember your cookie choice. They are always on.</p>
        <p style={p}><b>Analytics cookies</b> (Google Tag Manager and tools loaded through it) are used only if you click “Accept” on the cookie banner. If you click “Reject”, they are not loaded. You can change your choice any time using “Cookie settings” in the footer.</p>

        <h2 style={h2}>Spam protection (Google reCAPTCHA)</h2>
        <p style={p}>Sign in, sign up and the contact form use Google reCAPTCHA to block automated abuse. It sends technical information about your browser to Google, which is subject to Google&apos;s <a href="https://policies.google.com/privacy" style={{ color: 'var(--accent-bright)' }}>Privacy Policy</a> and <a href="https://policies.google.com/terms" style={{ color: 'var(--accent-bright)' }}>Terms</a>.</p>

        <h2 style={h2}>Who we share data with</h2>
        <p style={p}>Only service providers who help us operate: payment processing (Razorpay), email delivery, hosting, Google (reCAPTCHA and, if you accept, analytics) and infrastructure providers needed to deliver what you buy. We do not sell personal data.</p>

        <h2 style={h2}>Retention and your rights</h2>
        <p style={p}>We keep account and billing records while your account is active and as long as the law requires. You can ask to access, correct or delete your data by contacting us through the <a href="/contact" style={{ color: 'var(--accent-bright)' }}>contact page</a>.</p>

        <h2 style={h2}>Changes</h2>
        <p style={p}>We will update this page when our practices change and revise the date above.</p>
      </main>
      <Footer />
    </div>
  );
}
