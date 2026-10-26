import { prisma } from './prisma';

/** A post is public when it is PUBLISHED and its publish date has arrived (scheduled posts wait). */
export function publishedWhere(now: Date = new Date()) {
  return { status: 'PUBLISHED' as const, publishedAt: { lte: now } };
}

export const POSTS_PER_PAGE = 9;

export async function listPublishedPosts(opts: { categorySlug?: string; page: number }) {
  const where = {
    ...publishedWhere(),
    ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
  };
  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where, orderBy: { publishedAt: 'desc' },
      skip: (opts.page - 1) * POSTS_PER_PAGE, take: POSTS_PER_PAGE,
      select: {
        slug: true, title: true, excerpt: true, content: true, coverImageUrl: true, publishedAt: true,
        category: { select: { name: true, slug: true } },
      },
    }),
    prisma.blogPost.count({ where }),
  ]);
  return { posts, total, totalPages: Math.max(1, Math.ceil(total / POSTS_PER_PAGE)) };
}

export async function listBlogCategories() {
  const rows = await prisma.blogCategory.findMany({
    orderBy: { name: 'asc' },
    select: { name: true, slug: true, _count: { select: { posts: { where: publishedWhere() } } } },
  });
  return rows.filter((c) => c._count.posts > 0).map((c) => ({ name: c.name, slug: c.slug, count: c._count.posts }));
}

export async function getPublishedPost(slug: string) {
  return prisma.blogPost.findFirst({
    where: { slug, ...publishedWhere() },
    include: { category: { select: { name: true, slug: true } }, author: { select: { name: true } } },
  });
}

export async function relatedPosts(slug: string, categoryId: string | null) {
  return prisma.blogPost.findMany({
    where: { ...publishedWhere(), slug: { not: slug }, ...(categoryId ? { categoryId } : {}) },
    orderBy: { publishedAt: 'desc' }, take: 3,
    select: { slug: true, title: true, excerpt: true, coverImageUrl: true, publishedAt: true },
  });
}
