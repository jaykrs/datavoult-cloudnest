import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import { getPublishedPost, relatedPosts } from '@/lib/blog';
import { sanitizeBlogHtml } from '@/lib/html-sanitize';
import { absoluteUrl, getSiteUrl, jsonLd, readingMinutes, stripHtml, truncate } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Params = { params: { slug: string } };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await getPublishedPost(params.slug).catch(() => null);
  if (!post) return { title: 'Post not found — DataVoult', robots: { index: false } };
  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || truncate(stripHtml(post.content), 160);
  const image = post.ogImageUrl || post.coverImageUrl;
  const url = absoluteUrl(`/blog/${post.slug}`);
  return {
    title, description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article', title, description, url,
      publishedTime: post.publishedAt?.toISOString(), modifiedTime: post.updatedAt.toISOString(),
      ...(image ? { images: [{ url: absoluteUrl(image) }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, ...(image ? { images: [absoluteUrl(image)] } : {}) },
  };
}

export default async function BlogPostPage({ params }: Params) {
  const post = await getPublishedPost(params.slug).catch(() => null);
  if (!post) notFound();
  const related = await relatedPosts(post.slug, post.categoryId).catch(() => []);
  // Sanitised on save; sanitising again on render is cheap defence in depth.
  const html = sanitizeBlogHtml(post.content);
  const image = post.ogImageUrl || post.coverImageUrl;

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.metaDescription || post.excerpt || truncate(stripHtml(post.content), 160),
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    ...(image ? { image: absoluteUrl(image) } : {}),
    ...(post.author?.name ? { author: { '@type': 'Person', name: post.author.name } } : {}),
    publisher: { '@type': 'Organization', name: 'DataVoult', url: getSiteUrl() },
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <main className="container" style={{ maxWidth: 780, padding: '48px 24px' }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structured) }} />
        <Link href="/blog" style={{ fontSize: 13, color: 'var(--text-muted)' }}>← Back to blog</Link>
        <article>
          <header style={{ margin: '16px 0 24px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
              {post.category && <Link href={`/blog?category=${post.category.slug}`} style={{ color: 'var(--accent-bright)', fontWeight: 600 }}>{post.category.name}</Link>}
              {post.category ? ' · ' : ''}
              {post.publishedAt?.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · {readingMinutes(post.content)} min read
              {post.author?.name ? ` · ${post.author.name}` : ''}
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.2 }}>{post.title}</h1>
          </header>
          {post.coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.coverImageUrl} alt="" style={{ width: '100%', borderRadius: 'var(--radius-lg)', marginBottom: 24 }} />
          )}
          <div className="blog-content" dangerouslySetInnerHTML={{ __html: html }} />
        </article>

        <aside style={{ marginTop: 40, padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Ready to deploy?</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 14 }}>VPS, Docker hosting and business email — billed per day in ₹.</p>
          <Link href="/products" className="btn btn-primary">Browse products</Link>
        </aside>

        {related.length > 0 && (
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Keep reading</h2>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none', padding: 0 }}>
              {related.map((r) => (
                <li key={r.slug}><Link href={`/blog/${r.slug}`} style={{ color: 'var(--accent-bright)' }}>{r.title}</Link></li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
