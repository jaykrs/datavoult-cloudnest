import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, billingProfileSchema } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { isValidGstin, stateCodeFromGstin, GST_STATES } from '@/lib/gst';
import { z } from 'zod';

const select = { billingName: true, billingGstin: true, billingAddress: true, billingStateCode: true } as const;

/** GET /api/billing-profile — the caller's invoice details. */
export async function GET() {
  try {
    const session = await requireAuth();
    const profile = await prisma.user.findUnique({ where: { id: session.userId as string }, select });
    return apiSuccess({ profile });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Internal server error', 500);
  }
}

/**
 * PUT /api/billing-profile — name / GSTIN / address / state used on invoices.
 * A GSTIN must be well-formed and its state code decides the state (so the two can't disagree).
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = billingProfileSchema.parse(await req.json());
    const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

    const gstin = blank(body.billingGstin);
    let stateCode = blank(body.billingStateCode);
    if (gstin) {
      if (!isValidGstin(gstin)) return apiError('That GSTIN is not valid. It should be 15 characters, e.g. 29ABCDE1234F1Z5.', 400);
      const fromGstin = stateCodeFromGstin(gstin);
      if (stateCode && stateCode !== fromGstin) {
        return apiError('The state does not match the first two digits of the GSTIN.', 400);
      }
      stateCode = fromGstin;
    }
    if (stateCode && !GST_STATES[stateCode]) return apiError('Choose a valid state', 400);

    const profile = await prisma.user.update({
      where: { id: session.userId as string },
      data: { billingName: blank(body.billingName), billingGstin: gstin, billingAddress: blank(body.billingAddress), billingStateCode: stateCode },
      select,
    });
    return apiSuccess({ profile });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[billing-profile PUT]', e);
    return apiError('Internal server error', 500);
  }
}
