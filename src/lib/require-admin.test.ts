import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';

const h = vi.hoisted(() => ({ token: undefined as string | undefined, dbUser: null as { role: string } | null }));
vi.mock('next/headers', () => ({ cookies: () => ({ get: () => (h.token ? { value: h.token } : undefined) }) }));
vi.mock('./prisma', () => ({ prisma: { user: { findUnique: async () => h.dbUser } } }));

import { requireAuth, requireAdmin, isAdminSession, isAdminRole } from './auth';

async function tokenFor(role: string) {
  return new SignJWT({ userId: 'u1', email: 'a@b.c', role }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode('x'.repeat(48)));
}

beforeEach(() => { process.env.JWT_SECRET = 'x'.repeat(48); h.token = undefined; h.dbUser = null; });

describe('requireAuth', () => {
  it('rejects a valid token whose user no longer exists (deleted / database reset)', async () => {
    h.token = await tokenFor('USER'); h.dbUser = null;
    await expect(requireAuth()).rejects.toThrow('UNAUTHORIZED');
  });
  it('returns the current role from the database, not the token', async () => {
    h.token = await tokenFor('ADMIN'); h.dbUser = { role: 'USER' };
    expect((await requireAuth()).role).toBe('USER');
  });
});

describe('requireAdmin', () => {
  it('rejects anonymous callers', async () => { await expect(requireAdmin()).rejects.toThrow('UNAUTHORIZED'); });
  it('rejects customers', async () => {
    h.token = await tokenFor('USER'); h.dbUser = { role: 'USER' };
    await expect(requireAdmin()).rejects.toThrow('FORBIDDEN');
  });
  it('rejects a forged/edited role claim: a USER whose token says ADMIN', async () => {
    h.token = await tokenFor('ADMIN'); h.dbUser = { role: 'USER' };
    await expect(requireAdmin()).rejects.toThrow('FORBIDDEN');
  });
  it('revokes a demoted admin immediately even though the token is still valid', async () => {
    h.token = await tokenFor('ADMIN'); h.dbUser = { role: 'USER' };
    expect(await isAdminSession()).toBe(false);
  });
  it('rejects a deleted user', async () => {
    h.token = await tokenFor('ADMIN'); h.dbUser = null;
    await expect(requireAdmin()).rejects.toThrow('UNAUTHORIZED');
  });
  it('accepts ADMIN and SUPER_ADMIN confirmed in the database', async () => {
    for (const role of ['ADMIN', 'SUPER_ADMIN']) {
      h.token = await tokenFor(role); h.dbUser = { role };
      expect((await requireAdmin()).role).toBe(role);
      expect(await isAdminSession()).toBe(true);
    }
  });
  it('isAdminRole only matches the two admin roles', () => {
    expect(isAdminRole('ADMIN')).toBe(true);
    expect(isAdminRole('SUPER_ADMIN')).toBe(true);
    for (const r of ['USER', 'admin', '', undefined, null]) expect(isAdminRole(r)).toBe(false);
  });
});
