'use client';
import { useEffect, useState } from 'react';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import Pagination from '@/components/ui/Pagination';
import Link from 'next/link';
import { paymentMethodLabel } from '@/lib/payment-labels';
import { CreditCard, Download, CheckCircle, XCircle, Clock } from 'lucide-react';

interface User { name: string; email: string; role: string; }
interface Payment {
  id: string; amount: number; currency: string; status: string;
  method: string; createdAt: string;
  subscription?: { product: { name: string }; plan: { name: string } };
  invoice?: { number: string } | null;
}

const statusIcon: Record<string, React.ReactNode> = {
  COMPLETED: <CheckCircle size={14} color="var(--green)" />,
  FAILED:    <XCircle    size={14} color="var(--red)" />,
  PENDING:   <Clock      size={14} color="var(--amber)" />,
};

interface ManualReq { id: string; reference: string; status: string; method: string; days: number; amount: number; product?: { name: string } }
const LIMIT = 8;

export default function BillingPage() {
  const [user,       setUser]       = useState<User | null>(null);
  const [payments,   setPayments]   = useState<Payment[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [totalSpend, setTotalSpend] = useState(0);
  const [monthSpend, setMonthSpend] = useState(0);
  const [manual,     setManual]     = useState<ManualReq[]>([]);

  /* first load: fetch all for summary figures */
  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}

    // UPI / bank-transfer orders that are still waiting on the customer or on us.
    fetch('/api/payments/manual').then(r => r.json())
      .then(d => setManual((d.data?.requests || []).filter((r: ManualReq) => r.status === 'AWAITING_PAYMENT' || r.status === 'SUBMITTED')))
      .catch(() => {});

    fetch('/api/payments?limit=200')
      .then(r => r.json())
      .then(d => {
        const all: Payment[] = d.data?.payments || [];
        const now = new Date();
        setTotalSpend(all.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + Number(p.amount), 0));
        setMonthSpend(
          all.filter(p => p.status === 'COMPLETED' && new Date(p.createdAt).getMonth() === now.getMonth() && new Date(p.createdAt).getFullYear() === now.getFullYear())
             .reduce((s, p) => s + Number(p.amount), 0)
        );
      });
  }, []);

  /* paginated fetch */
  useEffect(() => {
    setLoading(true);
    fetch(`/api/payments?limit=${LIMIT}&page=${page}`)
      .then(r => r.json())
      .then(d => {
        setPayments(d.data?.payments || []);
        setTotal(d.data?.meta?.total || 0);
        setLoading(false);
      });
  }, [page]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="page-shell">
      <DashboardSidebar user={user} />
      <main className="page-main">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Billing</h1>
            <p className="page-header-sub">Invoice history and payment records</p>
          </div>
        </div>

        <div className="page-content">
          {manual.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Bank / UPI payments in progress</div>
              {manual.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 0', fontSize: 13 }}>
                  <span>{m.product?.name} · {paymentMethodLabel(m.method)} · {m.days} days · ₹{Number(m.amount).toFixed(2)} · <span style={{ fontFamily: 'var(--font-mono)' }}>{m.reference}</span></span>
                  <Link href={`/checkout/manual/${m.id}`} className="btn btn-secondary btn-sm">{m.status === 'SUBMITTED' ? 'View status' : 'Complete payment'}</Link>
                </div>
              ))}
            </div>
          )}
          {/* Summary cards */}
          <div className="billing-grid">
            {[
              { label: 'Total Spend',  value: `₹${totalSpend.toFixed(2)}`, sub: 'All time',       color: 'var(--green)'  },
              { label: 'Invoices',     value: total,                        sub: 'Total records',  color: 'var(--accent)' },
              { label: 'This Month',   value: `₹${monthSpend.toFixed(2)}`,  sub: 'Current period', color: 'var(--purple)' },
            ].map(c => (
              <div key={c.label} className="billing-card">
                <div className="billing-card-label">{c.label}</div>
                <div className="billing-card-val" style={{ color: c.color }}>{c.value}</div>
                <div className="billing-card-sub">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Payment method */}
          <div className="card">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 16 }}>Payment Method</h2>
            <div className="pm-row">
              <div className="pm-icon"><CreditCard size={18} color="var(--accent-bright)" /></div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>•••• •••• •••• 4242</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Visa · Expires 12/27</div>
              </div>
              <div style={{ marginLeft: 'auto' }}><span className="badge badge-active">Default</span></div>
            </div>
          </div>

          {/* Invoice table */}
          <div className="table-wrap">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Invoice History</h2>
            </div>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <span className="spinner" style={{ width: 28, height: 28 }} />
              </div>
            ) : payments.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No payment records yet.</div>
            ) : (
              <>
                <table className="data-table">
                  <thead>
                    <tr><th>Invoice</th><th>Service</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th></th></tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {p.invoice?.number ?? (p.status === 'COMPLETED' ? 'Preparing…' : '—')}
                        </td>
                        <td>
                          {p.subscription ? (
                            <>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{p.subscription.product.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.subscription.plan.name}</div>
                            </>
                          ) : '—'}
                        </td>
                        <td style={{ fontSize: 14, fontWeight: 600 }}>₹{Number(p.amount).toFixed(2)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{paymentMethodLabel(p.method)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {statusIcon[p.status]}
                            <span className={`badge badge-${p.status === 'COMPLETED' ? 'active' : p.status === 'FAILED' ? 'inactive' : 'pending'}`} style={{ fontSize: 11 }}>
                              {p.status}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {new Date(p.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td>
                          {p.status === 'COMPLETED' && (
                            <Link href={`/invoices/${p.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 12, gap: 4 }}>
                              <Download size={12} /> Invoice
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage} />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
