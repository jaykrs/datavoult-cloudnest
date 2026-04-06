'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import { Server, CreditCard, Activity, ArrowRight, Package, Mail, Plus, Wifi } from 'lucide-react';

interface User { name: string; email: string; role: string; }
interface Subscription {
  id: string; status: string;
  product: { name: string; category: string };
  plan: { name: string; price: number };
  serviceConfig?: { hostname?: string };
}
interface Payment { id: string; amount: number; status: string; createdAt: string; subscription?: { product: { name: string } }; }

const catIcon: Record<string, React.ReactNode> = { VPS: <Server size={14} />, DOCKER: <Package size={14} />, EMAIL: <Mail size={14} /> };
const catColor: Record<string, string> = { VPS: 'var(--vps-color)', DOCKER: 'var(--docker-color)', EMAIL: 'var(--email-color)' };

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="card stat-card" style={{ '--card-color': color } as React.CSSProperties}>
      <div className="stat-card-inner">
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-icon" style={{ background: `${color}15`, color }}>{icon}</div>
      </div>
      <div className="stat-card-value">{value}</div>
      {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
    Promise.all([
      fetch('/api/subscriptions?limit=4').then(r => r.json()),
      fetch('/api/payments?limit=5').then(r => r.json()),
    ]).then(([subs, pays]) => {
      setSubscriptions(subs.data?.subscriptions || []);
      setPayments(pays.data?.payments || []);
      setLoading(false);
    });
  }, []);

  const activeCount = subscriptions.filter(s => s.status === 'ACTIVE').length;
  const totalSpend = payments.filter(p => p.status === 'COMPLETED').reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div className="page-shell">
      <DashboardSidebar user={user} />
      <main className="page-main">
        <div className="page-header">
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Welcome back,</div>
            <h1 className="page-header-title">{user?.name || '…'}</h1>
          </div>
          <Link href="/products" className="btn btn-primary btn-sm"><Plus size={15} /> New Service</Link>
        </div>

        <div className="page-content">
          {loading ? (
            <div className="stats-grid">
              {[0,1,2].map(i => <div key={i} className="card" style={{ height: 120, opacity: 0.4 }} />)}
            </div>
          ) : (
            <div className="stats-grid">
              <StatCard icon={<Server size={18} />} label="Active Services" value={activeCount} sub={`${subscriptions.length} total`} color="var(--accent)" />
              <StatCard icon={<CreditCard size={18} />} label="Total Spend" value={`$${totalSpend.toFixed(2)}`} sub="All time" color="var(--green)" />
              <StatCard icon={<Activity size={18} />} label="Uptime" value="99.98%" sub="Last 30 days" color="var(--purple)" />
            </div>
          )}

          <div>
            <div className="section-header">
              <h2 className="section-title">Active Services</h2>
              <Link href="/services" className="section-link">View all <ArrowRight size={13} /></Link>
            </div>
            {!loading && subscriptions.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: 40, marginBottom: 16 }}>🚀</div>
                <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>No services yet</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>Deploy your first service to get started.</p>
                <Link href="/products" className="btn btn-primary"><Plus size={16} /> Browse Products</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {subscriptions.map(sub => {
                  const color = catColor[sub.product.category] || 'var(--accent)';
                  return (
                    <div key={sub.id} className="service-row-card">
                      <div className="stat-card-icon" style={{ width: 42, height: 42, borderRadius: 10, background: `${color}15`, color }}>{catIcon[sub.product.category]}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{sub.product.name} — {sub.plan.name}</div>
                        {sub.serviceConfig?.hostname && (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Wifi size={11} /> {sub.serviceConfig.hostname}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span className={`badge badge-${sub.status.toLowerCase()}`}>{sub.status}</span>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>${sub.plan.price}/mo</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="section-header">
              <h2 className="section-title">Recent Payments</h2>
              <Link href="/billing" className="section-link">View all <ArrowRight size={13} /></Link>
            </div>
            <div className="table-wrap">
              {payments.length === 0 && !loading ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No payments yet.</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Service</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.subscription?.product.name || 'N/A'}</td>
                        <td style={{ fontWeight: 600 }}>${Number(p.amount).toFixed(2)}</td>
                        <td><span className={`badge badge-${p.status === 'COMPLETED' ? 'active' : 'pending'}`}>{p.status}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
