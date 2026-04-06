'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Database, LayoutDashboard, Package, Users, CreditCard, Receipt, Settings, LogOut, ChevronRight, ShieldAlert } from 'lucide-react';

interface AdminSidebarProps { user?: { name: string; email: string; role: string } | null; }

export default function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('dv_user');
    router.push('/');
  }

  const navItems = [
    { href: '/admin',                icon: <LayoutDashboard size={17} />, label: 'Overview',      exact: true },
    { href: '/admin/products',       icon: <Package size={17} />,         label: 'Products' },
    { href: '/admin/users',          icon: <Users size={17} />,           label: 'Users' },
    { href: '/admin/subscriptions',  icon: <Receipt size={17} />,         label: 'Subscriptions' },
    { href: '/admin/payments',       icon: <CreditCard size={17} />,      label: 'Payments' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Link href="/" className="sidebar-logo-link">
          <div className="sidebar-logo-icon"><Database size={18} color="white" /></div>
          <span className="sidebar-logo-text">DataVoult</span>
        </Link>
        <div className="sidebar-admin-badge">
          <ShieldAlert size={12} color="var(--amber)" />
          <span className="sidebar-admin-label">Admin Panel</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`sidebar-nav-link${active ? ' active' : ''}`}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {active && <ChevronRight size={13} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <Link href="/dashboard" className="sidebar-portal-link">
          <Settings size={15} /> Customer Portal
        </Link>
        <div className="sidebar-user">
          <div className="sidebar-user-avatar sidebar-admin-avatar">{user?.name?.[0]?.toUpperCase() || 'A'}</div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div className="sidebar-user-name">{user?.name || '…'}</div>
            <div className="sidebar-user-role">{user?.role}</div>
          </div>
        </div>
        <button onClick={logout} className="sidebar-logout">
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  );
}
