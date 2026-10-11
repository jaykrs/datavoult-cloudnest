import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptSecret, decryptSecret, encryptJson, decryptJson, safeEqual, isEncryptionConfigured } from './crypto';

const KEY = 'a'.repeat(64); // 32 bytes as hex
const original = process.env.CREDENTIALS_ENCRYPTION_KEY;

beforeEach(() => { process.env.CREDENTIALS_ENCRYPTION_KEY = KEY; });
afterEach(() => {
  if (original === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
  else process.env.CREDENTIALS_ENCRYPTION_KEY = original;
});

describe('encryptSecret / decryptSecret', () => {
  it('round-trips', () => {
    expect(decryptSecret(encryptSecret('hunter2'))).toBe('hunter2');
  });

  it('round-trips JSON credentials', () => {
    const creds = { username: 'root', privateKey: '-----BEGIN KEY-----\nabc\n-----END KEY-----' };
    expect(decryptJson(encryptJson(creds))).toEqual(creds);
  });

  it('uses a fresh IV each time and never leaks the plaintext', () => {
    const a = encryptSecret('same');
    const b = encryptSecret('same');
    expect(a).not.toBe(b);
    expect(a).not.toContain('same');
    expect(a.startsWith('v1:')).toBe(true);
  });

  it('detects tampering with the ciphertext', () => {
    const [v, iv, tag, ct] = encryptSecret('secret-value').split(':');
    const flipped = Buffer.from(ct, 'base64');
    flipped[0] ^= 0xff;
    expect(() => decryptSecret([v, iv, tag, flipped.toString('base64')].join(':'))).toThrow();
  });

  it('detects a swapped auth tag', () => {
    const a = encryptSecret('one').split(':');
    const b = encryptSecret('two').split(':');
    expect(() => decryptSecret([a[0], a[1], b[2], a[3]].join(':'))).toThrow();
  });

  it('cannot decrypt with a different key', () => {
    const payload = encryptSecret('secret');
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'b'.repeat(64);
    expect(() => decryptSecret(payload)).toThrow();
  });

  it('rejects malformed payloads', () => {
    expect(() => decryptSecret('garbage')).toThrow();
    expect(() => decryptSecret('v9:a:b:c')).toThrow();
  });
});

describe('key handling', () => {
  it('refuses to work without a key', () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    expect(isEncryptionConfigured()).toBe(false);
    expect(() => encryptSecret('x')).toThrow(/not set/);
  });

  it('refuses a key of the wrong length', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'abcd';
    expect(isEncryptionConfigured()).toBe(false);
    expect(() => encryptSecret('x')).toThrow(/32 bytes/);
  });

  it('accepts a base64 key', () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    expect(decryptSecret(encryptSecret('ok'))).toBe('ok');
  });
});

describe('safeEqual', () => {
  it('compares correctly, including different lengths', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
  });
});
