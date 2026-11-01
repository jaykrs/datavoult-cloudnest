import { describe, it, expect } from 'vitest';
import { isAwaitingApproval, isGatewayPayment, paymentCategory, PENDING_APPROVAL } from './gateway-approval';

describe('gateway payment approval', () => {
  it('flags only explicitly pending approvals', () => {
    expect(isAwaitingApproval({ gateway: 'razorpay', approval: PENDING_APPROVAL })).toBe(true);
    expect(isAwaitingApproval({ gateway: 'razorpay', approval: { status: 'APPROVED' } })).toBe(false);
    expect(isAwaitingApproval({ gateway: 'razorpay' })).toBe(false); // renewals / older rows
    expect(isAwaitingApproval(null)).toBe(false);
  });
  it('categorises payments', () => {
    expect(isGatewayPayment({ gateway: 'razorpay' })).toBe(true);
    expect(paymentCategory({ gateway: 'razorpay' }, 'CARD')).toBe('PAYMENT_GATEWAY');
    expect(paymentCategory({ gateway: 'manual' }, 'UPI')).toBe('UPI');
    expect(paymentCategory({ gateway: 'manual' }, 'BANK_TRANSFER')).toBe('BANK_TRANSFER');
    expect(paymentCategory(null, 'CARD')).toBe('PAYMENT_GATEWAY');
  });
});
