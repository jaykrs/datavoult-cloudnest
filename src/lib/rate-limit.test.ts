import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rateLimit, resetRateLimits, clientIp } from './rate-limit';

beforeEach(() => { resetRateLimits(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

describe('rateLimit', () => {
  it('allows up to the limit then blocks', () => {
    for (let i = 0; i < 3; i++) expect(rateLimit('k', 3, 1000).allowed).toBe(true);
    const blocked = rateLimit('k', 3, 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('tracks keys independently', () => {
    for (let i = 0; i < 3; i++) rateLimit('a', 3, 1000);
    expect(rateLimit('a', 3, 1000).allowed).toBe(false);
    expect(rateLimit('b', 3, 1000).allowed).toBe(true);
  });

  it('resets after the window', () => {
    for (let i = 0; i < 4; i++) rateLimit('k', 3, 1000);
    vi.advanceTimersByTime(1001);
    expect(rateLimit('k', 3, 1000).allowed).toBe(true);
  });
});

describe('clientIp', () => {
  it('prefers the first x-forwarded-for entry', () => {
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } });
    expect(clientIp(req)).toBe('1.2.3.4');
  });
  it('falls back safely', () => {
    expect(clientIp(new Request('http://x'))).toBe('unknown');
  });
});
