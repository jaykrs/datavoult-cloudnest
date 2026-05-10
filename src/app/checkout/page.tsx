'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Cloud, CreditCard, Lock, Check, ArrowLeft, Shield, Server, Package, Mail, ChevronDown, ChevronUp } from 'lucide-react';

interface Plan { id: string; name: string; price: number; billingCycle: string; isPopular: boolean; limits: Record<string, string>; }
interface Product { id: string; name: string; slug: string; description: string; category: string; features: string[]; plans: Plan[]; }

const catIcon: Record<string, React.ReactNode> = { VPS: <Server size={18} />, DOCKER: <Package size={18} />, EMAIL: <Mail size={18} /> };
const catColor: Record<string, string> = { VPS: 'var(--vps-color)', DOCKER: 'var(--docker-color)', EMAIL: 'var(--email-color)' };

function formatCard(val: string) {
  return val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(val: string) {
  const d = val.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
}

function CheckoutForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planId = searchParams.get('plan') || '';
  const productId = searchParams.get('product') || '';

  const [product, setProduct] = useState<Product | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment form
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [payMethod, setPayMethod] = useState<'CARD' | 'PAYPAL' | 'CRYPTO'>('CARD');
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || !product) return;
    setError('');

    // Card validation
    if (payMethod === 'CARD') {
      if (cardNumber.replace(/\s/g, '').length < 16) { setError('Please enter a valid 16-digit card number.'); return; }
      if (expiry.length < 5) { setError('Please enter a valid expiry date (MM/YY).'); return; }
      if (cvv.length < 3) { setError('Please enter a valid CVV.'); return; }
      if (!cardName.trim()) { setError('Please enter the name on card.'); return; }
    }

    setProcessing(true);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, planId: plan.id, paymentMethod: payMethod }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Subscription failed. Please try again.'); setProcessing(false); return; }
      router.push(`/checkout/success?sub=${data.data?.subscription?.id}`);
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
                {/* Payment method selector */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
                  <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Payment method</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
                    {(['CARD', 'PAYPAL', 'CRYPTO'] as const).map(m => (
                      <button key={m} type="button" onClick={() => setPayMethod(m)}
                        className={`method-btn${payMethod === m ? ' active' : ''}`}
                        style={{ padding: '12px 8px', borderRadius: 'var(--radius-md)', border: `1px solid ${payMethod === m ? 'var(--accent)' : 'var(--border)'}`, background: payMethod === m ? 'var(--accent-glow)' : 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: payMethod === m ? 'var(--accent-bright)' : 'var(--text-secondary)' }}>
                        <span style={{ fontSize: 20 }}>{m === 'CARD' ? '💳' : m === 'PAYPAL' ? '🅿️' : '₿'}</span>
                        {m === 'CARD' ? 'Credit Card' : m === 'PAYPAL' ? 'PayPal' : 'Crypto'}
                      </button>
                    ))}
                  </div>

                  {payMethod === 'CARD' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label className="label">Name on card</label>
                        <input className="input checkout-input" value={cardName} onChange={e => setCardName(e.target.value)} placeholder="John Doe" required />
                      </div>
                      <div>
                        <label className="label">Card number</label>
                        <div style={{ position: 'relative' }}>
                          <input className="input checkout-input" value={cardNumber} onChange={e => setCardNumber(formatCard(e.target.value))} placeholder="1234 5678 9012 3456" maxLength={19} required style={{ paddingRight: 48, fontFamily: 'var(--font-mono)', letterSpacing: 2 }} />
                          <CreditCard size={16} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label className="label">Expiry date</label>
                          <input className="input checkout-input" value={expiry} onChange={e => setExpiry(formatExpiry(e.target.value))} placeholder="MM/YY" maxLength={5} required style={{ fontFamily: 'var(--font-mono)' }} />
                        </div>
                        <div>
                          <label className="label">CVV</label>
                          <input className="input checkout-input" value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="•••" maxLength={4} required style={{ fontFamily: 'var(--font-mono)' }} />
                        </div>
                      </div>
                      {/* Demo card hint */}
                      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>Demo card (click to fill)</div>
                        <button type="button" onClick={() => { setCardName('John Doe'); setCardNumber('4242 4242 4242 4242'); setExpiry('12/27'); setCvv('123'); }}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-bright)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          4242 4242 4242 4242 · 12/27 · 123
                        </button>
                      </div>
                    </div>
                  )}

                  {payMethod === 'PAYPAL' && (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>🅿️</div>
                      <p>You will be redirected to PayPal to complete your payment securely.</p>
                    </div>
                  )}

                  {payMethod === 'CRYPTO' && (
                    <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: 14 }}>
                      <div style={{ fontSize: 40, marginBottom: 12 }}>₿</div>
                      <p>A Bitcoin/Ethereum address will be generated after confirming your order.</p>
                    </div>
                  )}
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
