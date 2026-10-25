import { describe, it, expect } from 'vitest';
import { isInStock, serializeProduct } from './inventory';
import { createProductSchema, contactSchema, registerSchema } from './api';

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
