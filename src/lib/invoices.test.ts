import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { db, notifyInvoiceIssued } = vi.hoisted(() => ({
  notifyInvoiceIssued: vi.fn(),
  db: {
    invoice: { findUnique: vi.fn(), create: vi.fn() },
    invoiceCounter: { upsert: vi.fn() },
    payment: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('./prisma', () => ({ prisma: db }));
vi.mock('./notifications', () => ({ notifyInvoiceIssued }));

import { buildInvoiceFigures, issueInvoice, issueInvoiceForGatewayId, serializeInvoice } from './invoices';

const dec = (n: number) => ({ toNumber: () => n });

describe('buildInvoiceFigures', () => {
  it('no GST: a plain invoice with zero tax lines', () => {
    const f = buildInvoiceFigures({ totalPaise: 48000, gstPaise: 0, gstRate: 0, sellerStateCode: '29', buyerStateCode: '29' });
    expect(f).toMatchObject({ taxable: 48000, gstRate: 0, cgst: 0, sgst: 0, igst: 0, total: 48000 });
  });
  it('same state: CGST + SGST', () => {
    const f = buildInvoiceFigures({ totalPaise: 48000, gstPaise: 7322, gstRate: 18, sellerStateCode: '29', buyerStateCode: '29' });
    expect(f).toMatchObject({ taxable: 40678, cgst: 3661, sgst: 3661, igst: 0, intraState: true });
    expect(f.taxable + f.cgst + f.sgst).toBe(48000);
  });
  it('other state: IGST, with the buyer’s state as place of supply', () => {
    const f = buildInvoiceFigures({ totalPaise: 48000, gstPaise: 7322, gstRate: 18, sellerStateCode: '29', buyerStateCode: '27' });
    expect(f).toMatchObject({ cgst: 0, sgst: 0, igst: 7322, intraState: false, placeOfSupplyCode: '27' });
  });
  it('never lets GST exceed the amount paid', () => {
    expect(buildInvoiceFigures({ totalPaise: 100, gstPaise: 9999, gstRate: 18, sellerStateCode: null, buyerStateCode: null }).taxable).toBe(0);
  });
});

describe('issueInvoice', () => {
  const payment = (gatewayData: Record<string, unknown>) => ({
    id: 'pay_1', status: 'COMPLETED', amount: dec(480), subscriptionId: 'sub_1', gatewayData,
    user: { id: 'u1', name: 'Asha', email: 'a@x.in', billingName: 'Asha Pvt Ltd', billingGstin: '27ABCDE1234F1Z5', billingAddress: 'Pune', billingStateCode: '27' },
    subscription: { product: { name: 'Cloud VPS', sacCode: null }, plan: { name: 'Starter' } },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SELLER_NAME', 'Acme Pvt Ltd');
    vi.stubEnv('SELLER_ADDRESS', '1 MG Road\\nBengaluru 560001');
    vi.stubEnv('SELLER_GSTIN', '29ABCDE1234F1Z5');
    vi.stubEnv('INVOICE_PREFIX', 'DV');
    db.invoice.findUnique.mockResolvedValue(null);
    db.invoiceCounter.upsert.mockResolvedValue({ lastNumber: 7 });
    db.invoice.create.mockImplementation(async (a: { data: Record<string, unknown> }) => ({ id: 'inv_1', ...a.data }));
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db));
  });
  afterEach(() => vi.unstubAllEnvs());

  it('is idempotent: an existing invoice is returned untouched', async () => {
    db.invoice.findUnique.mockResolvedValue({ id: 'inv_old' });
    const r = await issueInvoice('pay_1');
    expect(r).toEqual({ invoice: { id: 'inv_old' }, created: false });
    expect(db.invoice.create).not.toHaveBeenCalled();
  });

  it('issues a GST invoice from the payment-time snapshot (IGST for an out-of-state buyer)', async () => {
    db.payment.findUnique.mockResolvedValue(payment({ days: 30, basePaise: 40678, gstPaise: 7322, gstRate: 18 }));
    const r = await issueInvoice('pay_1');
    const d = db.invoice.create.mock.calls[0][0].data;
    expect(r?.created).toBe(true);
    expect(d.number).toMatch(/^DV\d{4}-000007$/);
    expect(d).toMatchObject({ taxableAmount: '406.78', gstRate: '18.00', cgst: '0.00', sgst: '0.00', igst: '73.22', total: '480.00', days: 30, sacCode: '998315' });
    expect(d.description).toBe('Cloud VPS — Starter plan, 30 days');
    expect(d.placeOfSupply).toBe('Maharashtra (27)');
    expect(d.buyer).toMatchObject({ name: 'Asha Pvt Ltd', gstin: '27ABCDE1234F1Z5' });
  });

  it('issues a no-GST invoice when the product carried no GST', async () => {
    db.payment.findUnique.mockResolvedValue(payment({ days: 30, basePaise: 48000, gstPaise: 0, gstRate: 0 }));
    await issueInvoice('pay_1');
    expect(db.invoice.create.mock.calls[0][0].data).toMatchObject({ taxableAmount: '480.00', gstRate: '0.00', cgst: '0.00', sgst: '0.00', igst: '0.00', total: '480.00' });
  });

  it('treats an older payment with no snapshot as no-GST', async () => {
    db.payment.findUnique.mockResolvedValue(payment({}));
    await issueInvoice('pay_1');
    expect(db.invoice.create.mock.calls[0][0].data).toMatchObject({ gstRate: '0.00', total: '480.00', days: null });
  });

  it('refuses to issue until the seller is configured, or when GST was charged without a seller GSTIN', async () => {
    db.payment.findUnique.mockResolvedValue(payment({ days: 30, gstPaise: 7322, gstRate: 18 }));
    vi.stubEnv('SELLER_GSTIN', '');
    expect(await issueInvoice('pay_1')).toBeNull();
    vi.stubEnv('SELLER_NAME', '');
    db.payment.findUnique.mockResolvedValue(payment({ days: 30, gstPaise: 0, gstRate: 0 }));
    expect(await issueInvoice('pay_1')).toBeNull();
    expect(db.invoice.create).not.toHaveBeenCalled();
  });

  it('does not invoice a payment that is not completed', async () => {
    db.payment.findUnique.mockResolvedValue({ ...payment({}), status: 'PENDING' });
    expect(await issueInvoice('pay_1')).toBeNull();
  });

  it('recovers when a concurrent request issued the same invoice first', async () => {
    db.payment.findUnique.mockResolvedValue(payment({ days: 30, gstPaise: 0, gstRate: 0 }));
    db.$transaction.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
    db.invoice.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'inv_other' });
    expect(await issueInvoice('pay_1')).toEqual({ invoice: { id: 'inv_other' }, created: false });
  });
});

describe('issueInvoiceForGatewayId', () => {
  beforeEach(() => vi.clearAllMocks());
  it('never throws, even if the database does', async () => {
    db.payment.findUnique.mockRejectedValue(new Error('db down'));
    await expect(issueInvoiceForGatewayId('g1')).resolves.toBeUndefined();
  });
  it('emails only newly issued invoices', async () => {
    db.payment.findUnique.mockResolvedValue({ id: 'pay_1' });
    db.invoice.findUnique.mockResolvedValue({ id: 'inv_old' });
    await issueInvoiceForGatewayId('g1');
    expect(notifyInvoiceIssued).not.toHaveBeenCalled();
  });
});

describe('serializeInvoice', () => {
  it('returns plain numbers, words and a hasGst flag', () => {
    const inv = serializeInvoice({
      id: 'i', number: 'DV2627-000001', fy: '2026-27', paymentId: 'p', issuedAt: new Date(), description: 'd', sacCode: '998315', days: 30,
      placeOfSupply: null, taxableAmount: dec(406.78), gstRate: dec(18), cgst: dec(0), sgst: dec(0), igst: dec(73.22), total: dec(480),
      seller: {}, buyer: {},
    });
    expect(inv).toMatchObject({ taxable: 406.78, igst: 73.22, total: 480, hasGst: true, totalInWords: 'Rupees Four Hundred Eighty Only' });
  });
});
