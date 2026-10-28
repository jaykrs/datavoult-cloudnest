import { describe, it, expect } from 'vitest';
import { isInStock, serializeProduct, stripStock, publicPlanWhere } from './inventory';
import { createProductSchema, createPlanSchema, contactSchema, registerSchema } from './api';

describe('isInStock', () => {
  it('treats null (unlimited) and positive counts as available, 0 as sold out', () => {
    expect(isInStock(null)).toBe(true);
    expect(isInStock(undefined)).toBe(true);
    expect(isInStock(5)).toBe(true);
    expect(isInStock(0)).toBe(false);
  });
});

describe('serializeProduct', () => {
  it('hides the exact count from visitors but shows it to admins', () => {
    const p = { id: '1', inventoryCount: 3 };
    expect(serializeProduct(p, false)).toEqual({ id: '1', inStock: true });
    expect(serializeProduct(p, true)).toEqual({ id: '1', inStock: true, inventoryCount: 3 });
    expect(serializeProduct({ id: '2', inventoryCount: 0 }, false).inStock).toBe(false);
  });
});

const base = { name: 'n', slug: 's', description: 'd', category: 'VPS' as const, features: [], specs: {} };
describe('createProductSchema inventoryCount', () => {
  it('accepts whole numbers, null and omission', () => {
    expect(createProductSchema.safeParse({ ...base, inventoryCount: 10 }).success).toBe(true);
    expect(createProductSchema.safeParse({ ...base, inventoryCount: null }).success).toBe(true);
    expect(createProductSchema.safeParse(base).success).toBe(true);
  });
  it('rejects negatives and fractions', () => {
    expect(createProductSchema.safeParse({ ...base, inventoryCount: -1 }).success).toBe(false);
    expect(createProductSchema.safeParse({ ...base, inventoryCount: 1.5 }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  const ok = { name: 'Jo Doe', email: 'a@b.co', password: 'longenough1' };
  it('requires accepting the privacy policy', () => {
    expect(registerSchema.safeParse(ok).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, acceptPrivacy: false }).success).toBe(false);
    expect(registerSchema.safeParse({ ...ok, acceptPrivacy: true }).success).toBe(true);
  });
});

describe('contactSchema', () => {
  const ok = { name: 'Jo', email: 'a@b.co', subject: 'Hello', message: 'A long enough message' };
  it('accepts a valid message and rejects short/invalid ones', () => {
    expect(contactSchema.safeParse(ok).success).toBe(true);
    expect(contactSchema.safeParse({ ...ok, message: 'short' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...ok, email: 'nope' }).success).toBe(false);
    expect(contactSchema.safeParse({ ...ok, message: 'x'.repeat(5001) }).success).toBe(false);
  });
});

describe('plan stock visibility', () => {
  const product = {
    id: 'p', inventoryCount: null,
    plans: [{ id: 'a', inventoryCount: 5 }, { id: 'b', inventoryCount: 0 }, { id: 'c', inventoryCount: null }],
  };
  it('hides sold-out plans and all stock counts from visitors', () => {
    const v = serializeProduct(product, false);
    expect((v.plans as Array<{ id: string }>).map((p) => p.id)).toEqual(['a', 'c']);
    expect(JSON.stringify(v)).not.toContain('inventoryCount');
    expect(v.inStock).toBe(true);
  });
  it('shows admins every plan with its stock', () => {
    const v = serializeProduct(product, true);
    expect(v.plans).toHaveLength(3);
    expect((v.plans as Array<{ id: string }>).find((p) => p.id === 'b')).toMatchObject({ inventoryCount: 0 });
  });
  it('marks a product unavailable when every plan is sold out', () => {
    const v = serializeProduct({ id: 'p', inventoryCount: 10, plans: [{ id: 'a', inventoryCount: 0 }, { id: 'b', inventoryCount: 0 }] }, false);
    expect(v.plans).toEqual([]);
    expect(v.inStock).toBe(false);
  });
  it('keeps a product with no plans as before', () => {
    expect(serializeProduct({ id: 'p', inventoryCount: null, plans: [] }, false).inStock).toBe(true);
  });
  it('stripStock removes counts deep inside nested responses but keeps dates and other fields', () => {
    const d = new Date();
    const out = stripStock({ subscription: { createdAt: d, plan: { name: 'x', inventoryCount: 3 }, product: { inventoryCount: 1, plans: [{ inventoryCount: 0, id: 'a' }] } } });
    expect(JSON.stringify(out)).not.toContain('inventoryCount');
    expect(out.subscription.createdAt).toBe(d);
    expect(out.subscription.product.plans[0].id).toBe('a');
  });
  it('publicPlanWhere only lists live, in-stock plans', () => {
    expect(publicPlanWhere).toEqual({ isDeleted: false, OR: [{ inventoryCount: null }, { inventoryCount: { gt: 0 } }] });
  });
  it('createPlanSchema accepts null/whole-number stock and rejects the rest', () => {
    const plan = { productId: 'p', name: 'Pro', price: 10, limits: {} };
    expect(createPlanSchema.safeParse({ ...plan, inventoryCount: 0 }).success).toBe(true);
    expect(createPlanSchema.safeParse({ ...plan, inventoryCount: null }).success).toBe(true);
    expect(createPlanSchema.safeParse(plan).success).toBe(true);
    expect(createPlanSchema.safeParse({ ...plan, inventoryCount: -1 }).success).toBe(false);
    expect(createPlanSchema.safeParse({ ...plan, inventoryCount: 2.5 }).success).toBe(false);
  });
});
