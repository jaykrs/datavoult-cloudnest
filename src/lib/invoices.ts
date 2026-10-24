import { prisma } from './prisma';
import { getSeller, type Seller } from './seller';
import {
  financialYear, formatInvoiceNumber, isIntraState, splitGst, stateCodeFromGstin, stateName, amountInWords,
} from './gst';
import { notifyInvoiceIssued } from './notifications';

export const DEFAULT_SAC = '998315'; // hosting & IT infrastructure provisioning services

export interface InvoiceFigures {
  /** All in paise. */
  taxable: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  intraState: boolean;
  /** GST state code used as place of supply (null if neither party's state is known). */
  placeOfSupplyCode: string | null;
}

/**
 * Pure maths of an invoice. `totalPaise` is what the customer actually paid;
 * `gstPaise` (from the payment-time snapshot) is the GST contained in it. No GST →
 * a plain invoice with zero tax lines.
 */
export function buildInvoiceFigures(input: {
  totalPaise: number;
  gstPaise: number;
  gstRate: number;
  sellerStateCode: string | null;
  buyerStateCode: string | null;
}): InvoiceFigures {
  const gstPaise = input.gstRate > 0 ? Math.min(Math.max(input.gstPaise, 0), input.totalPaise) : 0;
  const intraState = isIntraState(input.sellerStateCode, input.buyerStateCode);
  const split = splitGst(gstPaise, intraState);
  return {
    taxable: input.totalPaise - gstPaise,
    gstRate: gstPaise > 0 ? input.gstRate : 0,
    ...split,
    total: input.totalPaise,
    intraState,
    placeOfSupplyCode: input.buyerStateCode || input.sellerStateCode,
  };
}

const money = (paise: number) => (paise / 100).toFixed(2);

function isUnique(e: unknown) {
  return (e as { code?: string })?.code === 'P2002';
}

/**
 * Create the invoice for a completed payment. Idempotent (one invoice per payment)
 * and gap-free: the serial is taken inside the same transaction that stores the
 * invoice. Returns null when it can't be issued yet (seller details missing, or GST
 * was charged but no seller GSTIN is configured) — it is retried on the next view.
 */
export async function issueInvoice(paymentId: string) {
  const existing = await prisma.invoice.findUnique({ where: { paymentId } });
  if (existing) return { invoice: existing, created: false };

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true, subscription: { include: { product: true, plan: true } } },
  });
  if (!payment || payment.status !== 'COMPLETED') return null;

  const seller = getSeller();
  if (!seller) {
    console.error('[invoice] SELLER_NAME / SELLER_ADDRESS are not configured — invoice not issued for', paymentId);
    return null;
  }

  const data = (payment.gatewayData ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const totalPaise = Math.round(payment.amount.toNumber() * 100);
  const gstPaise = num(data.gstPaise);
  const gstRate = num(data.gstRate);
  if (gstPaise > 0 && !seller.gstin) {
    console.error('[invoice] GST was charged but SELLER_GSTIN is not configured — invoice not issued for', paymentId);
    return null;
  }

  const user = payment.user;
  const buyerGstin = user.billingGstin || null;
  const buyerStateCode = user.billingStateCode || stateCodeFromGstin(buyerGstin);
  const figures = buildInvoiceFigures({
    totalPaise, gstPaise, gstRate, sellerStateCode: seller.stateCode, buyerStateCode,
  });

  const days = num(data.days) || null;
  const sub = payment.subscription;
  const description = sub
    ? `${sub.product.name} — ${sub.plan.name} plan${days ? `, ${days} days` : ''}`
    : 'Cloud infrastructure services';
  const posName = stateName(figures.placeOfSupplyCode);
  const placeOfSupply = figures.placeOfSupplyCode ? `${posName ?? 'State'} (${figures.placeOfSupplyCode})` : null;

  const buyer = {
    name: user.billingName || user.name,
    email: user.email,
    gstin: buyerGstin,
    address: user.billingAddress || null,
    stateCode: buyerStateCode,
    stateName: stateName(buyerStateCode),
  };
  const sacCode = (sub?.product as { sacCode?: string | null } | undefined)?.sacCode || DEFAULT_SAC;
  const issuedAt = new Date();
  const fy = financialYear(issuedAt);

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const invoice = await prisma.$transaction(async (tx) => {
        const counter = await tx.invoiceCounter.upsert({
          where: { id: fy.key },
          create: { id: fy.key, lastNumber: 1 },
          update: { lastNumber: { increment: 1 } },
        });
        return tx.invoice.create({
          data: {
            number: formatInvoiceNumber(seller.prefix, fy.key, counter.lastNumber),
            fy: fy.label,
            paymentId: payment.id,
            userId: user.id,
            subscriptionId: payment.subscriptionId,
            issuedAt,
            description,
            sacCode,
            days,
            taxableAmount: money(figures.taxable),
            gstRate: figures.gstRate.toFixed(2),
            cgst: money(figures.cgst),
            sgst: money(figures.sgst),
            igst: money(figures.igst),
            total: money(figures.total),
            placeOfSupply,
            seller: seller as unknown as object,
            buyer,
          },
        });
      });
      return { invoice, created: true };
    } catch (e) {
      if (!isUnique(e)) throw e;
      // Either another request issued this payment's invoice, or two requests raced to
      // create the year's first counter row. Prefer the existing invoice, else retry.
      const raced = await prisma.invoice.findUnique({ where: { paymentId } });
      if (raced) return { invoice: raced, created: false };
    }
  }
  return null;
}

/** Issue the invoice for a payment looked up by its gateway id, email it if new. Never throws. */
export async function issueInvoiceForGatewayId(gatewayId: string): Promise<void> {
  try {
    const payment = await prisma.payment.findUnique({ where: { gatewayId }, select: { id: true } });
    if (!payment) return;
    const result = await issueInvoice(payment.id);
    if (result?.created) await notifyInvoiceIssued(result.invoice.id);
  } catch (e) {
    console.error('[invoice] could not issue invoice for', gatewayId, (e as Error).message);
  }
}

type DecimalLike = { toNumber(): number };
interface InvoiceRow {
  id: string; number: string; fy: string; paymentId: string; issuedAt: Date; description: string;
  sacCode: string | null; days: number | null; placeOfSupply: string | null;
  taxableAmount: DecimalLike; gstRate: DecimalLike; cgst: DecimalLike; sgst: DecimalLike; igst: DecimalLike; total: DecimalLike;
  seller: unknown; buyer: unknown;
}

/** Plain-number view of an invoice for the API / printable page. */
export function serializeInvoice(inv: InvoiceRow) {
  const n = (d: DecimalLike) => d.toNumber();
  const total = n(inv.total);
  return {
    id: inv.id,
    number: inv.number,
    fy: inv.fy,
    paymentId: inv.paymentId,
    issuedAt: inv.issuedAt,
    description: inv.description,
    sacCode: inv.sacCode,
    days: inv.days,
    placeOfSupply: inv.placeOfSupply,
    taxable: n(inv.taxableAmount),
    gstRate: n(inv.gstRate),
    cgst: n(inv.cgst),
    sgst: n(inv.sgst),
    igst: n(inv.igst),
    total,
    totalInWords: amountInWords(Math.round(total * 100)),
    hasGst: n(inv.gstRate) > 0,
    seller: inv.seller as Seller,
    buyer: inv.buyer as {
      name: string; email: string; gstin: string | null; address: string | null; stateCode: string | null; stateName: string | null;
    },
  };
}
