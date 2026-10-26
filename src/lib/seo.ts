/** Small SEO helpers shared by pages, the sitemap and JSON-LD. */

/** Public base URL of the site (no trailing slash). Set APP_URL in production. */
export function getSiteUrl(): string {
  const raw = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${getSiteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Remove tags/entities and collapse whitespace — for descriptions and word counts. */
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cut at a word boundary and add an ellipsis; text that already fits is returned as is. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:-]+$/, '')}…`;
}

/** Reading time in whole minutes (at least 1), at 200 words per minute. */
export function readingMinutes(html: string): number {
  const words = stripHtml(html).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** JSON for a <script type="application/ld+json"> tag; `<` is escaped so content can't close the tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
