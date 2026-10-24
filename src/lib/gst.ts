/** Indian GST helpers: states, GSTIN checks, tax split, financial year, amount in words. */

/** GST state / UT codes (first two digits of a GSTIN). */
export const GST_STATES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
  '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory',
};

export function stateName(code: string | null | undefined): string | null {
  return code && GST_STATES[code] ? GST_STATES[code] : null;
}

/** Format check only (15 chars, state code, PAN shape, entity, 'Z', checksum char). */
export const GSTIN_PATTERN = /^(0[1-9]|[1-2][0-9]|3[0-8]|97)[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function isValidGstin(gstin: string): boolean {
  return GSTIN_PATTERN.test(gstin);
}

/** State code embedded in a GSTIN, if the GSTIN is well-formed. */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  const g = (gstin || '').toUpperCase();
  return isValidGstin(g) ? g.slice(0, 2) : null;
}

export interface TaxSplit { cgst: number; sgst: number; igst: number }

/**
 * Intra-state supply (seller and place of supply in the same state): GST splits
 * into CGST + SGST. Inter-state: all of it is IGST. Amounts in paise; CGST and
 * SGST always add back up to the total GST exactly.
 */
export function splitGst(gstPaise: number, intraState: boolean): TaxSplit {
  if (!intraState) return { cgst: 0, sgst: 0, igst: gstPaise };
  const cgst = Math.round(gstPaise / 2);
  return { cgst, sgst: gstPaise - cgst, igst: 0 };
}

/**
 * Place of supply = the customer's state when known; for a customer with no
 * address on file it defaults to the seller's state (supplier's location).
 */
export function isIntraState(sellerStateCode: string | null, buyerStateCode: string | null): boolean {
  if (!sellerStateCode) return true;
  if (!buyerStateCode) return true;
  return sellerStateCode === buyerStateCode;
}

/**
 * Indian financial year (1 Apr – 31 Mar, evaluated in IST).
 * Returns e.g. { label: '2026-27', key: '2627' }.
 */
export function financialYear(at: Date): { label: string; key: string } {
  const ist = new Date(at.getTime() + 5.5 * 3600_000);
  const month = ist.getUTCMonth(); // 0 = Jan
  const startYear = month >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  const a = String(startYear % 100).padStart(2, '0');
  const b = String((startYear + 1) % 100).padStart(2, '0');
  return { label: `${startYear}-${b}`, key: `${a}${b}` };
}

/**
 * GST rules cap invoice numbers at 16 characters. Format: PREFIX + FY key + '-' + 6-digit
 * serial, e.g. DV2627-000042 (the serial restarts every financial year).
 */
export function formatInvoiceNumber(prefix: string, fyKey: string, serial: number): string {
  return `${prefix}${fyKey}-${String(serial).padStart(6, '0')}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function below100(n: number): string {
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '');
}
function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', rest ? below100(rest) : ''].filter(Boolean).join(' ');
}

/** 1,23,45,678 → "Twelve Crore Thirty Four Lakh …" (Indian numbering). */
function indianWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 1_00_00_000);
  const lakh = Math.floor((n % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((n % 1_00_000) / 1000);
  const rest = n % 1000;
  if (crore) parts.push(`${indianWords(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

/** "Rupees One Thousand Two Hundred Thirty Four and Fifty Six Paise Only" */
export function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  const r = `Rupees ${indianWords(rupees)}`;
  return p ? `${r} and ${below100(p)} Paise Only` : `${r} Only`;
}
