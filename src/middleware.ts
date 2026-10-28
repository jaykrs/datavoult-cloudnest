import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

// These paths never require a session cookie.
//  - /api/razorpay/webhook is called by Razorpay and authenticated by its
//    HMAC signature inside the handler.
//  - /api/internal/* is called by a scheduler and authenticated by the
//    CRON_SECRET bearer token inside the handler.
// Everything else under /api (including /api/deploy) requires a valid session.
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/products',
  '/pricing',
  '/privacy',
  '/contact',
  '/blog',
  '/docs',
  '/checkout',          // checkout handles its own auth redirect client-side
  '/api/auth',
  '/api/media',         // blog/product images are shown to everyone
  '/api/contact',       // public contact form (reCAPTCHA + rate limited inside)
  '/api/products',      // product listing/detail is public
  '/api/razorpay/webhook',
  '/api/internal',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow framework assets and static files. API routes are excluded
  // from the "contains a dot" shortcut so e.g. /api/anything.json is not a bypass.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    (!pathname.startsWith('/api/') && pathname.includes('.'))
  ) {
    return NextResponse.next();
  }

  // Public paths skip login, but never for writes to the catalogue: products and plans
  // may only be created, changed or deleted by an admin (the handlers re-check against the
  // database; this is a second, earlier layer).
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  if (isWrite && (pathname === '/api/products' || pathname.startsWith('/api/products/') || pathname === '/api/plans' || pathname.startsWith('/api/plans/'))) {
    const t = request.cookies.get('auth-token')?.value;
    const p = t ? await verifyToken(t) : null;
    if (!p) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    if (p.role !== 'ADMIN' && p.role !== 'SUPER_ADMIN') return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    return NextResponse.next();
  }

  // Allow all public paths
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token')?.value;

  // No token — redirect to login, preserving the current URL as ?next=
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyToken(token);

  // Invalid token — clear it and redirect to login
  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('auth-token');
    return response;
  }

  // Admin-only routes — redirect non-admins to dashboard (pages) / 403 (API)
  const isAdminRole = payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN';
  if (pathname.startsWith('/admin') && !isAdminRole) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  if (pathname.startsWith('/api/admin') && !isAdminRole) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
