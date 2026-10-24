/**
 * Per-day pricing, in Indian rupees.
 *
 * A plan's `price` is the cost of ONE DAY of service in ₹. A customer buys a
 * whole number of days — at least MIN_ORDER_DAYS — and pays `price × days`.
 * All money maths is done in integer paise so there is never float drift
 * (₹16.66 × 31 days must be exactly ₹516.46).
 */

export const MIN_ORDER_DAYS = 30;
export const MAX_ORDER_DAYS = 1095; // 3 years

const DAY_MS = 24 * 60 * 60 * 1000;

export class InvalidDaysError extends Error {}

/** Whole days within [MIN_ORDER_DAYS, MAX_ORDER_DAYS], or throws InvalidDaysError. */
export function assertValidDays(days: unknown): number {
  if (typeof days !== 'number' || !Number.isInteger(days)) {
    throw new InvalidDaysError('Number of days must be a whole number');
  }
  if (days < MIN_ORDER_DAYS) throw new InvalidDaysError(`Minimum order is ${MIN_ORDER_DAYS} days`);
  if (days > MAX_ORDER_DAYS) throw new InvalidDaysError(`Maximum order is ${MAX_ORDER_DAYS} days`);
  return days;
}

/** ₹ → whole paise (the per-day rate has at most 2 decimals). */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Total in paise for `days` of a plan costing `pricePerDay` ₹/day. */
export function orderTotalPaise(pricePerDay: number, days: number): number {
  assertValidDays(days);
  return rupeesToPaise(pricePerDay) * days;
}

/** The same total in rupees, for display. */
export function orderTotalRupees(pricePerDay: number, days: number): number {
  return orderTotalPaise(pricePerDay, days) / 100;
}

/** Add whole days (24h each, UTC) without mutating the input. */
export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

/**
 * New renewal date for a payment of `days`: extend from the later of "now" and
 * the current renewal date, so paying early never loses time and paying late
 * does not backdate the period.
 */
export function nextRenewal(now: Date, currentRenewsAt: Date | null | undefined, days: number): Date {
  const base = currentRenewsAt && currentRenewsAt > now ? currentRenewsAt : now;
  return addDays(base, days);
}
