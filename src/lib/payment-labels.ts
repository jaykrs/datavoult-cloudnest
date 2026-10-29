const LABELS: Record<string, string> = {
  CARD: 'Card', UPI: 'UPI', NETBANKING: 'Net banking', WALLET: 'Wallet', BANK_TRANSFER: 'Bank transfer', PAYPAL: 'PayPal', CRYPTO: 'Crypto',
};

/** Customer/admin-facing name for a payment method enum value (UPI, Bank transfer, …). */
export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return '—';
  return LABELS[method] ?? method.charAt(0) + method.slice(1).toLowerCase().replace(/_/g, ' ');
}
