export interface SitemapEntry {
  url: string;
  lastModified?: Date;
  changeFrequency?: 'daily' | 'weekly' | 'monthly';
  priority?: number;
}

/** Public, indexable pages that exist regardless of the database. */
const STATIC_PAGES: Array<{ path: string; priority: number; changeFrequency: SitemapEntry['changeFrequency'] }> = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/products', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/blog', priority: 0.8, changeFrequency: 'daily' },
  { path: '/contact', priority: 0.4, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'monthly' },
];

/**
 * Everything search engines should crawl: the static pages, live products and
 * published posts. Private areas (admin, dashboard, checkout, invoices, API) are
 * never listed — and are disallowed in robots.txt.
 */
export function buildSitemapEntries(input: {
  siteUrl: string;
  products: Array<{ slug: string; updatedAt: Date }>;
  posts: Array<{ slug: string; updatedAt: Date; publishedAt: Date | null }>;
}): SitemapEntry[] {
  const at = (path: string) => `${input.siteUrl}${path}`;
  const entries: SitemapEntry[] = STATIC_PAGES.map((p) => ({
    url: at(p.path), changeFrequency: p.changeFrequency, priority: p.priority,
  }));
  for (const p of input.products) {
    entries.push({ url: at(`/products/${encodeURIComponent(p.slug)}`), lastModified: p.updatedAt, changeFrequency: 'weekly', priority: 0.7 });
  }
  for (const post of input.posts) {
    entries.push({ url: at(`/blog/${encodeURIComponent(post.slug)}`), lastModified: post.updatedAt, changeFrequency: 'monthly', priority: 0.6 });
  }
  return entries;
}

/** Paths crawlers must stay out of. */
export const DISALLOWED_PATHS = [
  '/admin', '/api/', '/dashboard', '/services', '/billing', '/profile', '/settings',
  '/checkout', '/invoices', '/cloudops', '/login', '/register',
];
