'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Cloud, Lock, Check, ArrowLeft, Shield, Server, Package, Mail, ChevronDown, ChevronUp } from 'lucide-react';

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance { open(): void; on(event: string, cb: (r: any) => void): void }
declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance }
}

/** Load Razorpay Checkout once; resolves false if the script cannot be loaded. */
function loadRazorpay(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(Boolean(window.Razorpay));
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

interface Plan { id: string; name: string; price: number; billingCycle: string; isPopular: boolean; limits: Record<string, string>; }
interface Product { id: string; name: string; slug: string; description: string; category: string; features: string[]; plans: Plan[]; }

const catIcon: Record<string, React.ReactNode> = { VPS: <Server size={18} />, DOCKER: <Package size={18} />, EMAIL: <Mail size={18} /> };
const catColor: Record<string, string> = { VPS: 'var(--vps-color)', DOCKER: 'var(--docker-color)', EMAIL: 'var(--email-color)' };

function CheckoutForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planId = searchParams.get('plan') || '';
  const productId = searchParams.get('product') || '';
  // Set when renewing an existing subscription instead of buying a new one.
  const renewId = searchParams.get('renew') || '';

  const [product, setProduct] = useState<Product | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Card details are entered in Razorpay's hosted window — never in this page.
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (!stored) { router.push(`/login?next=/checkout?plan=${planId}&product=${productId}`); return; }
    try { setUser(JSON.parse(stored)); } catch {}

    if (!productId) { router.push('/products'); return; }
    fetch(`/api/products/${productId}`)
      .then(r => r.json())
      .then(d => {
        const p: Product = d.data?.product;
        if (!p) { router.push('/products'); return; }
        setProduct(p);
        const selectedPlan = p.plans.find(pl => pl.id === planId) || p.plans[0];
        setPlan(selectedPlan);
        setLoading(false);
      });
  }, [planId, productId, router]);

  /** Ask the server to verify the payment. It may need a few seconds to be captured. */
  async function confirmPayment(resp: RazorpaySuccess) {
    const MAX_ATTEMPTS = 6;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch('/api/razorpay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resp),
        });
        const data = await res.json();

        if (res.ok) {
          router.push(`/checkout/success?sub=${data.data?.subscription?.id ?? ''}`);
          return;
        }
        if (res.status !== 202) {
          setError(data.error || 'We could not confirm your payment. If you were charged, please contact support.');
          setProcessing(false);
          return;
        }
      } catch {
        // network blip — fall through and retry; verification is idempotent
      }
      await new Promise((r) => setTimeout(r, 2500));
    }
    // Still confirming: the payment webhook will activate the service on its own.
    router.push('/services');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || !product || processing) return;
    setError('');
    setProcessing(true);

    try {
      if (!(await loadRazorpay())) {
        setError('Could not load the secure payment window. Check your connection and try again.');
        setProcessing(false);
        return;
      }

      // The server prices the order from the plan — the browser never sends an amount.
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, planId: plan.id, ...(renewId && { subscriptionId: renewId }) }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        setError(orderData.error || 'Could not start the payment. Please try again.');
        setProcessing(false);
        return;
      }
      const o = orderData.data;

      const rzp = new window.Razorpay!({
        key: o.keyId,
        order_id: o.orderId,
        amount: o.amount,
        currency: o.currency,
        name: 'DataVoult',
        description: `${product.name} — ${plan.name}`,
        prefill: { name: o.userName, email: o.userEmail },
        theme: { color: '#3b82f6' },
        handler: (resp: RazorpaySuccess) => { void confirmPayment(resp); },
        modal: { ondismiss: () => setProcessing(false) },
      });
      rzp.on('payment.failed', (r: { error?: { description?: string } }) => {
        setError(r.error?.description || 'The payment failed. You have not been charged.');
        setProcessing(false);
      });
      rzp.open();
    } catch {
      setError('Network error. Please check your connection and try again.');
      setProcessing(false);
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
      <span className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );

  if (!product || !plan) return null;

  const color = catColor[product.category] || 'var(--accent)';
  const annualSave = plan.billingCycle === 'ANNUAL' ? (plan.price / 12).toFixed(2) : null;
  const tax = (plan.price * 0.0).toFixed(2); // 0% for demo
  const total = Number(plan.price);

  return (
    <>
      <style>{`
        .method-btn { transition: border-color 0.15s, background 0.15s; cursor: pointer; }
        .method-btn:hover { border-color: var(--accent) !important; }
        .method-btn.active { border-color: var(--accent) !important; background: var(--accent-glow) !important; }
        .checkout-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
      `}</style>
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }} className="grid-bg">
        {/* Top bar */}
        <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(5,8,15,0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50 }}>
          <Link href={`/products/${product.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
            <ArrowLeft size={15} /> Back
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: 'var(--accent)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cloud size={15} color="white" />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>DataVoult</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--green)' }}>
            <Lock size={12} /> Secure checkout
          </div>
        </div>

        <div className="container" style={{ padding: '40px 24px', maxWidth: 960 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32, alignItems: 'start' }}>

            {/* ── LEFT: Payment form ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 4 }}>Complete your order</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  Signed in as <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{user?.email}</span>
                </p>
              </div>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, color: 'var(--red)' }}>
                  ⚠️ {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Payment: handled entirely by Razorpay's hosted window */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
                  <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Payment</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                    You will pay in a secure Razorpay window. Cards, UPI, netbanking and wallets are supported.
                    Your card details go straight to Razorpay and never touch our servers.
                  </p>
                </div>

                {/* Billing address */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
                  <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Billing details</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label className="label">Full name</label>
                      <input className="input checkout-input" defaultValue={user?.name || ''} placeholder="John Doe" required />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label className="label">Email</label>
                      <input className="input" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
                    </div>
                    <div>
                      <label className="label">Country</label>
                      <select className="input checkout-input" style={{ cursor: 'pointer' }}>
                        <option>India</option>
                        <option>United Kingdom</option>
                        <option>Germany</option>
                        <option>France</option>
                        <option>United States</option>
                        <option>Australia</option>
                        <option>Canada</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">ZIP / Postal code</label>
                      <input className="input checkout-input" placeholder="10001" />
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <button type="submit" disabled={processing} className="btn btn-primary" style={{ padding: '16px 28px', fontSize: 16, justifyContent: 'center', width: '100%', position: 'relative' }}>
                  {processing ? (
                    <><span className="spinner" style={{ width: 18, height: 18 }} /> Processing payment...</>
                  ) : (
                    <><Lock size={16} /> Pay ₹{Number(total).toFixed(2)} · Start service</>
                  )}
                </button>

                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  🔒 256-bit SSL encryption · Cancel anytime · 30-day money-back guarantee
                </p>
              </form>
            </div>

            {/* ── RIGHT: Order summary ── */}
            <div style={{ position: 'sticky', top: 80 }}>
              {/* Mobile collapse toggle */}
              <button type="button" onClick={() => setShowSummary(!showSummary)}
                style={{ display: 'none', width: '100%', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 16, cursor: 'pointer', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-body)' }}
                id="summary-toggle">
                <span>Order summary</span>
                {showSummary ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                {/* Product header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {catIcon[product.category]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{product.name}</div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className={`badge badge-${product.category.toLowerCase()}`} style={{ fontSize: 11 }}>{product.category}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{plan.name} Plan</span>
                    </div>
                  </div>
                </div>

                {/* Plan limits */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Plan includes</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {Object.entries(plan.limits).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k}</span>
                        <span style={{ fontWeight: 600, color }}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Billing */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Billing</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{plan.name} plan</span>
                      <span>₹{Number(plan.price).toFixed(2)}</span>
                    </div>
                    {annualSave && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--green)' }}>
                        <span>Annual discount (20% off)</span>
                        <span>–₹{(Number(annualSave) * 12 * 0.25).toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>Tax</span>
                      <span>₹{tax}</span>
                    </div>
                  </div>
                </div>

                {/* Total */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Total today</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color }}>₹{total.toFixed(2)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>then ₹{total.toFixed(2)} / {plan.billingCycle.toLowerCase()}</div>
                  </div>
                </div>

                {/* Trust signals */}
                <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { icon: <Check size={13} />, text: 'Service activates instantly after payment' },
                    { icon: <Shield size={13} />, text: '30-day money-back guarantee' },
                    { icon: <Lock size={13} />, text: 'Cancel anytime, no lock-in' },
                  ].map(t => (
                    <div key={t.text} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--green)' }}>{t.icon}</span>
                      {t.text}
                    </div>
                  ))}
                </div>
              </div>

              {/* Plan switcher */}
              {product.plans.length > 1 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Switch plan:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {product.plans.map(p => (
                      <Link key={p.id} href={`/checkout?plan=${p.id}&product=${productId}`}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: p.id === plan.id ? 'var(--bg-hover)' : 'var(--bg-card)', border: `1px solid ${p.id === plan.id ? 'var(--accent)44' : 'var(--border)'}`, fontSize: 13, color: p.id === plan.id ? 'var(--text-primary)' : 'var(--text-secondary)', textDecoration: 'none', transition: 'all 0.15s' }}>
                        <span>{p.name}</span>
                        <span style={{ fontWeight: 600, color: p.id === plan.id ? color : undefined }}>₹{p.price}/mo</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="spinner" style={{ width: 36, height: 36 }} /></div>}>
      <CheckoutForm />
    </Suspense>
  );
}
