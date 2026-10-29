import crypto from 'crypto';
import { rupeesToPaise } from './pricing';

/**
 * Offline payments: UPI and bank transfer to the business account. The account
 * details come from environment variables (see .env.example) — they are never
 * hard-coded, and a method with incomplete details is simply not offered.
 */

/** How long a customer has to pay + submit the reference before the request expires. */
export const REQUEST_TTL_HOURS = 72;
/** Max unpaid/unreviewed requests one user can have open at once. */
export const MAX_OPEN_REQUESTS = 5;

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  branch: string | null;
  accountType: string;
}
export interface UpiDetails { upiId: string; payeeName: string }

const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,30}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

const env = (k: string) => (process.env[k] || '').trim();

/** Which BANK_* settings are missing or invalid (names only, never values) — for server logs / admin diagnostics. */
export function bankConfigProblems(): string[] {
  const out: string[] = [];
  for (const k of ['BANK_ACCOUNT_NAME', 'BANK_ACCOUNT_NUMBER', 'BANK_NAME']) if (!env(k)) out.push(`${k} is not set`);
  const ifsc = env('BANK_IFSC').toUpperCase();
  if (!ifsc) out.push('BANK_IFSC is not set');
  else if (!IFSC_PATTERN.test(ifsc)) out.push('BANK_IFSC is not a valid IFSC (4 letters, 0, 6 letters/digits)');
  return out;
}

export function getBankDetails(): BankDetails | null {
  const accountName = env('BANK_ACCOUNT_NAME');
  const accountNumber = env('BANK_ACCOUNT_NUMBER');
  const ifsc = env('BANK_IFSC').toUpperCase();
  const bankName = env('BANK_NAME');
  if (!accountName || !accountNumber || !bankName || !IFSC_PATTERN.test(ifsc)) return null;
  return {
    accountName,
    accountNumber,
    ifsc,
    bankName,
    branch: env('BANK_BRANCH') || null,
    accountType: env('BANK_ACCOUNT_TYPE') || 'Current',
  };
}

export function getUpiDetails(): UpiDetails | null {
  const upiId = env('UPI_ID');
  if (!UPI_ID_PATTERN.test(upiId)) return null;
  return { upiId, payeeName: env('UPI_PAYEE_NAME') || env('BANK_ACCOUNT_NAME') || 'DataVoult' };
}

export type ManualMethod = 'UPI' | 'BANK_TRANSFER';

export function manualMethodAvailable(method: ManualMethod): boolean {
  return method === 'UPI' ? getUpiDetails() !== null : getBankDetails() !== null;
}

/** `upi://pay` deep link: opens the customer's UPI app with payee, amount and remark pre-filled. */
export function upiPayUri(upi: UpiDetails, amountRupees: number, reference: string): string {
  const q = new URLSearchParams({
    pa: upi.upiId,
    pn: upi.payeeName,
    am: amountRupees.toFixed(2),
    cu: 'INR',
    tn: reference,
  });
  return `upi://pay?${q.toString().replace(/\+/g, '%20')}`;
}

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — easy to read out and type
export function generateReference(): string {
  const bytes = crypto.randomBytes(8);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  return `DV-${out}`;
}

/** Does the amount the admin saw credited equal what was ordered, to the paisa? */
export function receivedMatches(receivedRupees: number, expectedRupees: number): boolean {
  return rupeesToPaise(receivedRupees) === rupeesToPaise(expectedRupees);
}

export interface PaymentInstructions {
  method: ManualMethod;
  amount: number;
  reference: string;
  upi?: UpiDetails & { uri: string };
  bank?: BankDetails;
}

export function buildInstructions(method: ManualMethod, amountRupees: number, reference: string): PaymentInstructions | null {
  if (method === 'UPI') {
    const upi = getUpiDetails();
    return upi ? { method, amount: amountRupees, reference, upi: { ...upi, uri: upiPayUri(upi, amountRupees, reference) } } : null;
  }
  const bank = getBankDetails();
  return bank ? { method, amount: amountRupees, reference, bank } : null;
}

export const OPEN_STATUSES = ['AWAITING_PAYMENT', 'SUBMITTED'] as const;
