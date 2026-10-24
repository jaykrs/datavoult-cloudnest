import { describe, it, expect } from 'vitest';
import {
  MIN_ORDER_DAYS, MAX_ORDER_DAYS, assertValidDays, InvalidDaysError,
  orderTotalPaise, orderTotalRupees, addDays, nextRenewal, rupeesToPaise,
} from './pricing';

const d = (s: string) => new Date(s);

describe('assertValidDays', () => {
  it('accepts whole days from the minimum to the maximum', () => {
    expect(assertValidDays(MIN_ORDER_DAYS)).toBe(30);
    expect(assertValidDays(365)).toBe(365);
    expect(assertValidDays(MAX_ORDER_DAYS)).toBe(MAX_ORDER_DAYS);
  });
  it('enforces the 30-day minimum', () => {
    expect(() => assertValidDays(29)).toThrow(InvalidDaysError);
    expect(() => assertValidDays(0)).toThrow(/Minimum order is 30 days/);
    expect(() => assertValidDays(-5)).toThrow(InvalidDaysError);
  });
  it('rejects fractions, over-max and non-numbers', () => {
    expect(() => assertValidDays(30.5)).toThrow(InvalidDaysError);
    expect(() => assertValidDays(MAX_ORDER_DAYS + 1)).toThrow(/Maximum/);
    expect(() => assertValidDays('30')).toThrow(InvalidDaysError);
    expect(() => assertValidDays(NaN)).toThrow(InvalidDaysError);
  });
});

describe('order totals (integer paise)', () => {
  it('multiplies the per-day rate by the days exactly', () => {
    expect(orderTotalPaise(16, 30)).toBe(48000);
    expect(orderTotalRupees(16.66, 31)).toBe(516.46); // float maths would give 516.4599999…
    expect(orderTotalPaise(0.2, 30)).toBe(600);
  });
  it('rounds the rate to paise first (no fractional paise ever)', () => {
    expect(rupeesToPaise(19.99)).toBe(1999);
    expect(Number.isInteger(orderTotalPaise(19.99, 45))).toBe(true);
  });
  it('refuses to price fewer than the minimum days', () => {
    expect(() => orderTotalPaise(16, 10)).toThrow(InvalidDaysError);
  });
});

describe('addDays / nextRenewal', () => {
  it('adds whole days and does not mutate its input', () => {
    const input = d('2026-01-31T00:00:00Z');
    expect(addDays(input, 30).toISOString()).toBe('2026-03-02T00:00:00.000Z');
    expect(input.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
  const now = d('2026-06-10T00:00:00Z');
  it('extends from the current renewal date when paying early (no lost time)', () => {
    expect(nextRenewal(now, d('2026-06-20T00:00:00Z'), 30).toISOString()).toBe('2026-07-20T00:00:00.000Z');
  });
  it('extends from now when already lapsed (no backdating)', () => {
    expect(nextRenewal(now, d('2026-05-01T00:00:00Z'), 30).toISOString()).toBe('2026-07-10T00:00:00.000Z');
  });
  it('extends from now when there is no renewal date', () => {
    expect(nextRenewal(now, null, 60).toISOString()).toBe('2026-08-09T00:00:00.000Z');
  });
});
