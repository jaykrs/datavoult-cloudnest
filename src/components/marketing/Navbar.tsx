'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Database, Menu, X, ChevronDown, LayoutDashboard, LogOut, User } from 'lucide-react';

interface NavUser { name: string; email: string; role: string; }

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState<NavUser | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
  }, [pathname]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('dv_user');
    setUser(null);
    router.push('/');
  }

  const links = [
    { href: '/products', label: 'Products' },
    { href: '/pricing', label: 'Pricing' },
  ];

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <div className="container navbar-inner">
        <Link href="/" className="navbar-logo">
          <div className="navbar-logo-icon">
            <Database size={18} color="white" />
          </div>
          <span className="navbar-logo-text">DataVoult</span>
        </Link>

        <div className="navbar-links">
          {links.map(l => (
            <Link key={l.href} href={l.href} className={`navbar-link${pathname === l.href ? ' active' : ''}`}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="navbar-actions">
          {user ? (
            <div className="user-menu-wrap">
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="btn btn-secondary btn-sm user-menu-trigger">
                <div className="user-menu-avatar">{user.name[0].toUpperCase()}</div>
                <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
                <ChevronDown size={14} />
              </button>
              {userMenuOpen && (
                <div className="user-menu-dropdown">
                  <div className="user-menu-header">
                    <div className="user-menu-name">{user.name}</div>
                    <div className="user-menu-email">{user.email}</div>
                  </div>
                  <Link href="/dashboard" onClick={() => setUserMenuOpen(false)} className="user-menu-item">
                    <LayoutDashboard size={15} /> Dashboard
                  </Link>
                  {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                    <Link href="/admin" onClick={() => setUserMenuOpen(false)} className="user-menu-item">
                      <User size={15} /> Admin Panel
                    </Link>
                  )}
                  <button onClick={() => { logout(); setUserMenuOpen(false); }} className="user-menu-item danger">
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
              <Link href="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          )}
        </div>

        <button onClick={() => setMenuOpen(!menuOpen)} className="btn btn-ghost btn-sm mobile-menu-btn">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen && (
        <div className="mobile-menu">
          {links.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="navbar-link">{l.label}</Link>
          ))}
          <div className="mobile-menu-actions">
            <Link href="/login" className="btn btn-secondary btn-sm">Sign In</Link>
            <Link href="/register" className="btn btn-primary btn-sm">Get Started</Link>
          </div>
        </div>
      )}
    </nav>
  );
}
