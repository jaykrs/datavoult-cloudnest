import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, contactStatusSchema } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { z } from 'zod';

interface Params { params: { id: string } }

function authError(e: unknown) {
  const m = (e as Error).message;
  if (m === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
  if (m === 'FORBIDDEN') return apiError('Forbidden', 403);
  return null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { status } = contactStatusSchema.parse(await req.json());
    const message = await prisma.contactMessage.update({ where: { id: params.id }, data: { status } });
    return apiSuccess({ message });
  } catch (e) {
    const a = authError(e); if (a) return a;
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    if ((e as { code?: string }).code === 'P2025') return apiError('Message not found', 404);
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    await prisma.contactMessage.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (e) {
    const a = authError(e); if (a) return a;
    if ((e as { code?: string }).code === 'P2025') return apiError('Message not found', 404);
    return apiError('Internal server error', 500);
  }
}
