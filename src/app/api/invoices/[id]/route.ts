import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { issueInvoice, serializeInvoice } from '@/lib/invoices';

/**
 * GET /api/invoices/:id — `id` is an invoice id OR the id of the payment it belongs to
 * (the billing page only knows payment ids). Customers can open only their own;
 * admins can open any. If a completed payment has no invoice yet (e.g. seller details
 * were not configured when it was paid) it is issued now.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    const userId = session.userId as string;
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    let invoice = await prisma.invoice.findFirst({
      where: { OR: [{ id: params.id }, { paymentId: params.id }] },
    });

    if (!invoice) {
      const payment = await prisma.payment.findUnique({ where: { id: params.id }, select: { id: true, userId: true } });
      if (!payment || (payment.userId !== userId && !isAdmin)) return apiError('Invoice not found', 404);
      const issued = await issueInvoice(payment.id);
      if (!issued) return apiError('Your invoice is being prepared. Please try again shortly.', 409);
      invoice = issued.invoice;
    }

    if (invoice.userId !== userId && !isAdmin) return apiError('Invoice not found', 404);
    return apiSuccess({ invoice: serializeInvoice(invoice) });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[invoices GET]', e);
    return apiError('Internal server error', 500);
  }
}
