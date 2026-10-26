import { describe, it, expect } from 'vitest';
import { sanitizeBlogHtml } from './html-sanitize';
import { slugify, uniqueSlug, SLUG_PATTERN } from './slug';
import { sniffImageType, mediaUrl, IMAGE_URL_PATTERN, safeFilename } from './media';
import { stripHtml, truncate, readingMinutes, jsonLd } from './seo';
import { buildSitemapEntries, DISALLOWED_PATHS } from './sitemap';
import { blogPostSchema, blogCategorySchema, createProductSchema } from './api';

describe('sanitizeBlogHtml', () => {
  it('removes scripts, handlers and javascript: links', () => {
    const out = sanitizeBlogHtml('<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">l</a><iframe src="//e"></iframe>');
    expect(out).not.toMatch(/script|onclick|javascript:|iframe/i);
    expect(out).toContain('Hi');
  });
  it('keeps formatting and lazy-loads images; drops data: image sources', () => {
    const out = sanitizeBlogHtml('<h2>T</h2><img src="https://x.io/a.png" alt="a"><img src="data:image/png;base64,AAA">');
    expect(out).toContain('<h2>T</h2>');
    expect(out).toContain('loading="lazy"');
    expect(out).not.toContain('data:');
  });
  it('maps h1 to h2 and adds rel to _blank links', () => {
    const out = sanitizeBlogHtml('<h1>x</h1><a href="https://a.io" target="_blank">a</a>');
    expect(out).toContain('<h2>x</h2>');
    expect(out).toContain('noopener');
  });
});

describe('slug', () => {
  it('slugifies', () => {
    expect(slugify('  Hello, World! 2026 ')).toBe('hello-world-2026');
    expect(SLUG_PATTERN.test(slugify('Ünï Cödé & more'))).toBe(true);
  });
  it('makes slugs unique', async () => {
    const taken = new Set(['a', 'a-2']);
    expect(await uniqueSlug('a', async (s) => taken.has(s))).toBe('a-3');
    expect(await uniqueSlug('b', async (s) => taken.has(s))).toBe('b');
  });
});

describe('media', () => {
  it('sniffs image types from bytes, not names', () => {
    expect(sniffImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe('image/png');
    expect(sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('image/jpeg');
    expect(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode('<?php echo 1;'))).toBeNull();
  });
  it('builds and validates urls', () => {
    expect(IMAGE_URL_PATTERN.test(mediaUrl('abc123'))).toBe(true);
    expect(IMAGE_URL_PATTERN.test('https://x.io/a.png')).toBe(true);
    expect(IMAGE_URL_PATTERN.test('javascript:alert(1)')).toBe(false);
    expect(IMAGE_URL_PATTERN.test('http://x.io/a.png')).toBe(false);
  });
  it('cleans filenames', () => { expect(safeFilename('../../a b.png', 'image/png')).not.toMatch(/[\\/ ]/); });
});

describe('seo helpers', () => {
  it('strips html and truncates', () => {
    expect(stripHtml('<p>Hi <b>there</b></p>')).toBe('Hi there');
    expect(truncate('a'.repeat(300), 160).length).toBeLessThanOrEqual(160);
  });
  it('estimates reading time with a floor of 1', () => {
    expect(readingMinutes('<p>short</p>')).toBe(1);
    expect(readingMinutes(`<p>${'word '.repeat(450)}</p>`)).toBe(2);
  });
  it('escapes < in JSON-LD', () => { expect(jsonLd({ a: '</script><b>' })).not.toContain('</script>'); });
});

describe('sitemap', () => {
  const d = new Date('2026-10-01');
  const entries = buildSitemapEntries({
    siteUrl: 'https://x.io',
    products: [{ slug: 'vps-1', updatedAt: d }],
    posts: [{ slug: 'hello', updatedAt: d, publishedAt: d }],
  });
  it('lists static pages, products and posts', () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toEqual(expect.arrayContaining(['https://x.io/', 'https://x.io/blog', 'https://x.io/products/vps-1', 'https://x.io/blog/hello']));
  });
  it('never lists private areas', () => {
    expect(entries.some((e) => /\/(admin|api|dashboard|checkout|invoices)/.test(e.url))).toBe(false);
    expect(DISALLOWED_PATHS).toEqual(expect.arrayContaining(['/admin', '/api/', '/checkout']));
  });
});

describe('schemas', () => {
  it('requires a sensible blog post and defaults to DRAFT', () => {
    const p = blogPostSchema.parse({ title: 'Hello world', content: '<p>x</p>' });
    expect(p.status).toBe('DRAFT');
    expect(() => blogPostSchema.parse({ title: 'x', content: '' })).toThrow();
    expect(() => blogPostSchema.parse({ title: 'Valid title', content: 'x', slug: 'Bad Slug!' })).toThrow();
    expect(() => blogPostSchema.parse({ title: 'Valid title', content: 'x', coverImageUrl: 'javascript:alert(1)' })).toThrow();
  });
  it('validates categories', () => {
    expect(blogCategorySchema.parse({ name: 'News' }).name).toBe('News');
    expect(() => blogCategorySchema.parse({ name: 'x' })).toThrow();
  });
  it('accepts product SEO fields and limits length', () => {
    const base = { name: 'P', slug: 'p', description: 'd', category: 'VPS', features: [], specs: {} };
    expect(() => createProductSchema.parse({ ...base, metaDescription: 'a'.repeat(400) })).toThrow();
  });
});
