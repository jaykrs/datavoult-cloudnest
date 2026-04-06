'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import { Check, ArrowRight, Star } from 'lucide-react';

interface Plan { id: string; name: string; price: number; billingCycle: string; isPopular: boolean; limits: Record<string, string>; }
interface Product { id: string; name: string; slug: string; category: string; plans: Plan[]; features: string[]; }

export default function PricingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [billing, setBilling] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(d => { setProducts(d.data?.products || []); setLoading(false); });
  }, []);

  const catColors: Record<string, string> = { VPS: 'var(--vps-color)', DOCKER: 'var(--docker-color)', EMAIL: 'var(--email-color)' };

  return (
    <>
      <style>{`
        .pricing-card {
          transition: transform 0.25s, box-shadow 0.25s, border-color 0.25s;
        }
        .pricing-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
        }
        .pricing-card.vps:hover  { border-color: var(--vps-color) !important; }
        .pricing-card.docker:hover { border-color: var(--docker-color) !important; }
        .pricing-card.email:hover  { border-color: var(--email-color) !important; }
      `}</style>
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ paddingTop: 96 }}>
          <div style={{ padding: '56px 0 48px', textAlign: 'center', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 56px)', marginBottom: 12 }}>Simple, transparent pricing</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, maxWidth: 500, margin: '0 auto 32px' }}>No hidden fees. No surprises. Pay only for what you use.</p>
            <div style={{ display: 'inline-flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 100, padding: 4, gap: 2 }}>
              {(['MONTHLY', 'ANNUAL'] as const).map(b => (
                <button key={b} onClick={() => setBilling(b)} style={{ padding: '8px 20px', borderRadius: 100, border: 'none', cursor: 'pointer', background: billing === b ? 'var(--accent)' : 'transparent', color: billing === b ? 'white' : 'var(--text-secondary)', fontSize: 14, fontWeight: 500, transition: 'all 0.2s' }}>
                  {b === 'MONTHLY' ? 'Monthly' : 'Annual'}
                  {b === 'ANNUAL' && <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>–20%</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="container" style={{ padding: '48px 24px' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><span className="spinner" style={{ width: 32, height: 32 }} /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 64 }}>
                {products.map(product => {
                  const color = catColors[product.category] || 'var(--accent)';
                  const catCls = product.category.toLowerCase();
                  return (
                    <div key={product.id}>
                      <div style={{ marginBottom: 24 }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 6 }}>{product.name}</h2>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          {product.features.slice(0, 4).map(f => (
                            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                              <Check size={12} color={color} /> {f}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
                        {product.plans.map(plan => {
                          const displayPrice = billing === 'ANNUAL' ? Number(plan.price * 0.8) : Number(plan.price);
                          return (
                            <div key={plan.id} className={`pricing-card ${catCls}`} style={{ background: plan.isPopular ? `linear-gradient(145deg, ${color}10, var(--bg-card))` : 'var(--bg-card)', border: plan.isPopular ? `1px solid ${color}44` : '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 28, position: 'relative' }}>
                              {plan.isPopular && (
                                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: color, color: 'white', fontSize: 11, fontWeight: 600, padding: '3px 14px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                                  <Star size={10} fill="white" /> Most Popular
                                </div>
                              )}
                              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{plan.name}</h3>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                                <span style={{ fontFamily: 'var(--font-display)', fontSize: 40 }}>${displayPrice.toFixed(2)}</span>
                                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>/mo</span>
                              </div>
                              {billing === 'ANNUAL' && (
                                <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 16 }}>
                                  Save ${((plan.price - displayPrice) * 12).toFixed(2)}/yr
                                </div>
                              )}
                              <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                                {Object.entries(plan.limits).map(([k, v]) => (
                                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                    <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k}</span>
                                    <span style={{ fontWeight: 500, color }}>{String(v)}</span>
                                  </div>
                                ))}
                              </div>
                              <Link href={`/checkout?plan=${plan.id}&product=${product.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', padding: '11px 20px', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 500, transition: 'opacity 0.15s', background: plan.isPopular ? color : 'var(--bg-elevated)', color: plan.isPopular ? 'white' : 'var(--text-primary)', border: plan.isPopular ? 'none' : '1px solid var(--border)', textDecoration: 'none' }}>
                                Get Started <ArrowRight size={14} />
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 80, maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, textAlign: 'center', marginBottom: 40 }}>FAQ</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { q: 'Can I cancel anytime?', a: 'Yes, you can cancel your subscription at any time. Your service will remain active until the end of the billing period.' },
                  { q: 'What payment methods do you accept?', a: 'We accept all major credit cards, PayPal, and bank transfers. Cryptocurrency is available for annual plans.' },
                  { q: 'Is there a free trial?', a: 'Yes! All plans come with a 7-day free trial. No credit card required.' },
                  { q: 'Can I upgrade or downgrade my plan?', a: 'Absolutely. You can change your plan at any time from your dashboard. Changes take effect immediately.' },
                  { q: 'Do you offer refunds?', a: 'We offer a 30-day money-back guarantee on all plans. Contact support to request a refund.' },
                ].map((faq, i, arr) => (
                  <div key={faq.q} style={{ padding: '20px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <h3 style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>{faq.q}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
