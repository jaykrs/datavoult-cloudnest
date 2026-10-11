/**
 * Prisma `select` fragments for data that is returned to customers.
 * ServiceConfig.credentials and hostKeySha256 are server-side only and must
 * never be included in an API response — always use these instead of
 * `serviceConfig: true`.
 */
export const publicServiceConfig = {
  select: {
    id: true,
    hostname: true,
    ipAddress: true,
    domain: true,
    region: true,
    config: true,
    createdAt: true,
  },
} as const;

/** Payments as shown to customers: never expose raw gateway payloads/signatures. */
export const publicPaymentFields = {
  id: true,
  userId: true,
  subscriptionId: true,
  amount: true,
  currency: true,
  status: true,
  method: true,
  invoiceUrl: true,
  paidAt: true,
  createdAt: true,
} as const;
