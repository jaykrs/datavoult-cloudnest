'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/marketing/Navbar';
import { Server, Package, Mail, Check, ArrowRight, Star } from 'lucide-react';

/** 
 * INTERFACES 
 */
interface Plan {
  id: string;
  name: string;
  price: number;
  billingCycle: string;
  isPopular: boolean;
  limits: Record<string, string>;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  features: string[];
  plans: Plan[];
}

const categoryMeta: Record<string, { icon: React.ReactNode; color: string; glow: string }> = {
  VPS: { icon: <Server size={20} />, color: 'var(--vps-color)', glow: 'rgba(59,130,246,0.1)' },
  DOCKER: { icon: <Package size={20} />, color: 'var(--docker-color)', glow: 'rgba(6,182,212,0.1)' },
  EMAIL: { icon: <Mail size={20} />, color: 'var(--email-color)', glow: 'rgba(139,92,246,0.1)' },
};

/**
 * COMPONENT: ProductsList
 * Contains the actual logic and UI. 
 * Must be wrapped in Suspense because of useSearchParams().
 */
function ProductsList() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || 'all');

  useEffect(() => {
    const url = activeCategory !== 'all' 
      ? `/api/products?category=${activeCategory}` 
      : '/api/products';
    
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.data?.products || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch products:", err);
        setLoading(false);
      });
  }, [activeCategory]);

  const categories = [
    { value: 'all', label: 'All Products' },
    { value: 'VPS', label: 'Cloud VPS', icon: <Server size={14} /> },
    { value: 'DOCKER', label: 'Docker', icon: <Package size={14} /> },
    { value: 'EMAIL', label: 'Email', icon: <Mail size={14} /> },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <div style={{ paddingTop: 96 }}>
        {/* Header & Category Filter */}
        <div style={{ padding: '48px 0 40px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
          <div className="container">
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 48px)', marginBottom: 8 }}>Products</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Choose from our range of high-performance cloud services.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 28, flexWrap: 'wrap' }}>
              {categories.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setActiveCategory(c.value)}
                  className="btn btn-sm"
                  style={{
                    background: activeCategory === c.value ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: activeCategory === c.value ? 'white' : 'var(--text-secondary)',
                    border: activeCategory === c.value ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Listing Section */}
        <div className="container" style={{ padding: '40px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <span className="spinner" style={{ width: 32, height: 32 }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
              {products.map((product) => {
                const meta = categoryMeta[product.category] || categoryMeta.VPS;
                return (
                  <div key={product.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                    
                    {/* Product Header */}
                    <div style={{ padding: '32px 32px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                        <div style={{ width: 52, height: 52, borderRadius: 12, background: meta.glow, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${meta.color}22`, flexShrink: 0 }}>
                          {meta.icon}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26 }}>{product.name}</h2>
                            <span className={`badge badge-${product.category.toLowerCase()}`}>{product.category}</span>
                          </div>
                          <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 600, lineHeight: 1.6 }}>{product.description}</p>
                        </div>
                      </div>
                      <Link href={`/products/${product.slug}`} className="btn btn-secondary btn-sm">
                        Details <ArrowRight size={14} />
                      </Link>
                    </div>

                    {/* Features Strip */}
                    <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      {product.features.slice(0, 6).map((f) => (
                        <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                          <Check size={13} color={meta.color} /> {f}
                        </div>
                      ))}
                    </div>

                    {/* Plans Grid */}
                    <div style={{ padding: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                      {product.plans.map((plan) => (
                        <div
                          key={plan.id}
                          className="plan-card"
                          style={{
                            background: plan.isPopular ? `linear-gradient(135deg, ${meta.glow}, transparent)` : 'var(--bg-elevated)',
                            border: plan.isPopular ? `1px solid ${meta.color}44` : '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            padding: 20,
                            position: 'relative',
                          }}
                        >
                          {plan.isPopular && (
                            <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: meta.color, color: 'white', fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                              <Star size={10} fill="white" /> Popular
                            </div>
                          )}
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{plan.name}</div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 12 }}>
                            {/* Updated to Indian Rupee Symbol */}
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>₹{plan.price}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/mo</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                            {Object.entries(plan.limits).slice(0, 4).map(([k, v]) => (
                              <div key={k} style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{k}</span>
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{String(v)}</span>
                              </div>
                            ))}
                          </div>
                          <Link
                            href={`/checkout?plan=${plan.id}&product=${product.id}`}
                            className="btn btn-sm"
                            style={{
                              width: '100%',
                              justifyContent: 'center',
                              display: 'flex',
                              background: plan.isPopular ? meta.color : 'var(--bg-hover)',
                              color: plan.isPopular ? 'white' : 'var(--text-secondary)',
                              border: plan.isPopular ? 'none' : '1px solid var(--border)',
                            }}
                          >
                            Subscribe
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * PAGE ENTRY POINT
 * Wraps logic in Suspense to prevent build errors related to useSearchParams()
 */
export default function ProductsPage() {
  return (
    <>
      <style>{`
        .plan-card { transition: border-color 0.2s, box-shadow 0.2s; }
        .plan-card:hover { border-color: rgba(59,130,246,0.3) !important; }
        .spinner {
          border: 3px solid var(--border);
          border-top: 3px solid var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <Suspense 
        fallback={
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-surface)' }}>
            <span className="spinner" style={{ width: 40, height: 40 }} />
          </div>
        }
      >
        <ProductsList />
      </Suspense>
    </>
  );
}