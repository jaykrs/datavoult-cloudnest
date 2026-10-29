'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Cloud, Lock, Check, ArrowLeft, Shield, Server, Package, Mail, ChevronDown, ChevronUp, CreditCard, Smartphone, Landmark } from 'lucide-react';
import { MIN_ORDER_DAYS, MAX_ORDER_DAYS, computeOrderAmounts, gstSettingFrom } from '@/lib/pricing';
import { GST_STATES } from '@/lib/gst';

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

/** `price` is the cost of ONE DAY in ₹. */
interface Plan { id: string; name: string; price: number; isPopular: boolean; limits: Record<string, string>; }
type PayMethod = 'RAZORPAY' | 'UPI' | 'BANK_TRANSFER';
const DAY_PRESETS = [30, 60, 90, 180, 365];
interface Product { id: string; name: string; slug: string; description: string; category: string; features: string[]; plans: Plan[]; gstRate?: string | number | null; gstInclusive?: boolean; }
interface BillingProfile { billingName: string; billingGstin: string; billingAddress: string; billingStateCode: string }

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
  // Days of service to buy: per-day price × days, minimum 30.
  const [days, setDays] = useState<number>(MIN_ORDER_DAYS);
  const [daysText, setDaysText] = useState(String(MIN_ORDER_DAYS));
  const [bank, setBank] = useState<{ accountName: string; accountNumber: string; ifsc: string; bankName: string; branch: string | null; accountType: string } | null>(null);
  const [method, setMethod] = useState<PayMethod>('RAZORPAY');
  const [manualAvailable, setManualAvailable] = useState<{ UPI: boolean; BANK_TRANSFER: boolean }>({ UPI: false, BANK_TRANSFER: false });

  // Invoice details (saved to the account before paying, so the invoice is right the moment payment lands).
  const [bill, setBill] = useState<BillingProfile>({ billingName: '', billingGstin: '', billingAddress: '', billingStateCode: '' });

  const daysValid = Number.isInteger(days) && days >= MIN_ORDER_DAYS && days <= MAX_ORDER_DAYS;
  function changeDays(text: string) {
    setDaysText(text);
    setDays(text.trim() === '' ? NaN : Number(text));
  }

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (!stored) { router.push(`/login?next=/checkout?plan=${planId}&product=${productId}`); return; }
    try { setUser(JSON.parse(stored)); } catch {}

    if (!productId) { router.push('/products'); return; }
    fetch('/api/billing-profile').then(r => r.json()).then(d => {
      const pr = d.data?.profile;
      if (pr) setBill({ billingName: pr.billingName || '', billingGstin: pr.billingGstin || '', billingAddress: pr.billingAddress || '', billingStateCode: pr.billingStateCode || '' });
    }).catch(() => {});
    fetch('/api/payments/manual').then(r => r.json()).then(d => { if (d.data?.methods) setManualAvailable(d.data.methods); if (d.data?.bank) setBank(d.data.bank); }).catch(() => {});
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

  /** Save invoice details; returns false (with an error shown) if the server rejects them. */
  async function saveBillingProfile(): Promise<boolean> {
    const res = await fetch('/api/billing-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        billingName: bill.billingName || null,
        billingGstin: bill.billingGstin.trim() || null,
        billingAddress: bill.billingAddress || null,
        billingStateCode: bill.billingStateCode || null,
      }),
    });
    if (res.ok) return true;
    const d = await res.json().catch(() => ({}));
    setError(d.error || 'Could not save your billing details.');
    return false;
  }

  /** UPI / bank transfer: create the request, then show the payment instructions. */
  async function startManualPayment(m: 'UPI' | 'BANK_TRANSFER') {
    if (!plan || !product) return;
    const res = await fetch('/api/payments/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, planId: plan.id, days, method: m, ...(renewId && { subscriptionId: renewId }) }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'Could not create the payment request.'); setProcessing(false); return; }
    // Bank transfer: details were already shown here, so go to the dashboard; the admin verifies the credit and provisions.
    if (m === 'BANK_TRANSFER') { router.push(`/dashboard?payment=submitted&request=${encodeURIComponent(data.data.request.id)}`); return; }
    router.push(`/checkout/manual/${data.data.request.id}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan || !product || processing) return;
    setError('');
    if (!daysValid) { setError(`Enter a whole number of days between ${MIN_ORDER_DAYS} and ${MAX_ORDER_DAYS}.`); return; }
    setProcessing(true);

    try {
      if (!(await saveBillingProfile())) { setProcessing(false); return; }
    } catch { setError('Network error. Please try again.'); setProcessing(false); return; }

    if (method !== 'RAZORPAY') {
      try { await startManualPayment(method); } catch { setError('Network error. Please try again.'); setProcessing(false); }
      return;
    }

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
        body: JSON.stringify({ productId: product.id, planId: plan.id, days, ...(renewId && { subscriptionId: renewId }) }),
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
  const perDay = Number(plan.price);
  const gstSetting = gstSettingFrom({ gstRate: product.gstRate === undefined || product.gstRate === null ? null : Number(product.gstRate), gstInclusive: product.gstInclusive });
  const amounts = daysValid ? computeOrderAmounts(perDay, days, gstSetting) : { basePaise: 0, gstPaise: 0, totalPaise: 0, rate: gstSetting.rate ?? 0 };
  const total = amounts.totalPaise / 100;

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
                {/* Duration: price is per day, minimum 30 days */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
                  <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>How many days?</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>
                    ₹{perDay.toFixed(2)} per day · minimum {MIN_ORDER_DAYS} days
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {DAY_PRESETS.map(d => (
                      <button key={d} type="button" onClick={() => changeDays(String(d))}
                        className={`btn btn-sm ${days === d ? 'btn-primary' : 'btn-secondary'}`}>{d} days</button>
                    ))}
                  </div>
                  <input className="input checkout-input" type="number" inputMode="numeric" min={MIN_ORDER_DAYS} max={MAX_ORDER_DAYS} step={1}
                    value={daysText} onChange={e => changeDays(e.target.value)} style={{ maxWidth: 160 }} aria-label="Number of days" />
                  {!daysValid && (
                    <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>
                      Enter a whole number of days from {MIN_ORDER_DAYS} to {MAX_ORDER_DAYS}.
                    </div>
                  )}
                </div>

                {/* Payment method */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
                  <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Payment method</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {([
                      { id: 'RAZORPAY', icon: <CreditCard size={18} />, title: 'Card, UPI, netbanking, wallets', sub: 'Pay online through Razorpay — service starts instantly.', on: true },
                      { id: 'UPI', icon: <Smartphone size={18} />, title: 'UPI transfer (manual)', sub: 'Pay to our UPI ID. Activated once we confirm the payment.', on: manualAvailable.UPI },
                      { id: 'BANK_TRANSFER', icon: <Landmark size={18} />, title: 'Bank transfer (NEFT / IMPS / RTGS)', sub: 'Transfer to our current account. Activated once we confirm the payment.', on: manualAvailable.BANK_TRANSFER },
                    ] as const).map(m => (
                      <label key={m.id} className={`method-btn${method === m.id ? ' active' : ''}`}
                        style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', opacity: m.on ? 1 : 0.5, cursor: m.on ? 'pointer' : 'not-allowed' }}>
                        <input type="radio" name="method" checked={method === m.id} disabled={!m.on} onChange={() => setMethod(m.id)} style={{ marginTop: 3 }} />
                        <span style={{ color: 'var(--accent-bright)', marginTop: 1 }}>{m.icon}</span>
                        <span>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{m.title}</span>
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{m.on ? m.sub : 'Currently unavailable — please use another method or contact support.'}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginTop: 12 }}>
                    Online payments start your service instantly. Offline (UPI / bank) payments are verified by our team, who then provision your service.
                  </p>
                  {method === 'BANK_TRANSFER' && bank && (
                    <div style={{ marginTop: 14, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: 13 }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Transfer to this account (NEFT / IMPS / RTGS)</div>
                      {([['Account name', bank.accountName], ['Account number', bank.accountNumber], ['IFSC', bank.ifsc],
                        ['Bank', `${bank.bankName}${bank.branch ? ` — ${bank.branch}` : ''}`], ['Account type', bank.accountType]] as const).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
                        </div>
                      ))}
                      <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8, lineHeight: 1.6 }}>
                        Click “Continue” to place the order — you&apos;ll get a payment reference to put in the transfer remark. Our team verifies the credit and then provisions your server.
                      </p>
                    </div>
                  )}
                  {method === 'RAZORPAY' && (
                    <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginTop: 12 }}>
                      Card details are entered in Razorpay&apos;s secure window and never touch our servers.
                    </p>
                  )}
                </div>

                {/* Invoice / billing details */}
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
                  <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Billing details (for your invoice)</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 14 }}>
                    Add your GSTIN if you are GST-registered. Your state decides whether GST is shown as CGST + SGST or IGST.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label className="label">Name / company</label>
                      <input className="input checkout-input" value={bill.billingName} onChange={e => setBill({ ...bill, billingName: e.target.value })} placeholder={user?.name || 'Name on the invoice'} maxLength={150} />
                    </div>
                    <div>
                      <label className="label">GSTIN (optional)</label>
                      <input className="input checkout-input" value={bill.billingGstin}
                        onChange={e => {
                          const g = e.target.value.toUpperCase();
                          // The first two digits of a GSTIN are the state code.
                          setBill({ ...bill, billingGstin: g, billingStateCode: /^\d{2}/.test(g) && GST_STATES[g.slice(0, 2)] ? g.slice(0, 2) : bill.billingStateCode });
                        }}
                        placeholder="29ABCDE1234F1Z5" maxLength={15} style={{ fontFamily: 'var(--font-mono)' }} />
                    </div>
                    <div>
                      <label className="label">State</label>
                      <select className="input checkout-input" value={bill.billingStateCode} onChange={e => setBill({ ...bill, billingStateCode: e.target.value })} style={{ cursor: 'pointer' }}>
                        <option value="">Select state…</option>
                        {Object.entries(GST_STATES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <label className="label">Billing address</label>
                      <textarea className="input checkout-input" rows={3} value={bill.billingAddress} onChange={e => setBill({ ...bill, billingAddress: e.target.value })} maxLength={500} placeholder="Street, city, PIN code" style={{ resize: 'vertical' }} />
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <button type="submit" disabled={processing} className="btn btn-primary" style={{ padding: '16px 28px', fontSize: 16, justifyContent: 'center', width: '100%', position: 'relative' }}>
                  {processing ? (
                    <><span className="spinner" style={{ width: 18, height: 18 }} /> {method === 'RAZORPAY' ? 'Processing payment...' : 'Creating your order...'}</>
                  ) : method === 'RAZORPAY' ? (
                    <><Lock size={16} /> Pay ₹{total.toFixed(2)} · Start service</>
                  ) : (
                    <>Continue · ₹{total.toFixed(2)} by {method === 'UPI' ? 'UPI' : 'bank transfer'}</>
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
                      <span>₹{perDay.toFixed(2)} / day</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Duration</span>
                      <span>{daysValid ? days : '—'} days</span>
                    </div>
                    {amounts.rate > 0 ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Subtotal{gstSetting.inclusive ? ' (excl. GST)' : ''}</span>
                          <span>₹{(amounts.basePaise / 100).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>GST @ {amounts.rate}%{gstSetting.inclusive ? ' (included)' : ''}</span>
                          <span>₹{(amounts.gstPaise / 100).toFixed(2)}</span>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Total */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>Total today</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color }}>₹{total.toFixed(2)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>₹{perDay.toFixed(2)} × {daysValid ? days : '—'} days{amounts.rate > 0 && !gstSetting.inclusive ? ' + GST' : ''}</div>
                  </div>
                </div>

                {/* Trust signals */}
                <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { icon: <Check size={13} />, text: 'Online payments activate instantly; UPI / bank transfers once we confirm the money' },
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
                        <span style={{ fontWeight: 600, color: p.id === plan.id ? color : undefined }}>₹{Number(p.price).toFixed(2)}/day</span>
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
