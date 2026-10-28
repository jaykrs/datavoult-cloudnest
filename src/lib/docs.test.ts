import { describe, it, expect } from 'vitest';
import { parseFrontmatter, renderMarkdown, listDocs, getDoc, slugifyHeading, docHref } from './docs';
import { buildSitemapEntries } from './sitemap';

describe('front-matter', () => {
  it('reads key/value pairs and the body', () => {
    const r = parseFrontmatter('---\ntitle: "Hello"\norder: 2\n---\n# Body');
    expect(r.data).toEqual({ title: 'Hello', order: '2' });
    expect(r.body).toBe('# Body');
  });
  it('treats files without front-matter as all body', () => {
    expect(parseFrontmatter('# Just text').body).toBe('# Just text');
  });
});

describe('renderMarkdown', () => {
  it('adds unique anchor ids and builds the table of contents', () => {
    const { html, toc } = renderMarkdown('# T\n\n## Setup\n\n### Step A\n\n## Setup\n');
    expect(toc).toEqual([
      { id: 'setup', text: 'Setup', level: 2 },
      { id: 'step-a', text: 'Step A', level: 3 },
      { id: 'setup-2', text: 'Setup', level: 2 },
    ]);
    expect(html).toContain('<h2 id="setup">Setup</h2>');
  });
  it('strips scripts, event handlers, iframes and javascript: links', () => {
    const { html } = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))\n\n<iframe src="https://e.com"></iframe>\n\n<a href="x" onclick="y()">z</a>');
    expect(html).not.toMatch(/<script|onerror|onclick|javascript:|<iframe/i);
  });
  it('keeps code blocks, tables and safe links; external links get noopener', () => {
    const { html } = renderMarkdown('```bash\nssh a@b\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n[ext](https://example.com) [int](/docs/x)');
    expect(html).toContain('class="language-bash"');
    expect(html).toContain('<table>');
    expect(html).toMatch(/href="https:\/\/example.com"[^>]*rel="noopener noreferrer"/);
    expect(html).toContain('href="/docs/x"');
  });
  it('slugifies headings safely', () => {
    expect(slugifyHeading('Hello, World & More!')).toBe('hello-world-more');
    expect(slugifyHeading('???')).toBe('section');
  });
});

describe('getDoc / listDocs', () => {
  it('refuses anything that is not a plain slug of a real file', () => {
    for (const bad of ['../README', '..%2FREADME', 'a/b', 'INDEX', '', 'nope-not-a-page', 'index.md']) expect(getDoc(bad)).toBeNull();
  });
  it('returns an empty list for a missing folder', () => {
    expect(listDocs('/definitely/not/here')).toEqual([]);
  });
});

describe('the shipped documentation', () => {
  const pages = listDocs();
  it('has an index first, with titles and unique slugs', () => {
    expect(pages.length).toBeGreaterThanOrEqual(5);
    expect(pages[0].slug).toBe('index');
    expect(new Set(pages.map((p) => p.slug)).size).toBe(pages.length);
    for (const p of pages) { expect(p.title.length).toBeGreaterThan(2); expect(p.summary.length).toBeGreaterThan(5); }
  });
  it('renders every page and every internal /docs link points at a real page', () => {
    const slugs = new Set(pages.map((p) => p.slug));
    for (const p of pages) {
      const doc = getDoc(p.slug)!;
      expect(doc.html.length).toBeGreaterThan(200);
      for (const m of Array.from(doc.html.matchAll(/href="\/docs(?:\/([a-z0-9-]+))?(?:#[^"]*)?"/g))) {
        expect(slugs.has(m[1] ?? 'index'), `${p.slug} links to missing page ${m[1]}`).toBe(true);
      }
    }
  });
  it('maps the index to /docs and others to /docs/<slug>', () => {
    expect(docHref('index')).toBe('/docs');
    expect(docHref('your-service')).toBe('/docs/your-service');
  });
  it('is included in the sitemap', () => {
    const urls = buildSitemapEntries({ siteUrl: 'https://x.io', products: [], posts: [], docs: pages.map((p) => p.slug) }).map((e) => e.url);
    expect(urls).toContain('https://x.io/docs');
    expect(urls).toContain('https://x.io/docs/products-and-pricing');
    expect(urls.filter((u) => u === 'https://x.io/docs').length).toBe(1);
  });
});
