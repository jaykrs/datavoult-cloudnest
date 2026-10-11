export type Cycle = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export const CYCLE_MONTHS: Record<Cycle, number> = { MONTHLY: 1, QUARTERLY: 3, ANNUAL: 12 };

/**
 * Add whole billing months, clamping to the last day of the target month
 * (Jan 31 + 1 month = Feb 28/29, not Mar 2/3 as Date#setMonth would give).
 */
export function addBillingCycle(from: Date, cycle: Cycle): Date {
  const months = CYCLE_MONTHS[cycle];
  const result = new Date(from);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/**
 * New renewal date when a payment is received: extend from the later of
 * "now" and the current renewal date, so paying early never loses time and
 * paying late does not backdate the period.
 */
export function nextRenewal(now: Date, currentRenewsAt: Date | null | undefined, cycle: Cycle): Date {
  const base = currentRenewsAt && currentRenewsAt > now ? currentRenewsAt : now;
  return addBillingCycle(base, cycle);
}
