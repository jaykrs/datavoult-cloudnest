import Razorpay from 'razorpay';
import { assertValidDays } from './pricing';

let client: Razorpay | null = null;

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getRazorpay(): Razorpay {
  if (client) return client;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set');
  }
  client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

/** Notes we attach to an order at creation; read back (from Razorpay) at fulfilment. */
export interface OrderNotes {
  userId: string;
  productId: string;
  planId: string;
  /** Days purchased (>= 30). The amount paid must equal plan price × days. */
  days: number;
  /** Present when the order renews an existing subscription. */
  subscriptionId?: string;
}

export function parseOrderNotes(notes: unknown): OrderNotes | null {
  if (!notes || typeof notes !== 'object') return null;
  const n = notes as Record<string, unknown>;
  if (typeof n.userId !== 'string' || typeof n.productId !== 'string' || typeof n.planId !== 'string') return null;
  // Razorpay stores note values as strings.
  let days: number;
  try { days = assertValidDays(Number(n.days)); } catch { return null; }
  return {
    userId: n.userId,
    productId: n.productId,
    planId: n.planId,
    days,
    subscriptionId: typeof n.subscriptionId === 'string' && n.subscriptionId ? n.subscriptionId : undefined,
  };
}

/** Razorpay notes must be string values. */
export function notesForRazorpay(notes: OrderNotes): Record<string, string> {
  return Object.fromEntries(Object.entries(notes).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
}

/** Map Razorpay's payment `method` to our enum. */
export function mapPaymentMethod(method: unknown): 'CARD' | 'UPI' | 'NETBANKING' | 'WALLET' | 'BANK_TRANSFER' {
  switch (method) {
    case 'upi': return 'UPI';
    case 'netbanking': return 'NETBANKING';
    case 'wallet': return 'WALLET';
    case 'bank_transfer':
    case 'emandate': return 'BANK_TRANSFER';
    default: return 'CARD';
  }
}
