import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';

const MIN_SECRET_LENGTH = 32;
const SESSION_SECONDS = 7 * 24 * 60 * 60;

/**
 * The signing secret is mandatory — there is deliberately no fallback value.
 * Read lazily so `next build` works without secrets, but any request that
 * needs to sign or verify a token fails loudly when it is missing or weak.
 */
export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be set to a random string of at least ${MIN_SECRET_LENGTH} characters`
    );
  }
  return new TextEncoder().encode(secret);
}

interface CustomPayload extends JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export async function signToken(payload: CustomPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ['HS256'] });
    return payload as unknown as JWTPayload;
  } catch {
    // Invalid/expired token — or a misconfigured secret, which is treated as
    // "not authenticated" rather than leaking details to the caller.
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return await verifyToken(token);
}

/**
 * A signed-in, still-existing user. The JWT only proves who logged in up to 7 days ago, so the
 * account is confirmed in the database on every call: a deleted user (e.g. after a database
 * reset) or a demoted admin is rejected immediately, and the role used is the CURRENT one.
 */
export async function requireAuth(): Promise<JWTPayload> {
  const session = await getSession();
  if (!session || typeof session.userId !== 'string') {
    throw new Error('UNAUTHORIZED');
  }
  const { prisma } = await import('./prisma');
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true, role: true } });
  if (!user) throw new Error('UNAUTHORIZED');
  return { ...session, email: user.email, role: user.role };
}

export function isAdminRole(role: unknown): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

/**
 * Admin-only gate for every state-changing admin action (products, plans, blog,
 * payment approval, provisioning, ...).
 *
 * The role in the JWT is only a hint: a token lives for 7 days, so a demoted or
 * deleted admin would otherwise keep their powers until it expired. The role is
 * therefore re-read from the database on every call.
 */
export async function requireAdmin(): Promise<JWTPayload> {
  const session = await requireAuth(); // role comes from the database, not the token
  if (!isAdminRole(session.role)) throw new Error('FORBIDDEN');
  return session;
}

/** True only for a signed-in admin whose role is confirmed in the database (for admin-only views of public endpoints). */
export async function isAdminSession(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

/** Set-Cookie value for the session cookie (token = null clears it). */
export function authCookie(token: string | null): string {
  const parts = [
    `auth-token=${token ?? ''}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${token ? SESSION_SECONDS : 0}`,
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function createAuthResponse(token: string, data: object) {
  const response = Response.json({ success: true, ...data });
  response.headers.set('Set-Cookie', authCookie(token));
  return response;
}
