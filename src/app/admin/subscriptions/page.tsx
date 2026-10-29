'use client';
import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import Pagination from '@/components/ui/Pagination';
import ServerDetailsModal from '@/components/admin/ServerDetailsModal';
import { Server, Package, Mail, KeyRound } from 'lucide-react';

interface User { name: string; email: string; role: string; }
interface AdminSub {
  id: string; status: string; startDate: string; renewsAt?: string;
  user: { name: string; email: string };
  product: { name: string; category: string };
  plan: { name: string; price: number };
  serviceConfig?: { hostname?: string | null; ipAddress?: string | null; hasCredentials: boolean } | null;
}

const catIcon: Record<string, React.ReactNode> = { VPS: <Server size={13} />, DOCKER: <Package size={13} />, EMAIL: <Mail size={13} /> };
const statusBadge: Record<string, string> = { ACTIVE: 'active', PENDING: 'pending', CANCELLED: 'cancelled', SUSPENDED: 'inactive', EXPIRED: 'inactive', TRIAL: 'pending' };
const LIMIT = 10;

export default function AdminSubscriptionsPage() {
  const [user,         setUser]         = useState<User | null>(null);
  const [subscriptions,setSubscriptions]= useState<AdminSub[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('status');
    if (s && ['PENDING', 'ACTIVE', 'CANCELLED', 'SUSPENDED', 'EXPIRED', 'TRIAL'].includes(s)) setStatusFilter(s);
  }, []);
  const [page,         setPage]         = useState(1);
  const [total,        setTotal]        = useState(0);
  const [editing,      setEditing]      = useState<AdminSub | null>(null);
  const [toast,        setToast]        = useState('');
  const [reload,       setReload]       = useState(0);

  // Summary counts (all statuses)
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
    // fetch counts
    fetch('/api/admin/subscriptions?limit=200')
      .then(r => r.json())
      .then(d => {
        const all: AdminSub[] = d.data?.subscriptions || [];
        const c: Record<string,number> = {};
        all.forEach(s => { c[s.status] = (c[s.status] || 0) + 1; });
        setCounts(c);
      });
  }, []);

  useEffect(() => {
    setLoading(true);
    const statusQ = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
    fetch(`/api/admin/subscriptions?limit=${LIMIT}&page=${page}${statusQ}`)
      .then(r => r.json())
      .then(d => { setSubscriptions(d.data?.subscriptions || []); setTotal(d.data?.meta?.total || 0); setLoading(false); });
  }, [statusFilter, page, reload]);

  const totalPages = Math.ceil(total / LIMIT);
  const statuses = ['all','PENDING','ACTIVE','CANCELLED','SUSPENDED','EXPIRED','TRIAL'];

  return (
    <div className="page-shell">
      <AdminSidebar user={user} />
      <main className="page-main">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Subscriptions</h1>
            <p className="page-header-sub">{total} total subscriptions</p>
          </div>
        </div>

        <div className="page-content">
          {toast && <div className="badge badge-active" style={{ padding: '8px 14px', fontSize: 13, alignSelf: 'flex-start' }}>{toast}</div>}
          {/* Quick counts */}
          <div className="stats-grid">
            {[
              { label: 'Awaiting server', key: 'PENDING', color: 'var(--amber)'     },
              { label: 'Active',    key: 'ACTIVE',    color: 'var(--green)'      },
              { label: 'Trial',     key: 'TRIAL',     color: 'var(--accent)'     },
              { label: 'Cancelled', key: 'CANCELLED', color: 'var(--text-muted)' },
              { label: 'Suspended', key: 'SUSPENDED', color: 'var(--red)'        },
            ].map(s => (
              <div key={s.key} className="card">
                <div className="billing-card-label">{s.label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: s.color }}>
                  {counts[s.key] || 0}
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="filter-bar">
            {statuses.map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                className={`btn btn-sm${statusFilter === s ? ' btn-primary' : ' btn-secondary'}`}>
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>User</th><th>Product</th><th>Plan</th><th>Status</th><th>Start Date</th><th>Renews</th><th>Server</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center' }}><span className="spinner" style={{ width: 28, height: 28, display: 'inline-block' }} /></td></tr>
                ) : subscriptions.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No subscriptions found</td></tr>
                ) : subscriptions.map(sub => (
                  <tr key={sub.id}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{sub.user.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub.user.email}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge badge-${sub.product.category.toLowerCase()}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {catIcon[sub.product.category]} {sub.product.category}
                        </span>
                        <span style={{ fontSize: 13 }}>{sub.product.name}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{sub.plan.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>₹{Number(sub.plan.price).toFixed(2)}/day</div>
                    </td>
                    <td><span className={`badge badge-${statusBadge[sub.status] || 'pending'}`}>{sub.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(sub.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub.renewsAt ? new Date(sub.renewsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                    <td>
                      {['PENDING', 'ACTIVE', 'SUSPENDED'].includes(sub.status) && (
                        <button type="button" className={`btn btn-sm ${sub.status === 'PENDING' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEditing(sub)}>
                          <KeyRound size={13} /> {sub.status === 'PENDING' ? 'Provision' : sub.serviceConfig?.hasCredentials ? 'Server details' : 'Add details'}
                        </button>
                      )}
                      {sub.serviceConfig?.ipAddress && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{sub.serviceConfig.ipAddress}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage} />
          </div>
        </div>
      </main>
      {editing && (
        <ServerDetailsModal
          subscriptionId={editing.id}
          pending={editing.status === 'PENDING'}
          title={`${editing.product.name} (${editing.plan.name}) — ${editing.user.name} <${editing.user.email}>`}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setToast(msg); setReload(r => r + 1); setTimeout(() => setToast(''), 6000); }}
        />
      )}
    </div>
  );
}
