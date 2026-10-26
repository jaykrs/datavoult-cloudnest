import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, blogCategorySchema } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { slugify, uniqueSlug } from '@/lib/slug';
import { z } from 'zod';

export async function GET() {
  try {
    await requireAdmin();
    const rows = await prisma.blogCategory.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { posts: true } } } });
    return apiSuccess({ categories: rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, posts: c._count.posts })) });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    return apiError('Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const data = blogCategorySchema.parse(await req.json());
    const nameTaken = await prisma.blogCategory.findFirst({ where: { name: data.name }, select: { id: true } });
    if (nameTaken) return apiError('A category with that name already exists', 409);
    const slug = await uniqueSlug(data.slug || slugify(data.name), async (s) => Boolean(await prisma.blogCategory.findUnique({ where: { slug: s }, select: { id: true } })));
    const category = await prisma.blogCategory.create({ data: { name: data.name, slug, description: data.description ?? null } });
    return apiSuccess({ category }, 201);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    return apiError('Internal server error', 500);
  }
}
