import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Static audit of every API route: a new write endpoint cannot be added without a guard.
 * Admin-only resources must use requireAdmin; everything else must at least require a session
 * (or be on the short, reviewed list of intentionally public / secret-protected writes).
 */
const API_DIR = join(process.cwd(), 'src/app/api');
const WRITE = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Public by design — each has its own protection (credentials, captcha, signature or secret).
const PUBLIC_WRITES = new Set([
  'auth/login/route.ts', 'auth/register/route.ts', 'auth/logout/route.ts',
  'contact/route.ts',            // reCAPTCHA + rate limit
  'razorpay/webhook/route.ts',   // HMAC signature
  'internal/cron/route.ts',      // CRON_SECRET bearer
]);
// Resources only an admin may create / update / delete / approve.
const ADMIN_ONLY = [/^admin\//, /^products\//, /^products\/\[id\]\//, /^plans\//];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : n === 'route.ts' ? [p] : [];
  });
}

/** Source text of each exported HTTP handler. */
function handlers(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /export async function (GET|POST|PUT|PATCH|DELETE)\b/g;
  const marks: Array<{ m: string; at: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(src))) marks.push({ m: match[1], at: match.index });
  marks.forEach((x, i) => { out[x.m] = src.slice(x.at, marks[i + 1]?.at ?? src.length); });
  return out;
}

const routes = walk(API_DIR).map((f) => ({ rel: relative(API_DIR, f).replace(/\\/g, '/'), src: readFileSync(f, 'utf8') }));

describe('API route authorization audit', () => {
  it('finds the routes', () => { expect(routes.length).toBeGreaterThan(30); });

  it('every write handler requires a session unless explicitly public', () => {
    const bad: string[] = [];
    for (const r of routes) {
      for (const [method, body] of Object.entries(handlers(r.src))) {
        if (!WRITE.includes(method) || PUBLIC_WRITES.has(r.rel)) continue;
        if (!/requireAdmin\(|requireAuth\(/.test(body)) bad.push(`${method} ${r.rel}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every handler under /api/admin requires an admin (reads included)', () => {
    const bad: string[] = [];
    for (const r of routes.filter((x) => x.rel.startsWith('admin/'))) {
      for (const [method, body] of Object.entries(handlers(r.src))) {
        if (!/requireAdmin\(/.test(body)) bad.push(`${method} ${r.rel}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('products and plans can only be written by an admin', () => {
    const bad: string[] = [];
    for (const r of routes.filter((x) => /^(products|plans)\//.test(x.rel))) {
      for (const [method, body] of Object.entries(handlers(r.src))) {
        if (WRITE.includes(method) && !/requireAdmin\(/.test(body)) bad.push(`${method} ${r.rel}`);
      }
    }
    expect(bad).toEqual([]);
    expect(ADMIN_ONLY.length).toBeGreaterThan(0);
  });

  it('payment approval and rejection are admin-only', () => {
    for (const rel of ['admin/payment-requests/[id]/approve/route.ts', 'admin/payment-requests/[id]/reject/route.ts']) {
      const r = routes.find((x) => x.rel === rel);
      expect(r, rel).toBeTruthy();
      expect(handlers(r!.src).POST).toMatch(/requireAdmin\(/);
    }
  });

  it('customer routes never decide admin-ness from the client', () => {
    for (const r of routes) expect(r.src).not.toMatch(/localStorage|dv_user/);
  });
});
