'use client';
import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import Pagination from '@/components/ui/Pagination';
import { TrendingUp, DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react';

interface User { name: string; email: string; role: string; }
interface AdminPayment {
  id: string; amount: number; currency: string; status: string; method: string; createdAt: string;
  user: { name: string; email: string };
  subscription?: { product: { name: string }; plan: { name: string; billingCycle: string } };
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

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
    // fetch summary from stats
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
    const statusQ = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
    // use admin stats endpoint for data (reusing what we have)
    fetch('/api/admin/stats').then(r => r.json()).then(d => {
      let all: AdminPayment[] = d.data?.recentPayments || [];
      if (statusFilter !== 'all') all = all.filter((p: AdminPayment) => p.status === statusFilter);
      setTotal(all.length);
      const start = (page - 1) * LIMIT;
      setPayments(all.slice(start, start + LIMIT));
      setLoading(false);
    });
  }, [statusFilter, page]);

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
              { icon: <DollarSign size={18} />, label: 'Total Revenue',  value: `$${summary.revenue.toFixed(2)}`, color: 'var(--green)'  },
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
            {['all','COMPLETED','PENDING','FAILED','REFUNDED'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`btn btn-sm${statusFilter === s ? ' btn-primary' : ' btn-secondary'}`}>
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Transaction</th><th>User</th><th>Service</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center' }}><span className="spinner" style={{ width: 28, height: 28, display: 'inline-block' }} /></td></tr>
                ) : payments.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No payments found</td></tr>
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
                        ${Number(p.amount).toFixed(2)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.currency}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.method}</td>
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
