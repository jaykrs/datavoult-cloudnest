import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { absoluteUrl, jsonLd, stripHtml, truncate } from '@/lib/seo';

type Params = { params: { slug: string } };

async function loadProduct(slug: string) {
  try {
    return await prisma.product.findUnique({
      where: { slug },
      select: { name: true, slug: true, description: true, status: true, imageUrl: true, metaTitle: true, metaDescription: true, metaKeywords: true, ogImageUrl: true },
    });
  } catch {
    return null;
  }
}

/** Product SEO: admin-set meta fields win; otherwise derive from the name and description. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await loadProduct(params.slug);
  if (!p) return { title: 'Product — DataVoult' };
  const title = p.metaTitle || `${p.name} — DataVoult`;
  const description = p.metaDescription || truncate(stripHtml(p.description), 160);
  const image = p.ogImageUrl || p.imageUrl;
  return {
    title, description,
    ...(p.metaKeywords ? { keywords: p.metaKeywords.split(',').map((k) => k.trim()).filter(Boolean) } : {}),
    alternates: { canonical: `/products/${p.slug}` },
    // Unavailable products stay reachable by link but are kept out of search results.
    ...(p.status !== 'ACTIVE' ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: 'website', title, description, url: absoluteUrl(`/products/${p.slug}`), ...(image ? { images: [{ url: absoluteUrl(image) }] } : {}) },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, ...(image ? { images: [absoluteUrl(image)] } : {}) },
  };
}

export default async function ProductLayout({ children, params }: Params & { children: React.ReactNode }) {
  const p = await loadProduct(params.slug);
  const ld = p && p.status === 'ACTIVE' ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.metaDescription || truncate(stripHtml(p.description), 300),
    url: absoluteUrl(`/products/${p.slug}`),
    ...((p.ogImageUrl || p.imageUrl) ? { image: absoluteUrl((p.ogImageUrl || p.imageUrl) as string) } : {}),
    brand: { '@type': 'Brand', name: 'DataVoult' },
  } : null;
  return (
    <>
      {ld && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />}
      {children}
    </>
  );
}
