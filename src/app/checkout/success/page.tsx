'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Server, Package, Mail, ArrowRight, Copy, RefreshCw, LayoutDashboard } from 'lucide-react';

interface ServiceConfig { hostname?: string; ipAddress?: string; region?: string; }
interface Subscription {
  id: string; status: string;
  product: { name: string; category: string };
  plan: { name: string; price: number; billingCycle: string };
  serviceConfig?: ServiceConfig;
  renewsAt?: string;
}

const catIcon: Record<string, React.ReactNode> = { VPS: <Server size={24} />, DOCKER: <Package size={24} />, EMAIL: <Mail size={24} /> };
const catColor: Record<string, string> = { VPS: 'var(--vps-color)', DOCKER: 'var(--docker-color)', EMAIL: 'var(--email-color)' };

function SuccessContent() {
  const searchParams = useSearchParams();
  const subId = searchParams.get('sub') || '';
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!subId) { setLoading(false); return; }
    fetch(`/api/subscriptions/${subId}`)
      .then(r => r.json())
      .then(d => { setSubscription(d.data?.subscription || null); setLoading(false); });
  }, [subId]);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  const color = subscription ? (catColor[subscription.product.category] || 'var(--accent)') : 'var(--accent)';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} className="grid-bg">
      <div style={{ width: '100%', maxWidth: 560 }}>
        {/* Success icon */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--green-glow)', border: '2px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle size={40} color="var(--green)" />
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, marginBottom: 8 }}>Payment successful!</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>Your service has been activated. Welcome to DataVoult!</p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <span className="spinner" style={{ width: 28, height: 28 }} />
          </div>
        ) : subscription ? (
          <div style={{ background: 'var(--bg-card)', border: `1px solid ${color}33`, borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: 24 }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {catIcon[subscription.product.category]}
              </div>
              <div>
                <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>{subscription.product.name}</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge badge-${subscription.product.category.toLowerCase()}`}>{subscription.product.category}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{subscription.plan.name} · ${subscription.plan.price}/mo</span>
                </div>
              </div>
              <span className="badge badge-active" style={{ marginLeft: 'auto' }}>ACTIVE</span>
            </div>

            {/* Service config */}
            {subscription.serviceConfig && (
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Your service details</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {subscription.serviceConfig.hostname && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Hostname</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', background: 'var(--bg-card)', padding: '3px 8px', borderRadius: 4 }}>{subscription.serviceConfig.hostname}</code>
                        <button onClick={() => copy(subscription.serviceConfig!.hostname!, 'hostname')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                          {copied === 'hostname' ? <RefreshCw size={13} color="var(--green)" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  )}
                  {subscription.serviceConfig.ipAddress && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>IP Address</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', background: 'var(--bg-card)', padding: '3px 8px', borderRadius: 4 }}>{subscription.serviceConfig.ipAddress}</code>
                        <button onClick={() => copy(subscription.serviceConfig!.ipAddress!, 'ip')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                          {copied === 'ip' ? <RefreshCw size={13} color="var(--green)" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  )}
                  {subscription.serviceConfig.region && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Region</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{subscription.serviceConfig.region}</span>
                    </div>
                  )}
                  {subscription.renewsAt && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Next renewal</span>
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{new Date(subscription.renewsAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Confirmation number */}
            <div style={{ padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Subscription ID</span>
              <code style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{subscription.id.slice(0, 20)}...</code>
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 32, textAlign: 'center', marginBottom: 24 }}>
            <p style={{ color: 'var(--text-secondary)' }}>Your subscription is being activated. Check your dashboard for details.</p>
          </div>
        )}

        {/* Next steps */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>What happens next</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              '✅ A confirmation email has been sent to your inbox',
              '🚀 Your service is already live and ready to use',
              '📋 Manage everything from your dashboard',
              '💳 You will be billed again on your renewal date',
            ].map(s => (
              <div key={s} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s}</div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/dashboard" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
            <LayoutDashboard size={16} /> Go to Dashboard
          </Link>
          <Link href="/products" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
            Browse more <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="spinner" style={{ width: 36, height: 36 }} /></div>}>
      <SuccessContent />
    </Suspense>
  );
}
