import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import { docHref, getDoc, listDocs } from '@/lib/docs';
import { absoluteUrl } from '@/lib/seo';

type Props = { params: { slug?: string[] } };

const slugOf = (p: Props['params']) => (p.slug && p.slug.length === 1 ? p.slug[0] : p.slug ? null : 'index');

export const dynamicParams = false;
export function generateStaticParams() {
  return listDocs().map((d) => ({ slug: d.slug === 'index' ? [] : [d.slug] }));
}

export function generateMetadata({ params }: Props): Metadata {
  const slug = slugOf(params);
  const doc = slug ? getDoc(slug) : null;
  if (!doc) return { title: 'Not found — DataVoult Docs', robots: { index: false } };
  const title = doc.slug === 'index' ? 'Documentation — DataVoult' : `${doc.title} — DataVoult Docs`;
  const description = doc.summary || 'DataVoult documentation';
  return { title, description, alternates: { canonical: docHref(doc.slug) }, openGraph: { title, description, type: 'article', url: absoluteUrl(docHref(doc.slug)) } };
}

export default function DocsPage({ params }: Props) {
  const slug = slugOf(params);
  const doc = slug ? getDoc(slug) : null;
  if (!doc) notFound();
  const pages = listDocs();
  const i = pages.findIndex((p) => p.slug === doc.slug);
  const prev = i > 0 ? pages[i - 1] : null;
  const next = i >= 0 && i < pages.length - 1 ? pages[i + 1] : null;

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div className="docs-shell">
        <aside className="docs-nav" aria-label="Documentation pages">
          <div className="docs-nav-title">Documentation</div>
          <ul>
            {pages.map((p) => (
              <li key={p.slug}>
                <Link href={docHref(p.slug)} className={p.slug === doc.slug ? 'active' : undefined} aria-current={p.slug === doc.slug ? 'page' : undefined}>{p.title}</Link>
              </li>
            ))}
          </ul>
        </aside>

        <main className="docs-main">
          <nav className="docs-crumbs" aria-label="Breadcrumb">
            <Link href="/docs">Docs</Link>{doc.slug !== 'index' && <> <span>/</span> <span>{doc.title}</span></>}
          </nav>
          <article className="blog-content docs-body" dangerouslySetInnerHTML={{ __html: doc.html }} />
          <div className="docs-meta">{doc.updated ? `Last updated ${new Date(doc.updated).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}</div>
          <div className="docs-pager">
            {prev ? <Link href={docHref(prev.slug)}>← {prev.title}</Link> : <span />}
            {next ? <Link href={docHref(next.slug)}>{next.title} →</Link> : <span />}
          </div>
        </main>

        {doc.toc.length > 0 && (
          <aside className="docs-toc" aria-label="On this page">
            <div className="docs-nav-title">On this page</div>
            <ul>
              {doc.toc.map((t) => (
                <li key={t.id} style={{ paddingLeft: t.level === 3 ? 12 : 0 }}><a href={`#${t.id}`}>{t.text}</a></li>
              ))}
            </ul>
          </aside>
        )}
      </div>
      <Footer />
    </div>
  );
}
