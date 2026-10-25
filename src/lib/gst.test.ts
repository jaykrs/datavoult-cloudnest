import { describe, it, expect } from 'vitest';
import {
  isValidGstin, stateCodeFromGstin, splitGst, isIntraState, financialYear, formatInvoiceNumber, amountInWords, stateName,
} from './gst';
import { computeOrderAmounts, gstSettingFrom } from './pricing';

describe('GSTIN', () => {
  it('accepts well-formed GSTINs and reads the state', () => {
    expect(isValidGstin('29ABCDE1234F1Z5')).toBe(true);
    expect(stateCodeFromGstin('29ABCDE1234F1Z5')).toBe('29');
    expect(stateName('29')).toBe('Karnataka');
  });
  it('rejects malformed ones', () => {
    expect(isValidGstin('29ABCDE1234F1Z')).toBe(false);   // too short
    expect(isValidGstin('99ABCDE1234F1Z5')).toBe(false);  // no such state
    expect(isValidGstin('29abcde1234f1z5')).toBe(false);  // lower case
    expect(isValidGstin('29ABCDE1234F1X5')).toBe(false);  // 14th char must be Z
    expect(stateCodeFromGstin('nonsense')).toBeNull();
  });
});

describe('computeOrderAmounts', () => {
  it('no GST: total equals price × days, no tax', () => {
    expect(computeOrderAmounts(16, 30, { rate: null, inclusive: true })).toEqual({ basePaise: 48000, gstPaise: 0, totalPaise: 48000, rate: 0 });
    expect(computeOrderAmounts(16, 30, { rate: 0, inclusive: false }).gstPaise).toBe(0);
  });
  it('GST inclusive: the customer pays the listed amount; GST is carved out of it', () => {
    const a = computeOrderAmounts(16, 30, { rate: 18, inclusive: true }); // ₹480 listed
    expect(a.totalPaise).toBe(48000);
    expect(a.gstPaise).toBe(7322);                 // 48000 × 18 / 118 = 7322.03
    expect(a.basePaise + a.gstPaise).toBe(48000);
  });
  it('GST extra: GST is added on top of the listed amount', () => {
    const a = computeOrderAmounts(16, 30, { rate: 18, inclusive: false });
    expect(a.basePaise).toBe(48000);
    expect(a.gstPaise).toBe(8640);                 // 18% of ₹480
    expect(a.totalPaise).toBe(56640);
  });
  it('always uses whole paise and still enforces the minimum days', () => {
    const a = computeOrderAmounts(16.66, 31, { rate: 12, inclusive: false });
    expect(Number.isInteger(a.gstPaise) && Number.isInteger(a.totalPaise)).toBe(true);
    expect(a.totalPaise).toBe(a.basePaise + a.gstPaise);
    expect(() => computeOrderAmounts(16, 29, { rate: 18, inclusive: true })).toThrow(/Minimum order/);
  });
});

describe('gstSettingFrom', () => {
  it('reads Prisma-style decimals and treats missing/zero as no GST', () => {
    expect(gstSettingFrom({ gstRate: { toNumber: () => 18 }, gstInclusive: false })).toEqual({ rate: 18, inclusive: false });
    expect(gstSettingFrom({ gstRate: '5.00' })).toEqual({ rate: 5, inclusive: true });
    expect(gstSettingFrom({ gstRate: null })).toEqual({ rate: null, inclusive: true });
    expect(gstSettingFrom({ gstRate: 0 }).rate).toBeNull();
    expect(gstSettingFrom(undefined)).toEqual({ rate: null, inclusive: true });
  });
});

describe('tax split', () => {
  it('intra-state → CGST + SGST that add up exactly; inter-state → IGST', () => {
    expect(splitGst(7322, true)).toEqual({ cgst: 3661, sgst: 3661, igst: 0 });
    const odd = splitGst(7321, true);
    expect(odd.cgst + odd.sgst).toBe(7321);
    expect(splitGst(7322, false)).toEqual({ cgst: 0, sgst: 0, igst: 7322 });
  });
  it('place of supply: same state → intra; different → inter; unknown buyer defaults to the seller’s state', () => {
    expect(isIntraState('29', '29')).toBe(true);
    expect(isIntraState('29', '27')).toBe(false);
    expect(isIntraState('29', null)).toBe(true);
    expect(isIntraState(null, '27')).toBe(true);
  });
});

describe('financial year & invoice numbers', () => {
  it('runs April–March in IST', () => {
    expect(financialYear(new Date('2026-10-24T00:00:00Z'))).toEqual({ label: '2026-27', key: '2627' });
    expect(financialYear(new Date('2027-03-31T10:00:00Z')).key).toBe('2627');
    expect(financialYear(new Date('2027-04-01T00:00:00Z')).key).toBe('2728');
    // 31 Mar 20:00 UTC is already 1 Apr 01:30 in India
    expect(financialYear(new Date('2027-03-31T20:00:00Z')).key).toBe('2728');
  });
  it('formats gap-free serials within the 16-character GST limit', () => {
    expect(formatInvoiceNumber('DV', '2627', 42)).toBe('DV2627-000042');
    expect(formatInvoiceNumber('ABCD', '2627', 999999).length).toBeLessThanOrEqual(16);
  });
});

describe('amountInWords', () => {
  it('uses the Indian numbering system', () => {
    expect(amountInWords(48000)).toBe('Rupees Four Hundred Eighty Only');
    expect(amountInWords(123456)).toBe('Rupees One Thousand Two Hundred Thirty Four and Fifty Six Paise Only');
    expect(amountInWords(1_00_000_00)).toBe('Rupees One Lakh Only');
    expect(amountInWords(12_34_56_789_00)).toBe('Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine Only');
    expect(amountInWords(5)).toBe('Rupees Zero and Five Paise Only');
  });
});
