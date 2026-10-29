import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getBankDetails, bankConfigProblems, getUpiDetails, manualMethodAvailable, upiPayUri, generateReference, receivedMatches, buildInstructions,
} from './manual-payments';
import { submitManualPaymentSchema, approveManualPaymentSchema, createManualPaymentSchema } from './api';
import { parseOrderNotes } from './razorpay';
import { adminManualPaymentSubmittedEmail } from './email-templates';

afterEach(() => vi.unstubAllEnvs());

const bankEnv = () => {
  vi.stubEnv('BANK_ACCOUNT_NAME', 'Acme Pvt Ltd');
  vi.stubEnv('BANK_ACCOUNT_NUMBER', '123456789012');
  vi.stubEnv('BANK_IFSC', 'hdfc0001234');
  vi.stubEnv('BANK_NAME', 'HDFC Bank');
};

describe('payment account configuration', () => {
  it('offers nothing until the details are configured', () => {
    vi.stubEnv('BANK_ACCOUNT_NAME', ''); vi.stubEnv('UPI_ID', '');
    expect(getBankDetails()).toBeNull();
    expect(getUpiDetails()).toBeNull();
    expect(manualMethodAvailable('UPI')).toBe(false);
    expect(manualMethodAvailable('BANK_TRANSFER')).toBe(false);
  });
  it('reads the bank account (current by default, IFSC upper-cased)', () => {
    bankEnv();
    expect(getBankDetails()).toMatchObject({ accountName: 'Acme Pvt Ltd', ifsc: 'HDFC0001234', accountType: 'Current', branch: null });
    expect(manualMethodAvailable('BANK_TRANSFER')).toBe(true);
  });
  it('rejects a malformed IFSC or UPI ID instead of showing customers wrong details', () => {
    bankEnv(); vi.stubEnv('BANK_IFSC', 'BADCODE');
    expect(getBankDetails()).toBeNull();
    vi.stubEnv('UPI_ID', 'not a upi id');
    expect(getUpiDetails()).toBeNull();
  });
  it('accepts a valid UPI ID and falls back to the account name as payee', () => {
    bankEnv(); vi.stubEnv('UPI_ID', 'acme@okhdfcbank'); vi.stubEnv('UPI_PAYEE_NAME', '');
    expect(getUpiDetails()).toEqual({ upiId: 'acme@okhdfcbank', payeeName: 'Acme Pvt Ltd' });
  });
});

describe('payment instructions', () => {
  it('builds a upi:// link with amount, INR and the reference as remark', () => {
    const uri = upiPayUri({ upiId: 'acme@okhdfcbank', payeeName: 'Acme Pvt Ltd' }, 480, 'DV-ABCD2345');
    const q = new URL(uri.replace('upi://', 'https://x/')).searchParams;
    expect(uri.startsWith('upi://pay?')).toBe(true);
    expect(q.get('pa')).toBe('acme@okhdfcbank');
    expect(q.get('am')).toBe('480.00');
    expect(q.get('cu')).toBe('INR');
    expect(q.get('tn')).toBe('DV-ABCD2345');
    expect(uri).not.toContain('+');
  });
  it('includes only the chosen method’s details', () => {
    bankEnv(); vi.stubEnv('UPI_ID', 'acme@okhdfcbank');
    expect(buildInstructions('UPI', 480, 'DV-X')?.bank).toBeUndefined();
    expect(buildInstructions('BANK_TRANSFER', 480, 'DV-X')?.upi).toBeUndefined();
    expect(buildInstructions('BANK_TRANSFER', 480, 'DV-X')?.bank?.accountNumber).toBe('123456789012');
  });
  it('generates distinct, readable references', () => {
    const refs = new Set(Array.from({ length: 200 }, generateReference));
    expect(refs.size).toBe(200);
    Array.from(refs).forEach((r) => expect(r).toMatch(/^DV-[A-HJ-NP-Z2-9]{8}$/));
  });
});

describe('admin verification', () => {
  it('requires the credited amount to match to the paisa', () => {
    expect(receivedMatches(480, 480)).toBe(true);
    expect(receivedMatches(480.0, 480.0)).toBe(true);
    expect(receivedMatches(479.99, 480)).toBe(false);
    expect(receivedMatches(500, 480)).toBe(false);
    expect(receivedMatches(516.46, 516.46)).toBe(true);
  });
  it('validates and normalises the transaction reference', () => {
    expect(submitManualPaymentSchema.parse({ transactionRef: ' utr12345678 ' }).transactionRef).toBe('UTR12345678');
    expect(submitManualPaymentSchema.safeParse({ transactionRef: '123' }).success).toBe(false);
    expect(submitManualPaymentSchema.safeParse({ transactionRef: 'abc 123456' }).success).toBe(false);
    expect(submitManualPaymentSchema.safeParse({ transactionRef: 'x'.repeat(41) }).success).toBe(false);
  });
  it('approval needs a positive received amount', () => {
    expect(approveManualPaymentSchema.safeParse({ receivedAmount: 480 }).success).toBe(true);
    expect(approveManualPaymentSchema.safeParse({ receivedAmount: 0 }).success).toBe(false);
    expect(approveManualPaymentSchema.safeParse({}).success).toBe(false);
  });
  it('only UPI and bank transfer can be requested manually', () => {
    const base = { productId: 'p', planId: 'pl', days: 30 };
    expect(createManualPaymentSchema.safeParse({ ...base, method: 'UPI' }).success).toBe(true);
    expect(createManualPaymentSchema.safeParse({ ...base, method: 'BANK_TRANSFER' }).success).toBe(true);
    expect(createManualPaymentSchema.safeParse({ ...base, method: 'CARD' }).success).toBe(false);
  });
});

describe('order notes carry the number of days', () => {
  const base = { userId: 'u', productId: 'p', planId: 'pl' };
  it('parses days that Razorpay returns as a string', () => {
    expect(parseOrderNotes({ ...base, days: '45' })?.days).toBe(45);
  });
  it('rejects missing or under-minimum days', () => {
    expect(parseOrderNotes(base)).toBeNull();
    expect(parseOrderNotes({ ...base, days: '29' })).toBeNull();
    expect(parseOrderNotes({ ...base, days: 'abc' })).toBeNull();
  });
});

describe('admin email', () => {
  it('escapes customer-supplied text', () => {
    const m = adminManualPaymentSubmittedEmail({
      userName: '<b>x</b>', userEmail: 'a@b.co', productName: 'P', planName: 'Pl', days: 30, amount: '₹480.00',
      reference: 'DV-1', method: 'UPI', transactionRef: '<script>1</script>',
    });
    expect(m.html).not.toContain('<script>');
    expect(m.html).not.toContain('<b>x</b>');
  });
});

describe('bankConfigProblems', () => {
  it('names the missing or invalid settings, never their values', () => {
    vi.stubEnv('BANK_ACCOUNT_NAME', ''); vi.stubEnv('BANK_ACCOUNT_NUMBER', '1234'); vi.stubEnv('BANK_NAME', 'X'); vi.stubEnv('BANK_IFSC', 'BAD');
    const p = bankConfigProblems();
    expect(p).toContain('BANK_ACCOUNT_NAME is not set');
    expect(p.join(' ')).toMatch(/BANK_IFSC is not a valid IFSC/);
    expect(p.join(' ')).not.toContain('1234');
  });
  it('is empty when fully configured', () => {
    bankEnv();
    expect(bankConfigProblems()).toEqual([]);
  });
});
