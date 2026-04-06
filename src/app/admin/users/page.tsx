'use client';
import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import Pagination from '@/components/ui/Pagination';
import { Search, Users, ShieldCheck, Mail, Calendar } from 'lucide-react';

interface User { name: string; email: string; role: string; }
interface AdminUser {
  id: string; name: string; email: string; role: string;
  isVerified: boolean; createdAt: string;
  _count: { subscriptions: number; payments: number };
}

const LIMIT = 10;
const roleColors: Record<string, string> = {
  USER: 'var(--accent)', ADMIN: 'var(--amber)', SUPER_ADMIN: 'var(--red)',
};

export default function AdminUsersPage() {
  const [user,    setUser]    = useState<User | null>(null);
  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/users?search=${encodeURIComponent(search)}&limit=${LIMIT}&page=${page}`)
        .then(r => r.json())
        .then(d => { setUsers(d.data?.users || []); setTotal(d.data?.meta?.total || 0); setLoading(false); });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, page]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="page-shell">
      <AdminSidebar user={user} />
      <main className="page-main">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Users</h1>
            <p className="page-header-sub">{total} registered accounts</p>
          </div>
        </div>

        <div className="page-content">
          <div style={{ position: 'relative', maxWidth: 400 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 40 }}
              placeholder="Search users by name or email…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>User</th><th>Role</th><th>Subscriptions</th><th>Payments</th><th>Joined</th><th>Status</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center' }}><span className="spinner" style={{ width: 28, height: 28, display: 'inline-block' }} /></td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No users found</td></tr>
                ) : users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${roleColors[u.role]}22`, color: roleColors[u.role], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                          {u.name[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{u.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Mail size={10} /> {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 100, fontSize: 12, fontWeight: 500, background: `${roleColors[u.role]}15`, color: roleColors[u.role], border: `1px solid ${roleColors[u.role]}30` }}>
                        {(u.role === 'ADMIN' || u.role === 'SUPER_ADMIN') ? <ShieldCheck size={11} /> : <Users size={11} />}
                        {u.role}
                      </span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{u._count.subscriptions}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> subs</span>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{u._count.payments}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> invoices</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Calendar size={11} />
                        {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>
                    <td><span className={`badge badge-${u.isVerified ? 'active' : 'pending'}`}>{u.isVerified ? 'Verified' : 'Unverified'}</span></td>
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
