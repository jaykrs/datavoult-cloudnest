'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const PUBLIC_PREFIXES = ['/login', '/register', '/products', '/pricing', '/privacy', '/contact', '/blog'];
const isPublicPath = (p: string) => p === '/' || PUBLIC_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));

/**
 * Keeps the browser's idea of "logged in" honest. The login cookie is a signed token that can
 * outlive its account (user deleted, database reset) or its role (admin demoted). On load, on
 * tab focus and every few minutes this asks the server who we are; if the account is gone the
 * cookie and cached profile are cleared and protected pages go to the login screen, and if the
 * role changed the cached profile is refreshed and admin pages are left.
 */
export default function SessionGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      let stored: { role?: string } | null = null;
      try { const raw = localStorage.getItem('dv_user'); stored = raw ? JSON.parse(raw) : null; } catch { stored = null; }
      const protectedPage = !isPublicPath(pathname);
      if (!stored && !protectedPage) return; // anonymous visitor on a public page

      let res: Response;
      try { res = await fetch('/api/users/me', { cache: 'no-store' }); } catch { return; } // offline: leave as is
      if (cancelled) return;

      if (res.status === 401) {
        try { localStorage.removeItem('dv_user'); } catch {}
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        if (protectedPage) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        else router.refresh();
        return;
      }
      if (!res.ok) return;

      const d = await res.json().catch(() => null);
      const u = d?.data?.user;
      if (!u) return;
      const wasAdmin = stored?.role === 'ADMIN' || stored?.role === 'SUPER_ADMIN';
      const isAdmin = u.role === 'ADMIN' || u.role === 'SUPER_ADMIN';
      if (stored && stored.role !== u.role) {
        try { localStorage.setItem('dv_user', JSON.stringify({ ...stored, role: u.role, name: u.name, email: u.email })); } catch {}
      }
      if (wasAdmin && !isAdmin && pathname.startsWith('/admin')) router.replace('/dashboard');
    }

    void check();
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(() => void check(), 5 * 60_000);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVisible); clearInterval(timer); };
  }, [pathname, router]);

  return null;
}
