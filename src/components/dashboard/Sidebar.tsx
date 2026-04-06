'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Database, LayoutDashboard, Server, CreditCard, HelpCircle, Settings, LogOut, ChevronRight } from 'lucide-react';

interface SidebarProps { user?: { name: string; email: string; role: string } | null; }

export default function DashboardSidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('dv_user');
    router.push('/');
  }

  const navItems = [
    { href: '/dashboard', icon: <LayoutDashboard size={17} />, label: 'Overview' },
    { href: '/services',  icon: <Server size={17} />,         label: 'Services' },
    { href: '/billing',   icon: <CreditCard size={17} />,     label: 'Billing' },
    { href: '/support',   icon: <HelpCircle size={17} />,     label: 'Support' },
    { href: '/settings',  icon: <Settings size={17} />,       label: 'Settings' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Link href="/" className="sidebar-logo-link">
          <div className="sidebar-logo-icon"><Database size={18} color="white" /></div>
          <span className="sidebar-logo-text">DataVoult</span>
        </Link>
        <div className="sidebar-portal-label">Customer Portal</div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
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
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{user?.name?.[0]?.toUpperCase() || '?'}</div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div className="sidebar-user-name">{user?.name || 'Loading…'}</div>
            <div className="sidebar-user-email">{user?.email}</div>
          </div>
        </div>
        <button onClick={logout} className="sidebar-logout">
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  );
}
