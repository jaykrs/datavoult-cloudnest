import { describe, it, expect, vi } from 'vitest';

vi.mock('./prisma', () => ({ prisma: {} }));
vi.mock('./mailer', () => ({ sendMail: vi.fn() }));

import { describePaymentMethod } from './notifications';
import { adminNewOrderEmail } from './email-templates';

describe('describePaymentMethod', () => {
  it('labels offline payments', () => {
    expect(describePaymentMethod('manual', 'UPI')).toMatch(/UPI transfer/);
    expect(describePaymentMethod('manual', 'BANK_TRANSFER')).toMatch(/Bank transfer/);
  });
  it('labels online payments', () => {
    expect(describePaymentMethod('razorpay', 'CARD')).toMatch(/^Online \(Razorpay/);
    expect(describePaymentMethod(undefined, undefined)).toBe('Online (Razorpay)');
  });
});

describe('adminNewOrderEmail', () => {
  const base = { userName: 'A', userEmail: 'a@x.com', productName: 'VPS', planName: 'S', amount: '₹10', subscriptionId: 's1' };
  it('tells the admin to provision and links to it', () => {
    const e = adminNewOrderEmail({ ...base, paymentMethod: 'UPI transfer', provisionUrl: 'https://x.com/admin/subscriptions?status=PENDING' });
    expect(e.subject).toMatch(/provision/i);
    expect(e.text).toContain('UPI transfer');
    expect(e.html).toContain('https://x.com/admin/subscriptions?status=PENDING');
  });
  it('escapes customer-controlled fields', () => {
    expect(adminNewOrderEmail({ ...base, userName: '<b>x</b>' }).html).not.toContain('<b>x</b>');
  });
});
