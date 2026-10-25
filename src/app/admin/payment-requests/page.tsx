'use client';
import { useCallback, useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import Pagination from '@/components/ui/Pagination';
import { Search, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface User { name: string; email: string; role: string; }
interface Row {
  id: string; reference: string; status: string; method: 'UPI' | 'BANK_TRANSFER'; days: number; amount: number; pricePerDay: number;
  renewal: boolean; transactionRef: string | null; payerDetails: string | null; submittedAt: string | null; expiresAt: string;
  reviewedAt: string | null; reviewNote: string | null; createdAt: string;
  user: { name: string; email: string }; product: { name: string }; plan: { name: string };
  sameReferenceAs: string[];
}

const LIMIT = 10;
const FILTERS = [
  { v: 'SUBMITTED', label: 'To verify' }, { v: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
  { v: 'APPROVED', label: 'Approved' }, { v: 'REJECTED', label: 'Rejected' }, { v: '', label: 'All' },
];
const badgeClass = (s: string) => (s === 'APPROVED' ? 'active' : s === 'SUBMITTED' || s === 'AWAITING_PAYMENT' ? 'pending' : 'inactive');
const inr = (n: number) => `₹${n.toFixed(2)}`;
const fmt = (d: string | null) => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';

export default function AdminPaymentRequestsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('SUBMITTED');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [toVerify, setToVerify] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [approving, setApproving] = useState<Row | null>(null);
  const [received, setReceived] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/payment-requests?status=${status}&search=${encodeURIComponent(search)}&limit=${LIMIT}&page=${page}`)
      .then(r => r.json())
      .then(d => { setRows(d.data?.requests || []); setTotal(d.data?.meta?.total || 0); setToVerify(d.data?.toVerify || 0); })
      .finally(() => setLoading(false));
  }, [status, search, page]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function approve() {
    if (!approving) return;
    setBusy(approving.id); setMsg(null);
    const res = await fetch(`/api/admin/payment-requests/${approving.id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receivedAmount: Number(received), note: note || undefined }),
    });
    const d = await res.json();
    setBusy(null);
    setMsg({ ok: res.ok, text: res.ok ? `Approved ${approving.reference} — service activated.` : d.error || 'Failed to approve' });
    if (res.ok) { setApproving(null); setReceived(''); setNote(''); load(); }
  }

  async function reject(r: Row) {
    const reason = prompt(`Reject ${r.reference}? Tell the customer why (they will be emailed):`, 'We could not find this payment in our account.');
    if (!reason) return;
    setBusy(r.id); setMsg(null);
    const res = await fetch(`/api/admin/payment-requests/${r.id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
    });
    const d = await res.json();
    setBusy(null);
    setMsg({ ok: res.ok, text: res.ok ? `Rejected ${r.reference}.` : d.error || 'Failed to reject' });
    if (res.ok) load();
  }

  return (
    <div className="page-shell">
      <AdminSidebar user={user} />
      <main className="page-main">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Payment requests</h1>
            <p className="page-header-sub">UPI &amp; bank transfers · {toVerify} waiting for verification</p>
          </div>
        </div>
        <div className="page-content">
          {msg && <div className={msg.ok ? undefined : 'auth-error'} style={msg.ok ? { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--green)', padding: '10px 14px', borderRadius: 8, fontSize: 13 } : undefined}>{msg.text}</div>}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', maxWidth: 340, flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="input" style={{ paddingLeft: 40 }} placeholder="Reference, UTR, name or email…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {FILTERS.map(f => (
                <button key={f.label} type="button" className={`btn btn-sm ${status === f.v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setStatus(f.v); setPage(1); }}>{f.label}</button>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Reference</th><th>Customer</th><th>Order</th><th>Amount</th><th>UTR / payer</th><th>Status</th><th /></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center' }}><span className="spinner" style={{ width: 28, height: 28, display: 'inline-block' }} /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Nothing here</td></tr>
                ) : rows.map(r => {
                  const open = r.status === 'SUBMITTED' || r.status === 'AWAITING_PAYMENT';
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}>{r.reference}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.method === 'UPI' ? 'UPI' : 'Bank transfer'} · {fmt(r.submittedAt || r.createdAt)}</div>
                      </td>
                      <td><div style={{ fontSize: 14, fontWeight: 500 }}>{r.user.name}</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.user.email}</div></td>
                      <td style={{ fontSize: 13 }}>
                        {r.product.name}<div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.plan.name} · {r.days} days{r.renewal ? ' · renewal' : ''}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{inr(r.amount)}<div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{inr(r.pricePerDay)} × {r.days}</div></td>
                      <td style={{ fontSize: 13 }}>
                        {r.transactionRef ? <span style={{ fontFamily: 'var(--font-mono)' }}>{r.transactionRef}</span> : <span style={{ color: 'var(--text-muted)' }}>not entered</span>}
                        {r.payerDetails && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.payerDetails}</div>}
                        {r.sameReferenceAs.length > 0 && (
                          <div style={{ fontSize: 12, color: 'var(--red)', display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                            <AlertTriangle size={12} /> Also on {r.sameReferenceAs.join(', ')}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${badgeClass(r.status)}`}>{r.status.replace('_', ' ')}</span>
                        {r.reviewNote && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, maxWidth: 160 }}>{r.reviewNote}</div>}
                      </td>
                      <td>
                        {open && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => { setApproving(r); setReceived(''); setNote(''); setMsg(null); }}><CheckCircle size={13} /> Approve</button>
                            <button type="button" className="btn btn-secondary btn-sm" disabled={busy === r.id} onClick={() => reject(r)}><XCircle size={13} /> Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} totalPages={Math.ceil(total / LIMIT)} total={total} limit={LIMIT} onPageChange={setPage} />
          </div>
        </div>

        {approving && (
          <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 28, width: '100%', maxWidth: 460 }}>
              <h2 style={{ fontSize: 20, marginBottom: 6 }}>Approve {approving.reference}</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                Open your bank statement and confirm the credit before approving.
                Look for <b>{inr(approving.amount)}</b>{approving.transactionRef && <> with UTR <b style={{ fontFamily: 'var(--font-mono)' }}>{approving.transactionRef}</b></>} or remark <b style={{ fontFamily: 'var(--font-mono)' }}>{approving.reference}</b>.
              </p>
              {approving.sameReferenceAs.length > 0 && (
                <div className="auth-error" style={{ marginBottom: 12 }}>This UTR was also entered on {approving.sameReferenceAs.join(', ')}. Make sure it isn&apos;t being reused.</div>
              )}
              <label className="label">Amount you received (₹)</label>
              <input className="input" type="number" step="0.01" min="0" value={received} onChange={e => setReceived(e.target.value)} placeholder={`Must equal ${approving.amount.toFixed(2)}`} autoFocus />
              <label className="label" style={{ marginTop: 12 }}>Note (optional)</label>
              <input className="input" value={note} onChange={e => setNote(e.target.value)} maxLength={190} placeholder="e.g. credited 24 Oct, HDFC statement" />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setApproving(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={busy === approving.id || !received} onClick={approve}>
                  {busy === approving.id ? <span className="spinner" style={{ width: 15, height: 15 }} /> : 'Approve & activate'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
