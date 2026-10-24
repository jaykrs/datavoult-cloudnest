import { isValidGstin, stateCodeFromGstin, stateName } from './gst';

/** The business issuing invoices. Configured through env vars (see .env.example). */
export interface Seller {
  name: string;
  address: string;
  gstin: string | null;
  stateCode: string | null;
  stateName: string | null;
  email: string | null;
  phone: string | null;
  /** 1–4 capital letters at the start of every invoice number. */
  prefix: string;
  footer: string | null;
}

const env = (k: string) => (process.env[k] || '').trim();

/** Seller details, or null when the minimum (name + address) isn't configured. */
export function getSeller(): Seller | null {
  const name = env('SELLER_NAME');
  const address = env('SELLER_ADDRESS').replace(/\\n/g, '\n');
  if (!name || !address) return null;

  const rawGstin = env('SELLER_GSTIN').toUpperCase();
  if (rawGstin && !isValidGstin(rawGstin)) {
    console.error('[invoice] SELLER_GSTIN is set but is not a valid GSTIN — ignoring it');
  }
  const gstin = rawGstin && isValidGstin(rawGstin) ? rawGstin : null;

  const explicitState = env('SELLER_STATE_CODE');
  const stateCode = /^\d{2}$/.test(explicitState) ? explicitState : stateCodeFromGstin(gstin);
  const prefix = /^[A-Z]{1,4}$/.test(env('INVOICE_PREFIX')) ? env('INVOICE_PREFIX') : 'DV';

  return {
    name,
    address,
    gstin,
    stateCode,
    stateName: stateName(stateCode),
    email: env('SELLER_EMAIL') || null,
    phone: env('SELLER_PHONE') || null,
    prefix,
    footer: env('INVOICE_FOOTER').replace(/\\n/g, '\n') || null,
  };
}
