/**
 * Minimal fixed-window, in-memory rate limiter.
 *
 * Good enough to stop trivial brute force on a single instance. It is NOT
 * shared between instances/serverless invocations — put a shared store
 * (Redis/Upstash) or an edge/WAF limit in front of production traffic.
 */

interface Bucket { count: number; resetAt: number }

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export interface RateLimitResult { allowed: boolean; retryAfterSeconds: number }

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    buckets.forEach((b, k) => { if (b.resetAt <= now) buckets.delete(k); });
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

/** Test helper. */
export function resetRateLimits() {
  buckets.clear();
}
