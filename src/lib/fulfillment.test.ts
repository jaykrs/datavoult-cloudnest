import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks (declared before importing the module under test) ──────────────────
// vi.mock factories are hoisted above imports, so anything they reference must be hoisted too.
const { FakeKnownRequestError, runProvisioning, notifyOrderSubscribed, db } = vi.hoisted(() => {
  class FakeKnownRequestError extends Error {
    code: string;
    constructor(message: string, opts: { code: string }) {
      super(message);
      this.code = opts.code;
    }
  }
  return {
    FakeKnownRequestError,
    runProvisioning: vi.fn(),
    notifyOrderSubscribed: vi.fn(),
    db: {
      product: { findUnique: vi.fn(), updateMany: vi.fn() },
      payment: { findUnique: vi.fn(), create: vi.fn() },
      plan: { findFirst: vi.fn() },
      subscription: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});

vi.mock('@prisma/client', () => ({ Prisma: { PrismaClientKnownRequestError: FakeKnownRequestError } }));
vi.mock('./provisioning', () => ({ runProvisioning, DEFAULT_REGION: 'test-region' }));
vi.mock('./prisma', () => ({ prisma: db }));
vi.mock('./notifications', () => ({ notifyOrderSubscribed }));

import { fulfillPayment, FulfillmentError } from './fulfillment';

// ── Fixtures ─────────────────────────────────────────────────────────────────
const plan = { id: 'plan_1', productId: 'prod_1', price: { toNumber: () => 499 }, billingCycle: 'MONTHLY' };
const notes = { userId: 'user_1', productId: 'prod_1', planId: 'plan_1' };
const input = { orderId: 'order_1', paymentId: 'pay_1', amountPaise: 49900, method: 'UPI' as const, notes };

beforeEach(() => {
  vi.clearAllMocks();
  db.payment.findUnique.mockResolvedValue(null);
  db.plan.findFirst.mockResolvedValue(plan);
  db.payment.create.mockImplementation(async (a: unknown) => a);
  db.subscription.create.mockResolvedValue({ id: 'sub_new' });
  db.subscription.update.mockImplementation(async (a: unknown) => a);
  // Supports both $transaction([...]) and $transaction(async tx => ...)
  db.$transaction.mockImplementation(async (arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: typeof db) => Promise<unknown>)(db),
  );
  runProvisioning.mockResolvedValue('done');
  notifyOrderSubscribed.mockResolvedValue(undefined);
  db.product.findUnique.mockResolvedValue({ inventoryCount: null }); // unlimited by default
  db.product.updateMany.mockResolvedValue({ count: 1 });
});

describe('fulfillPayment — new subscription', () => {
  it('creates a PENDING subscription, a provisioning job and the payment, then provisions', async () => {
    const result = await fulfillPayment(input);

    expect(result).toEqual({ outcome: 'created', subscriptionId: 'sub_new' });

    const subArgs = db.subscription.create.mock.calls[0][0].data;
    expect(subArgs).toMatchObject({ userId: 'user_1', productId: 'prod_1', planId: 'plan_1', status: 'PENDING' });
    expect(subArgs.provisioningJob).toEqual({ create: {} });
    expect(subArgs.serviceConfig.create.region).toBe('test-region');
    expect(subArgs.renewsAt).toBeInstanceOf(Date);

    const payArgs = db.payment.create.mock.calls[0][0].data;
    expect(payArgs).toMatchObject({
      userId: 'user_1', subscriptionId: 'sub_new', status: 'COMPLETED', method: 'UPI', gatewayId: 'pay_1', currency: 'INR',
    });
    expect(runProvisioning).toHaveBeenCalledWith('sub_new');
  });

  it('is idempotent: an already-recorded payment grants nothing new', async () => {
    db.payment.findUnique.mockResolvedValue({ id: 'p', subscriptionId: 'sub_existing' });
    const result = await fulfillPayment(input);

    expect(result).toEqual({ outcome: 'duplicate', subscriptionId: 'sub_existing' });
    expect(db.subscription.create).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
    expect(runProvisioning).not.toHaveBeenCalled();
  });

  it('survives a race: unique violation on gatewayId resolves to the winner', async () => {
    db.$transaction.mockRejectedValueOnce(new FakeKnownRequestError('dup', { code: 'P2002' }));
    db.payment.findUnique
      .mockResolvedValueOnce(null) // initial idempotency check
      .mockResolvedValueOnce({ id: 'p', subscriptionId: 'sub_winner' }); // after the race

    const result = await fulfillPayment(input);
    expect(result).toEqual({ outcome: 'duplicate', subscriptionId: 'sub_winner' });
    expect(runProvisioning).not.toHaveBeenCalled();
  });

  it('rethrows non-unique database errors so the webhook is retried', async () => {
    db.$transaction.mockRejectedValueOnce(new Error('connection lost'));
    await expect(fulfillPayment(input)).rejects.toThrow('connection lost');
  });

  it('refuses a payment whose amount does not match the plan price', async () => {
    const err = await fulfillPayment({ ...input, amountPaise: 100 }).catch((e) => e);
    expect(err).toBeInstanceOf(FulfillmentError);
    expect(err.code).toBe('AMOUNT_MISMATCH');
    expect(db.subscription.create).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it('refuses an unknown plan', async () => {
    db.plan.findFirst.mockResolvedValue(null);
    const err = await fulfillPayment(input).catch((e) => e);
    expect(err).toBeInstanceOf(FulfillmentError);
    expect(err.code).toBe('PLAN_NOT_FOUND');
  });

  it('still reports success if provisioning throws (the job stays for retry)', async () => {
    runProvisioning.mockRejectedValue(new Error('provider down'));
    await expect(fulfillPayment(input)).resolves.toMatchObject({ outcome: 'created', subscriptionId: 'sub_new' });
  });
});

describe('fulfillPayment — renewal', () => {
  const renewal = { ...input, notes: { ...notes, subscriptionId: 'sub_1' } };
  const sub = { id: 'sub_1', userId: 'user_1', planId: 'plan_1', status: 'SUSPENDED', renewsAt: new Date('2020-01-01') };

  it('extends the period, reactivates a lapsed service and does not create a new one', async () => {
    db.subscription.findFirst.mockResolvedValue(sub);
    const before = Date.now();
    const result = await fulfillPayment(renewal);

    expect(result).toEqual({ outcome: 'renewed', subscriptionId: 'sub_1' });
    expect(db.subscription.create).not.toHaveBeenCalled();

    const upd = db.subscription.update.mock.calls[0][0];
    expect(upd.where).toEqual({ id: 'sub_1' });
    expect(upd.data.status).toBe('ACTIVE');
    expect(upd.data.renewsAt.getTime()).toBeGreaterThan(before); // from now, not from the 2020 date
    expect(db.payment.create.mock.calls[0][0].data.subscriptionId).toBe('sub_1');
    expect(runProvisioning).not.toHaveBeenCalled();
  });

  it("only looks up the caller's own subscription", async () => {
    db.subscription.findFirst.mockResolvedValue(null);
    const err = await fulfillPayment(renewal).catch((e) => e);
    expect(db.subscription.findFirst.mock.calls[0][0].where).toEqual({ id: 'sub_1', userId: 'user_1' });
    expect(err).toBeInstanceOf(FulfillmentError);
    expect(err.code).toBe('SUBSCRIPTION_NOT_FOUND');
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it('refuses to renew onto a different plan or a cancelled subscription', async () => {
    db.subscription.findFirst.mockResolvedValue({ ...sub, planId: 'other_plan' });
    expect((await fulfillPayment(renewal).catch((e) => e)).code).toBe('NOT_RENEWABLE');

    db.subscription.findFirst.mockResolvedValue({ ...sub, status: 'CANCELLED' });
    expect((await fulfillPayment(renewal).catch((e) => e)).code).toBe('NOT_RENEWABLE');
    expect(db.payment.create).not.toHaveBeenCalled();
  });
});

describe('fulfillPayment — inventory', () => {
  it('does not touch stock for unlimited (null) products', async () => {
    await fulfillPayment(input);
    expect(db.product.updateMany).not.toHaveBeenCalled();
  });

  it('takes one unit with a conditional (count > 0) atomic update', async () => {
    db.product.findUnique.mockResolvedValue({ inventoryCount: 3 });
    await fulfillPayment(input);
    expect(db.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'prod_1', inventoryCount: { gt: 0 } },
      data: { inventoryCount: { decrement: 1 } },
    });
  });

  it('fails with OUT_OF_STOCK and creates nothing when the last unit is gone', async () => {
    db.product.findUnique.mockResolvedValue({ inventoryCount: 1 });
    db.product.updateMany.mockResolvedValue({ count: 0 });
    await expect(fulfillPayment(input)).rejects.toMatchObject({ code: 'OUT_OF_STOCK' });
    expect(db.subscription.create).not.toHaveBeenCalled();
    expect(db.payment.create).not.toHaveBeenCalled();
    expect(notifyOrderSubscribed).not.toHaveBeenCalled();
  });

  it('does not consume stock on renewal', async () => {
    db.subscription.findFirst.mockResolvedValue({ id: 'sub_1', planId: 'plan_1', status: 'ACTIVE', renewsAt: new Date() });
    await fulfillPayment({ ...input, notes: { ...notes, subscriptionId: 'sub_1' } });
    expect(db.product.updateMany).not.toHaveBeenCalled();
  });

  it('sends the order notification for new subscriptions only', async () => {
    await fulfillPayment(input);
    expect(notifyOrderSubscribed).toHaveBeenCalledWith('sub_new');
  });
});
