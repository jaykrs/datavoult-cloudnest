import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import { listPublishedPosts, listBlogCategories } from '@/lib/blog';
import { readingMinutes, stripHtml, truncate, absoluteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Search = { category?: string; page?: string };

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const cats = await listBlogCategories().catch(() => []);
  const active = cats.find((c) => c.slug === searchParams.category);
  const title = active ? `${active.name} — DataVoult Blog` : 'Blog — DataVoult';
  const description = 'Guides, product news and tips on VPS, Docker hosting and business email from the DataVoult team.';
  const canonical = active ? `/blog?category=${active.slug}` : '/blog';
  return { title, description, alternates: { canonical }, openGraph: { title, description, url: absoluteUrl(canonical), type: 'website' } };
}

const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export default async function BlogListPage({ searchParams }: { searchParams: Search }) {
  const page = Math.max(1, parseInt(searchParams.page || '1', 10) || 1);
  const [categories, { posts, totalPages }] = await Promise.all([
    listBlogCategories().catch(() => []),
    listPublishedPosts({ categorySlug: searchParams.category, page }).catch(() => ({ posts: [], total: 0, totalPages: 1 })),
  ]);
  const active = categories.find((c) => c.slug === searchParams.category)?.slug;
  const href = (cat: string | undefined, p = 1) => {
    const q = new URLSearchParams();
    if (cat) q.set('category', cat);
    if (p > 1) q.set('page', String(p));
    const s = q.toString();
    return s ? `/blog?${s}` : '/blog';
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <main className="container" style={{ padding: '56px 24px' }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>Blog</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Guides, product news and tips on cloud hosting.</p>

        {categories.length > 0 && (
          <nav aria-label="Categories" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
            <Link href="/blog" className={`btn btn-sm ${!active ? 'btn-primary' : 'btn-secondary'}`}>All</Link>
            {categories.map((c) => (
              <Link key={c.slug} href={href(c.slug)} className={`btn btn-sm ${active === c.slug ? 'btn-primary' : 'btn-secondary'}`}>{c.name} ({c.count})</Link>
            ))}
          </nav>
        )}

        {posts.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No posts here yet — check back soon.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {posts.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {p.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverImageUrl} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' }} />
                )}
                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {p.category?.name ? <span style={{ color: 'var(--accent-bright)', fontWeight: 600 }}>{p.category.name}</span> : null}
                    {p.category?.name ? ' · ' : ''}{fmt(p.publishedAt)} · {readingMinutes(p.content)} min read
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3 }}>{p.title}</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>{p.excerpt || truncate(stripHtml(p.content), 150)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginTop: 32 }}>
            {page > 1 ? <Link className="btn btn-secondary btn-sm" href={href(active, page - 1)} rel="prev">← Newer</Link> : <span />}
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} of {totalPages}</span>
            {page < totalPages ? <Link className="btn btn-secondary btn-sm" href={href(active, page + 1)} rel="next">Older →</Link> : <span />}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
