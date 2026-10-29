import { describe, it, expect, vi, beforeEach } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: { plan: { findFirst: vi.fn() }, subscription: { findFirst: vi.fn() } },
}));
vi.mock('./prisma', () => ({ prisma: db }));

import { prepareOrder } from './orders';

const plan = (over: Record<string, unknown> = {}) => ({
  id: 'pl', productId: 'pr', isDeleted: false, inventoryCount: null,
  price: { lte: () => false, toNumber: () => 10 },
  product: { status: 'ACTIVE', inventoryCount: null, gstEnabled: false, gstRate: null, gstInclusive: false },
  ...over,
});

beforeEach(() => vi.clearAllMocks());

describe('prepareOrder — repeat purchases', () => {
  it('lets a customer who already has this product buy the same plan again', async () => {
    db.plan.findFirst.mockResolvedValue(plan());
    db.subscription.findFirst.mockResolvedValue({ id: 'existing', status: 'ACTIVE' });
    const o = await prepareOrder({ userId: 'u', productId: 'pr', planId: 'pl', days: 30 });
    expect(o.days).toBe(30);
    expect(db.subscription.findFirst).not.toHaveBeenCalled();
  });

  it('still blocks a sold-out plan', async () => {
    db.plan.findFirst.mockResolvedValue(plan({ inventoryCount: 0 }));
    await expect(prepareOrder({ userId: 'u', productId: 'pr', planId: 'pl', days: 30 })).rejects.toMatchObject({ status: 409 });
  });
});
