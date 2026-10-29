import { describe, it, expect } from 'vitest';
import { paymentMethodLabel } from './payment-labels';

describe('paymentMethodLabel', () => {
  it('names offline categories', () => {
    expect(paymentMethodLabel('BANK_TRANSFER')).toBe('Bank transfer');
    expect(paymentMethodLabel('UPI')).toBe('UPI');
  });
  it('falls back gracefully', () => {
    expect(paymentMethodLabel('SOME_NEW')).toBe('Some new');
    expect(paymentMethodLabel(null)).toBe('—');
  });
});
