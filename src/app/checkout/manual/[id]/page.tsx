'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Copy, Check, Clock, CheckCircle, XCircle, Smartphone, Landmark, ArrowLeft } from 'lucide-react';

interface Instructions {
  method: 'UPI' | 'BANK_TRANSFER';
  amount: number;
  reference: string;
  upi?: { upiId: string; payeeName: string; uri: string };
  bank?: { accountName: string; accountNumber: string; ifsc: string; bankName: string; branch: string | null; accountType: string };
}
interface Req {
  id: string; reference: string; status: string; method: 'UPI' | 'BANK_TRANSFER'; days: number; amount: number;
  transactionRef: string | null; payerDetails: string | null; expiresAt: string; reviewNote: string | null;
  subscriptionId: string | null;
  product?: { name: string }; plan?: { name: string; pricePerDay: number };
  instructions: Instructions | null;
}

function CopyRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: strong ? 17 : 14, fontWeight: strong ? 700 : 500, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{value}</div>
      </div>
      <button type="button" className="icon-btn" title="Copy" onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch {}
      }}>{done ? <Check size={15} color="var(--green)" /> : <Copy size={15} />}</button>
    </div>
  );
}

export default function ManualPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [req, setReq] = useState<Req | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [txRef, setTxRef] = useState('');
  const [payer, setPayer] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/payments/manual/${id}`);
    if (res.status === 401) { router.push(`/login?next=/checkout/manual/${id}`); return; }
    const d = await res.json();
    if (res.ok) setReq(d.data.request); else setError(d.error || 'Not found');
    setLoading(false);
  }, [id, router]);

  useEffect(() => { void load(); }, [load]);

  // While waiting for an admin to verify, refresh so approval shows up without a reload.
  useEffect(() => {
    if (req?.status !== 'SUBMITTED') return;
    const t = setInterval(() => { void load(); }, 15000);
    return () => clearInterval(t);
  }, [req?.status, load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const res = await fetch(`/api/payments/manual/${id}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionRef: txRef, payerDetails: payer || undefined }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error || 'Could not submit'); else setReq(d.data.request);
    } catch { setError('Network error. Please try again.'); }
    setSaving(false);
  }

  async function cancel() {
    if (!confirm('Cancel this payment request?')) return;
    const res = await fetch(`/api/payments/manual/${id}/cancel`, { method: 'POST' });
    if (res.ok) router.push('/products'); else { const d = await res.json(); setError(d.error || 'Could not cancel'); }
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="spinner" style={{ width: 32, height: 32 }} /></div>;
  if (!req) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <p>{error || 'Payment request not found'}</p><Link href="/products" className="btn btn-secondary btn-sm">Back to products</Link>
    </div>
  );

  const ins = req.instructions;
  const box = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 } as const;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }} className="grid-bg">
      <div className="container" style={{ maxWidth: 640, padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Link href="/billing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}><ArrowLeft size={14} /> My billing</Link>

        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 4 }}>
            {req.method === 'UPI' ? 'Pay by UPI' : 'Pay by bank transfer'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {req.product?.name} · {req.plan?.name} · {req.days} days
          </p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {req.status === 'APPROVED' && (
          <div style={{ ...box, textAlign: 'center' }}>
            <CheckCircle size={40} color="var(--green)" style={{ marginBottom: 8 }} />
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Payment confirmed</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Your service is active.</p>
            <Link href="/services" className="btn btn-primary">Go to my services</Link>
          </div>
        )}

        {req.status === 'REJECTED' && (
          <div style={{ ...box, borderColor: 'rgba(239,68,68,0.3)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}><XCircle size={22} color="var(--red)" /><b>We couldn&apos;t verify this payment</b></div>
            {req.reviewNote && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Reason: {req.reviewNote}</p>}
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>If you did pay, please <Link href="/contact" style={{ color: 'var(--accent-bright)' }}>contact us</Link> with reference <b>{req.reference}</b>.</p>
          </div>
        )}

        {(req.status === 'CANCELLED' || req.status === 'EXPIRED') && (
          <div style={box}>
            <p>This payment request is {req.status.toLowerCase()}.</p>
            <Link href="/products" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>Start a new order</Link>
          </div>
        )}

        {req.status === 'SUBMITTED' && (
          <div style={{ ...box, borderColor: 'rgba(245,158,11,0.35)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}><Clock size={22} color="var(--amber)" /><b>Waiting for confirmation</b></div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
              We&apos;ve received your transaction reference <b style={{ fontFamily: 'var(--font-mono)' }}>{req.transactionRef}</b>. Your service starts as soon as we confirm the money in our account — usually within a few business hours. You&apos;ll get an email, and this page updates by itself.
            </p>
          </div>
        )}

        {ins && (
          <div style={box}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
              {ins.method === 'UPI' ? <Smartphone size={20} color="var(--accent-bright)" /> : <Landmark size={20} color="var(--accent-bright)" />}
              <b style={{ fontSize: 15 }}>Send exactly ₹{ins.amount.toFixed(2)}</b>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
              Put the reference below in the payment remark so we can match it. Amount = ₹{req.plan?.pricePerDay.toFixed(2)} × {req.days} days.
            </p>
            <CopyRow label="Amount (₹)" value={ins.amount.toFixed(2)} strong />
            <CopyRow label="Reference / remark" value={ins.reference} strong />
            {ins.upi && (<>
              <CopyRow label="UPI ID" value={ins.upi.upiId} />
              <CopyRow label="Payee name" value={ins.upi.payeeName} />
              <a href={ins.upi.uri} className="btn btn-primary" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>Open my UPI app</a>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>On a computer? Scan or enter the UPI ID in your phone&apos;s UPI app.</p>
            </>)}
            {ins.bank && (<>
              <CopyRow label="Account name" value={ins.bank.accountName} />
              <CopyRow label="Account number" value={ins.bank.accountNumber} />
              <CopyRow label="IFSC" value={ins.bank.ifsc} />
              <CopyRow label="Bank" value={`${ins.bank.bankName}${ins.bank.branch ? ` — ${ins.bank.branch}` : ''}`} />
              <CopyRow label="Account type" value={ins.bank.accountType} />
            </>)}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
              Request valid until {new Date(req.expiresAt).toLocaleString('en-IN')}.
            </p>
          </div>
        )}

        {ins && (
          <form onSubmit={submit} style={box}>
            <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{req.status === 'SUBMITTED' ? 'Wrong reference? Update it' : 'After you have paid'}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Enter the UTR / transaction ID from your bank or UPI app.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Transaction / UTR number</label>
                <input className="input" value={txRef} onChange={e => setTxRef(e.target.value)} required minLength={6} maxLength={40} placeholder="e.g. 412345678901" /></div>
              <div><label className="label">Payer name or UPI ID (optional)</label>
                <input className="input" value={payer} onChange={e => setPayer(e.target.value)} maxLength={150} placeholder="Name on the account you paid from" /></div>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ justifyContent: 'center' }}>
                {saving ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "I've paid — submit for verification"}
              </button>
              {req.status === 'AWAITING_PAYMENT' && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}>Cancel this order</button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
