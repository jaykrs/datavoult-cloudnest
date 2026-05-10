/**
 * DataVoult — Currency Utilities (INR / Razorpay)
 *
 * All prices in the DB are stored in INR (₹).
 * Razorpay expects amounts in PAISE (1 ₹ = 100 paise).
 */

/** Format a number as Indian Rupees with ₹ symbol */
export function formatINR(amount: number | string, decimals = 2): string {
  const n = Number(amount);
  return '₹' + n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Short format — no decimals for whole numbers */
export function formatINRShort(amount: number | string): string {
  const n = Number(amount);
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}L`;
  if (n >= 1_000)     return `₹${(n / 1_000).toFixed(1)}K`;
  return '₹' + n.toLocaleString('en-IN');
}

/** Convert ₹ to paise for Razorpay */
export function toPaise(rupees: number | string): number {
 const numericValue = typeof rupees === "string" ? parseFloat(rupees.replace(/[^0-9.-]+/g, "")) : rupees;
  return Math.round(Number(numericValue.toFixed(2)) * 100);
}

/** Convert paise back to ₹ */
export function toRupees(paise: number): number {
  return paise / 100;
}

/** Currency code used throughout */
export const CURRENCY = 'INR';
export const CURRENCY_SYMBOL = '₹';

/** Razorpay order receipt prefix */
export function makeReceipt(subscriptionId: string): string {
  return `dv_${subscriptionId.slice(-12)}`;
}