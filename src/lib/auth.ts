import { SignJWT, jwtVerify, JWTPayload  } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production-32chars'
);

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
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (!token) return null;
  return await verifyToken(token);
}

export async function requireAuth(): Promise<JWTPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  return session;
}

export async function requireAdmin(): Promise<JWTPayload> {
  const session = await requireAuth();
  if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    throw new Error('FORBIDDEN');
  }
  return session;
}

export function createAuthResponse(token: string, data: object) {
  const response = Response.json({ success: true, ...data });
  response.headers.set(
    'Set-Cookie',
    `auth-token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`
  );
  return response;
}
