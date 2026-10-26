import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, updateBlogCategorySchema } from '@/lib/api';
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
    const data = updateBlogCategorySchema.parse(await req.json());
    if (data.name) {
      const clash = await prisma.blogCategory.findFirst({ where: { name: data.name, id: { not: params.id } }, select: { id: true } });
      if (clash) return apiError('A category with that name already exists', 409);
    }
    if (data.slug) {
      const clash = await prisma.blogCategory.findFirst({ where: { slug: data.slug, id: { not: params.id } }, select: { id: true } });
      if (clash) return apiError('That slug is already used by another category', 409);
    }
    const category = await prisma.blogCategory.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug && { slug: data.slug }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });
    return apiSuccess({ category });
  } catch (e) {
    const a = authError(e); if (a) return a;
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    if ((e as { code?: string }).code === 'P2025') return apiError('Category not found', 404);
    return apiError('Internal server error', 500);
  }
}

/** Deleting a category keeps its posts (they become uncategorised). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    await prisma.blogCategory.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (e) {
    const a = authError(e); if (a) return a;
    if ((e as { code?: string }).code === 'P2025') return apiError('Category not found', 404);
    return apiError('Internal server error', 500);
  }
}
