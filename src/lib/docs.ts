import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

/**
 * Public documentation, rendered from the Markdown files in /docs at the repo root.
 * Add or edit a file there, commit, deploy — the site (sidebar, table of contents,
 * sitemap) follows. Files are named `<slug>.md`; `index.md` is the landing page.
 */

export interface DocMeta { slug: string; title: string; order: number; summary: string; updated: string | null }
export interface DocToc { id: string; text: string; level: 2 | 3 }
export interface DocPage extends DocMeta { html: string; toc: DocToc[] }

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const DOCS_DIR = path.join(process.cwd(), 'docs');

/** Tiny `---` front-matter reader (key: value lines). Unknown/invalid files fall back to defaults. */
export function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const m = raw.replace(/^﻿/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return { data, body: m[2] };
}

export function slugifyHeading(text: string): string {
  return text.toLowerCase().replace(/&[a-z]+;/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section';
}

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr', 'blockquote', 'pre', 'code', 'strong', 'b', 'em', 'i', 'del', 'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  allowedAttributes: {
    a: ['href', 'title', 'rel', 'target'],
    img: ['src', 'alt', 'title'],
    code: ['class'],
    th: ['align'], td: ['align'],
  },
  allowedClasses: { code: [/^language-[a-z0-9+-]+$/] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tag, attribs) => /^https?:\/\//i.test(attribs.href || '')
      ? { tagName: 'a', attribs: { ...attribs, rel: 'noopener noreferrer', target: '_blank' } }
      : { tagName: 'a', attribs },
  },
};

/** Markdown → sanitised HTML with anchor ids on h2/h3 and the matching table of contents. */
export function renderMarkdown(markdown: string): { html: string; toc: DocToc[] } {
  const raw = marked.parse(markdown, { async: false, gfm: true }) as string;
  const clean = sanitizeHtml(raw, SANITIZE);
  const toc: DocToc[] = [];
  const used = new Set<string>();
  const html = clean.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, lvl: string, inner: string) => {
    const text = sanitizeHtml(inner, { allowedTags: [], allowedAttributes: {} }).replace(/&amp;/g, '&').trim();
    let id = slugifyHeading(text);
    for (let n = 2; used.has(id); n++) id = `${slugifyHeading(text)}-${n}`;
    used.add(id);
    toc.push({ id, text, level: Number(lvl) as 2 | 3 });
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });
  return { html, toc };
}

function readDoc(file: string, dir: string): { meta: DocMeta; body: string } | null {
  const slug = file.replace(/\.md$/, '');
  if (!SLUG.test(slug)) return null;
  const { data, body } = parseFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'));
  const h1 = body.match(/^#\s+(.+)$/m)?.[1];
  const order = Number(data.order);
  return {
    meta: {
      slug,
      title: data.title || h1 || slug,
      order: Number.isFinite(order) ? order : 1000,
      summary: data.summary || '',
      updated: /^\d{4}-\d{2}-\d{2}$/.test(data.updated || '') ? data.updated : null,
    },
    body,
  };
}

/** All pages, in sidebar order (front-matter `order`, then title). Missing folder → empty list. */
export function listDocs(dir: string = DOCS_DIR): DocMeta[] {
  let files: string[];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')); } catch { return []; }
  return files
    .map((f) => readDoc(f, dir)?.meta)
    .filter((m): m is DocMeta => Boolean(m))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

/** One page by slug. The slug must match a real file name (never joined from user input otherwise). */
export function getDoc(slug: string, dir: string = DOCS_DIR): DocPage | null {
  if (!SLUG.test(slug)) return null;
  const file = `${slug}.md`;
  let exists: boolean;
  try { exists = fs.readdirSync(dir).includes(file); } catch { return null; }
  if (!exists) return null;
  const doc = readDoc(file, dir);
  if (!doc) return null;
  return { ...doc.meta, ...renderMarkdown(doc.body) };
}

export const docHref = (slug: string) => (slug === 'index' ? '/docs' : `/docs/${slug}`);
