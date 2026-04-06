'use client';
import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Users, Server, CreditCard, TrendingUp, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';

interface User { name: string; email: string; role: string; }
interface Stats {
  totalUsers: number; totalRevenue: number; activeSubscriptions: number; totalProducts: number;
  recentPayments: { id: string; amount: number; status: string; createdAt: string; user: { name: string; email: string }; subscription?: { product: { name: string }; plan: { name: string } } }[];
  subscriptionsByCategory: { category: string; count: number }[];
  revenueByMonth: { month: string; revenue: number }[];
}

const COLORS = ['var(--vps-color)', 'var(--docker-color)', 'var(--email-color)'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      <p style={{ color: 'var(--accent-bright)', fontWeight: 600 }}>${payload[0].value?.toFixed(2)}</p>
    </div>
  );
};

export default function AdminDashboard() {
  const [user,    setUser]    = useState<User | null>(null);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
    fetch('/api/admin/stats').then(r => r.json()).then(d => { setStats(d.data); setLoading(false); });
  }, []);

  const statCards = stats ? [
    { icon: <Users size={18} />,     label: 'Total Users',          value: stats.totalUsers,                      change: '+12% this month', color: 'var(--accent)'  },
    { icon: <TrendingUp size={18}/>, label: 'Total Revenue',         value: `$${stats.totalRevenue.toFixed(2)}`,   change: '+8% vs last month',color: 'var(--green)'  },
    { icon: <Server size={18} />,    label: 'Active Subscriptions',  value: stats.activeSubscriptions,             change: null,               color: 'var(--purple)' },
    { icon: <CreditCard size={18}/>, label: 'Products',              value: stats.totalProducts,                   change: null,               color: 'var(--amber)'  },
  ] : [];

  return (
    <div className="page-shell">
      <AdminSidebar user={user} />
      <main className="page-main">
        <div className="page-header">
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Admin Dashboard</div>
            <h1 className="page-header-title">Business Overview</h1>
          </div>
        </div>

        <div className="page-content">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
              <span className="spinner" style={{ width: 32, height: 32 }} />
            </div>
          ) : (
            <>
              {/* Stat cards */}
              <div className="stats-grid">
                {statCards.map(c => (
                  <div key={c.label} className="card">
                    <div className="stat-card-inner">
                      <div className="billing-card-label">{c.label}</div>
                      <div className="stat-card-icon" style={{ background: `${c.color}15`, color: c.color }}>{c.icon}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, marginBottom: 4 }}>{c.value}</div>
                    {c.change && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--green)' }}>
                        <ArrowUpRight size={13} /> {c.change}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
                <div className="card card-xl">
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 24 }}>Revenue (6 months)</h2>
                  {stats?.revenueByMonth && stats.revenueByMonth.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={stats.revenueByMonth} barSize={28}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.05)' }} />
                        <Bar dataKey="revenue" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No revenue data yet</div>
                  )}
                </div>

                <div className="card card-xl">
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 24 }}>By Category</h2>
                  {stats?.subscriptionsByCategory && stats.subscriptionsByCategory.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={stats.subscriptionsByCategory} cx="50%" cy="50%" innerRadius={50} outerRadius={76} dataKey="count" paddingAngle={4}>
                            {stats.subscriptionsByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v) => [v, 'subscriptions']} contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
                        {stats.subscriptionsByCategory.map((c, i) => (
                          <div key={c.category} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                              <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
                              <span style={{ color: 'var(--text-secondary)' }}>{c.category}</span>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{c.count}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No subscriptions yet</div>
                  )}
                </div>
              </div>

              {/* Recent payments */}
              <div className="table-wrap">
                <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--border)' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Recent Payments</h2>
                </div>
                {(!stats?.recentPayments || stats.recentPayments.length === 0) ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No payments yet.</div>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>User</th><th>Service</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                      {stats.recentPayments.map(p => (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontSize: 13, fontWeight: 500 }}>{p.user.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.user.email}</div>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.subscription?.product.name || '—'}</td>
                          <td style={{ fontSize: 14, fontWeight: 600 }}>${Number(p.amount).toFixed(2)}</td>
                          <td><span className={`badge badge-${p.status === 'COMPLETED' ? 'active' : 'pending'}`}>{p.status}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
