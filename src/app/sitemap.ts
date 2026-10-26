import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { getSiteUrl } from '@/lib/seo';
import { buildSitemapEntries } from '@/lib/sitemap';
import { publishedWhere } from '@/lib/blog';

// Built per request (cached briefly) so new products/posts appear without a redeploy.
export const dynamic = 'force-dynamic';

/** /sitemap.xml — static pages + active, in-stock-agnostic products + published posts. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let products: Array<{ slug: string; updatedAt: Date }> = [];
  let posts: Array<{ slug: string; updatedAt: Date; publishedAt: Date | null }> = [];
  try {
    [products, posts] = await Promise.all([
      prisma.product.findMany({ where: { status: 'ACTIVE' }, select: { slug: true, updatedAt: true } }),
      prisma.blogPost.findMany({ where: publishedWhere(), select: { slug: true, updatedAt: true, publishedAt: true } }),
    ]);
  } catch (e) {
    // A database hiccup must not break crawling of the static pages.
    console.error('[sitemap] database unavailable, serving static pages only:', (e as Error).message);
  }
  return buildSitemapEntries({ siteUrl: getSiteUrl(), products, posts });
}
