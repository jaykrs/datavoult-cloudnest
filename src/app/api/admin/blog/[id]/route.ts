import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, updateBlogPostSchema } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { sanitizeBlogHtml } from '@/lib/html-sanitize';
import { stripHtml } from '@/lib/seo';
import { z } from 'zod';

interface Params { params: { id: string } }

function authError(e: unknown) {
  const m = (e as Error).message;
  if (m === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
  if (m === 'FORBIDDEN') return apiError('Forbidden', 403);
  return null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const post = await prisma.blogPost.findUnique({ where: { id: params.id } });
    if (!post) return apiError('Post not found', 404);
    return apiSuccess({ post });
  } catch (e) {
    return authError(e) || apiError('Internal server error', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const data = updateBlogPostSchema.parse(await req.json());
    const current = await prisma.blogPost.findUnique({ where: { id: params.id } });
    if (!current) return apiError('Post not found', 404);

    if (data.slug && data.slug !== current.slug) {
      const clash = await prisma.blogPost.findUnique({ where: { slug: data.slug }, select: { id: true } });
      if (clash) return apiError('Another post already uses that slug', 409);
    }
    if (data.categoryId) {
      const cat = await prisma.blogCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } });
      if (!cat) return apiError('Category not found', 400);
    }

    const content = data.content !== undefined ? sanitizeBlogHtml(data.content) : undefined;
    const nextStatus = data.status ?? current.status;
    const finalContent = content ?? current.content;
    if (nextStatus === 'PUBLISHED' && !stripHtml(finalContent) && !/<img\b/i.test(finalContent)) {
      return apiError('Write some content before publishing', 400);
    }

    // First publish stamps the date; an explicit date (past = backdate, future = schedule) wins.
    let publishedAt: Date | null | undefined;
    if (data.publishedAt !== undefined) publishedAt = data.publishedAt ? new Date(data.publishedAt) : null;
    if (nextStatus === 'PUBLISHED' && !(publishedAt ?? current.publishedAt)) publishedAt = new Date();

    const post = await prisma.blogPost.update({
      where: { id: params.id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.slug && { slug: data.slug }),
        ...(content !== undefined && { content }),
        ...(data.excerpt !== undefined && { excerpt: data.excerpt }),
        ...(data.coverImageUrl !== undefined && { coverImageUrl: data.coverImageUrl }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.status !== undefined && { status: data.status }),
        ...(publishedAt !== undefined && { publishedAt }),
        ...(data.metaTitle !== undefined && { metaTitle: data.metaTitle }),
        ...(data.metaDescription !== undefined && { metaDescription: data.metaDescription }),
        ...(data.ogImageUrl !== undefined && { ogImageUrl: data.ogImageUrl }),
      },
    });
    return apiSuccess({ post });
  } catch (e) {
    const a = authError(e); if (a) return a;
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[admin/blog PATCH]', e);
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    await prisma.blogPost.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (e) {
    const a = authError(e); if (a) return a;
    if ((e as { code?: string }).code === 'P2025') return apiError('Post not found', 404);
    return apiError('Internal server error', 500);
  }
}
