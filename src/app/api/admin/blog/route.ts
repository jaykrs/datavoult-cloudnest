import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, blogPostSchema, getPaginationParams, buildPaginationMeta } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { sanitizeBlogHtml } from '@/lib/html-sanitize';
import { slugify, uniqueSlug } from '@/lib/slug';
import { stripHtml } from '@/lib/seo';
import { z } from 'zod';
import { BlogStatus } from '@prisma/client';

/** GET /api/admin/blog — all posts (drafts included), newest first. */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const categoryId = url.searchParams.get('category');
    const search = (url.searchParams.get('search') || '').trim();
    const { page, limit, skip } = getPaginationParams(req);

    const where = {
  ...(status === 'DRAFT' || status === 'PUBLISHED' 
    ? { status: status as BlogStatus } // Explicitly cast the checked string to the enum type
    : {}),
  ...(categoryId ? { categoryId } : {}),
  ...(search ? { OR: [{ title: { contains: search } }, { slug: { contains: search } }] } : {}),
  };
    const [posts, total, drafts] = await Promise.all([
      prisma.blogPost.findMany({
        where, skip, take: limit, orderBy: { updatedAt: 'desc' },
        select: {
          id: true, title: true, slug: true, status: true, publishedAt: true, updatedAt: true, coverImageUrl: true,
          category: { select: { id: true, name: true } },
        },
      }),
      prisma.blogPost.count({ where }),
      prisma.blogPost.count({ where: { status: 'DRAFT' } }),
    ]);
    return apiSuccess({ posts, drafts, meta: buildPaginationMeta(total, page, limit) });
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    console.error('[admin/blog GET]', e);
    return apiError('Internal server error', 500);
  }
}

/** POST /api/admin/blog — create a post. Content is sanitised before it is stored. */
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    const data = blogPostSchema.parse(await req.json());

    const content = sanitizeBlogHtml(data.content);
    if (data.status === 'PUBLISHED' && !stripHtml(content) && !/<img\b/i.test(content)) {
      return apiError('Write some content before publishing', 400);
    }

    const base = data.slug || slugify(data.title);
    const slug = await uniqueSlug(base, async (s) => Boolean(await prisma.blogPost.findUnique({ where: { slug: s }, select: { id: true } })));

    if (data.categoryId) {
      const cat = await prisma.blogCategory.findUnique({ where: { id: data.categoryId }, select: { id: true } });
      if (!cat) return apiError('Category not found', 400);
    }

    const publishedAt = data.status === 'PUBLISHED' ? (data.publishedAt ? new Date(data.publishedAt) : new Date()) : null;
    const post = await prisma.blogPost.create({
      data: {
        title: data.title, slug, content,
        excerpt: data.excerpt ?? null,
        coverImageUrl: data.coverImageUrl ?? null,
        categoryId: data.categoryId ?? null,
        authorId: session.userId as string,
        status: data.status,
        publishedAt,
        metaTitle: data.metaTitle ?? null,
        metaDescription: data.metaDescription ?? null,
        ogImageUrl: data.ogImageUrl ?? null,
      },
    });
    return apiSuccess({ post }, 201);
  } catch (e) {
    if ((e as Error).message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    if ((e as Error).message === 'FORBIDDEN') return apiError('Forbidden', 403);
    if (e instanceof z.ZodError) return apiError(e.errors[0].message);
    console.error('[admin/blog POST]', e);
    return apiError('Internal server error', 500);
  }
}
