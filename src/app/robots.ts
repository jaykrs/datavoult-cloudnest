import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo';
import { DISALLOWED_PATHS } from '@/lib/sitemap';

/** /robots.txt — keep private areas out of search, point crawlers at the sitemap. */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [{ userAgent: '*', allow: ['/', '/api/media/'], disallow: DISALLOWED_PATHS }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
