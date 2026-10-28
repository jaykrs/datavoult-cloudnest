import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { middleware } from './middleware';

const tok = (role: string) =>
  new SignJWT({ userId: 'u', email: 'a@b.c', role }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(new TextEncoder().encode('x'.repeat(48)));
const call = (method: string, path: string, token?: string) =>
  middleware(new NextRequest(`http://localhost${path}`, { method, headers: token ? { cookie: `auth-token=${token}` } : {} }));

beforeEach(() => { process.env.JWT_SECRET = 'x'.repeat(48); });

describe('middleware: catalogue and admin writes', () => {
  for (const path of ['/api/products', '/api/products/abc', '/api/plans', '/api/plans/abc']) {
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      it(`${method} ${path}: anonymous 401, customer 403, admin allowed`, async () => {
        expect((await call(method, path)).status).toBe(401);
        expect((await call(method, path, await tok('USER'))).status).toBe(403);
        expect((await call(method, path, await tok('ADMIN'))).status).toBe(200);
        expect((await call(method, path, await tok('SUPER_ADMIN'))).status).toBe(200);
      });
    }
  }
  it('keeps the public product catalogue readable', async () => {
    expect((await call('GET', '/api/products')).status).toBe(200);
    expect((await call('GET', '/api/products/some-slug')).status).toBe(200);
  });
  it('blocks customers from /api/admin', async () => {
    expect((await call('POST', '/api/admin/blog', await tok('USER'))).status).toBe(403);
    expect((await call('POST', '/api/admin/payment-requests/1/approve', await tok('USER'))).status).toBe(403);
    expect((await call('POST', '/api/admin/blog')).status).toBe(401);
  });
});
