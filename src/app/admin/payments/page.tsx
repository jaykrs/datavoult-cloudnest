'use client';
import { paymentMethodLabel } from '@/lib/payment-labels';
import { CATEGORY_LABELS, type PaymentCategory } from '@/lib/gateway-approval';
import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import Pagination from '@/components/ui/Pagination';
import { TrendingUp, IndianRupee, CheckCircle, XCircle, Clock } from 'lucide-react';

interface User { name: string; email: string; role: string; }
interface AdminPayment {
  id: string; amount: number; currency: string; status: string; method: string; createdAt: string;
  user: { name: string; email: string };
  subscription?: { product: { name: string }; plan: { name: string } };
  invoice?: { number: string } | null;
  category: PaymentCategory; awaitingApproval: boolean; gatewayRef: string | null;
}

const statusIcon: Record<string, React.ReactNode> = {
  COMPLETED: <CheckCircle size={13} color="var(--green)" />,
  FAILED:    <XCircle    size={13} color="var(--red)" />,
  PENDING:   <Clock      size={13} color="var(--amber)" />,
};

const LIMIT = 10;

export default function AdminPaymentsPage() {
  const [user,         setUser]         = useState<User | null>(null);
  const [payments,     setPayments]     = useState<AdminPayment[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page,         setPage]         = useState(1);
  const [total,        setTotal]        = useState(0);
  const [summary,      setSummary]      = useState({ revenue: 0, count: 0, success: 0, failed: 0 });

  const [pendingApproval, setPendingApproval] = useState(0);
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
    const f = new URLSearchParams(window.location.search).get('approval');
    if (f === 'pending') setStatusFilter('APPROVAL');
    fetch('/api/admin/stats').then(r => r.json()).then(d => {
      const all: AdminPayment[] = d.data?.recentPayments || [];
      setSummary({
        revenue: all.filter(p => p.status === 'COMPLETED').reduce((s,p) => s + Number(p.amount), 0),
        count:   all.length,
        success: all.filter(p => p.status === 'COMPLETED').length,
        failed:  all.filter(p => p.status === 'FAILED').length,
      });
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = statusFilter === 'APPROVAL' ? '&approval=pending' : statusFilter !== 'all' ? `&status=${statusFilter}` : '';
    fetch(`/api/admin/payments?limit=${LIMIT}&page=${page}${q}`).then(r => r.json()).then(d => {
      setPayments(d.data?.payments || []);
      setTotal(d.data?.meta?.total ?? 0);
      setPendingApproval(d.data?.pendingApproval ?? 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [statusFilter, page, reload]);

  async function approve(id: string) {
    if (!confirm('Confirm you have checked this payment in the Razorpay dashboard? After approving you can provision the server.')) return;
    setBusyId(id); setError('');
    const res = await fetch(`/api/admin/payments/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Could not approve'); }
    setBusyId(null); setReload(n => n + 1);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="page-shell">
      <AdminSidebar user={user} />
      <main className="page-main">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Payments</h1>
            <p className="page-header-sub">Transaction history and revenue tracking</p>
          </div>
        </div>

        <div className="page-content">
          <div className="stats-grid">
            {[
              { icon: <IndianRupee size={18} />, label: 'Total Revenue',  value: `₹${summary.revenue.toFixed(2)}`, color: 'var(--green)'  },
              { icon: <TrendingUp size={18} />, label: 'Transactions',   value: summary.count,                   color: 'var(--accent)' },
              { icon: <CheckCircle size={18}/>, label: 'Successful',     value: summary.success,                 color: 'var(--green)'  },
              { icon: <XCircle size={18} />,   label: 'Failed',          value: summary.failed,                  color: 'var(--red)'    },
            ].map(s => (
              <div key={s.label} className="card">
                <div className="stat-card-inner">
                  <div className="billing-card-label">{s.label}</div>
                  <div style={{ color: s.color }}>{s.icon}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="filter-bar">
            {['all','APPROVAL','COMPLETED','PENDING','FAILED','REFUNDED'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`btn btn-sm${statusFilter === s ? ' btn-primary' : ' btn-secondary'}`}>
                {s === 'all' ? 'All' : s === 'APPROVAL' ? `Needs approval${pendingApproval ? ` (${pendingApproval})` : ''}` : s}
              </button>
            ))}
          </div>

          {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Transaction</th><th>User</th><th>Service</th><th>Amount</th><th>Category</th><th>Status</th><th>Date</th><th>Invoice</th><th></th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ padding: 48, textAlign: 'center' }}><span className="spinner" style={{ width: 28, height: 28, display: 'inline-block' }} /></td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No payments found</td></tr>
                ) : payments.map((p, i) => (
                  <tr key={p.id}>
                    <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      TXN-{String((page - 1) * LIMIT + i + 1).padStart(5, '0')}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{p.user.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.user.email}</div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      {p.subscription?.product.name || '—'}
                      {p.subscription?.plan.name && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.subscription.plan.name}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 15, fontWeight: 700, color: p.status === 'COMPLETED' ? 'var(--green)' : 'var(--text-primary)' }}>
                        ₹{Number(p.amount).toFixed(2)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.currency}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <div style={{ fontWeight: 600 }}>{CATEGORY_LABELS[p.category]}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.category === 'PAYMENT_GATEWAY' ? `Razorpay · ${paymentMethodLabel(p.method)}` : ''}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {statusIcon[p.status]}
                        <span className={`badge badge-${p.status === 'COMPLETED' ? 'active' : p.status === 'FAILED' ? 'inactive' : 'pending'}`} style={{ fontSize: 11 }}>
                          {p.status}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {p.status === 'COMPLETED' ? (
                        <a href={`/invoices/${p.id}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-bright)', fontFamily: 'var(--font-mono)' }}>{p.invoice?.number ?? 'Generate'}</a>
                      ) : '—'}
                    </td>
                    <td>
                      {p.awaitingApproval ? (
                        <button type="button" className="btn btn-primary btn-sm" disabled={busyId === p.id} onClick={() => approve(p.id)}>
                          {busyId === p.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Approve'}
                        </button>
                      ) : p.category === 'PAYMENT_GATEWAY' && p.status === 'COMPLETED' ? <span className="badge badge-active" style={{ fontSize: 11 }}>Approved</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage} />
          </div>
        </div>
      </main>
    </div>
  );
}
