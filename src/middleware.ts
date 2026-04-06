import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

// These paths are always public — no auth required
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/products',
  '/pricing',
  '/checkout',          // checkout handles its own auth redirect client-side
  '/api/auth',
  '/api/products',      // product listing/detail is public
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
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

  // Admin-only routes — redirect non-admins to dashboard
  if (
    pathname.startsWith('/admin') &&
    payload.role !== 'ADMIN' &&
    payload.role !== 'SUPER_ADMIN'
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
