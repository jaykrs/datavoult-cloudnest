import { describe, it, expect } from 'vitest';
import { addBillingCycle, nextRenewal } from './billing';

const d = (s: string) => new Date(s);

describe('addBillingCycle', () => {
  it('adds whole months', () => {
    expect(addBillingCycle(d('2026-03-15T10:00:00Z'), 'MONTHLY').toISOString()).toBe('2026-04-15T10:00:00.000Z');
    expect(addBillingCycle(d('2026-03-15T10:00:00Z'), 'QUARTERLY').toISOString()).toBe('2026-06-15T10:00:00.000Z');
    expect(addBillingCycle(d('2026-03-15T10:00:00Z'), 'ANNUAL').toISOString()).toBe('2027-03-15T10:00:00.000Z');
  });

  it('clamps to the last day of a shorter month instead of overflowing', () => {
    // Date#setMonth would give Mar 3 here.
    expect(addBillingCycle(d('2026-01-31T00:00:00Z'), 'MONTHLY').toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(addBillingCycle(d('2028-01-31T00:00:00Z'), 'MONTHLY').toISOString()).toBe('2028-02-29T00:00:00.000Z');
    expect(addBillingCycle(d('2026-08-31T00:00:00Z'), 'QUARTERLY').toISOString()).toBe('2026-11-30T00:00:00.000Z');
    expect(addBillingCycle(d('2028-02-29T00:00:00Z'), 'ANNUAL').toISOString()).toBe('2029-02-28T00:00:00.000Z');
  });

  it('does not mutate its input', () => {
    const input = d('2026-01-31T00:00:00Z');
    addBillingCycle(input, 'MONTHLY');
    expect(input.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });
});

describe('nextRenewal', () => {
  const now = d('2026-06-10T00:00:00Z');

  it('extends from the current renewal date when paying early (no lost time)', () => {
    expect(nextRenewal(now, d('2026-06-20T00:00:00Z'), 'MONTHLY').toISOString()).toBe('2026-07-20T00:00:00.000Z');
  });

  it('extends from now when the subscription already lapsed (no backdating)', () => {
    expect(nextRenewal(now, d('2026-05-01T00:00:00Z'), 'MONTHLY').toISOString()).toBe('2026-07-10T00:00:00.000Z');
  });

  it('extends from now when there is no renewal date', () => {
    expect(nextRenewal(now, null, 'ANNUAL').toISOString()).toBe('2027-06-10T00:00:00.000Z');
  });
});
