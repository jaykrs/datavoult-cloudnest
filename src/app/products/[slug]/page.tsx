'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/marketing/Navbar';
import {
  Check, Star, ArrowLeft, Shield, Zap, Globe, Server, Package, Mail,
  Bold, Italic, List, Link as LinkIcon, Code, AlignLeft, Heading1,
  Heading2, Eye, Edit3, Save, X
} from 'lucide-react';

interface Plan { id: string; name: string; price: number; billingCycle: string; isPopular: boolean; limits: Record<string, string>; description?: string; }
interface Product { id: string; name: string; slug: string; description: string; category: string; features: string[]; specs: Record<string, string>; plans: Plan[]; }

const categoryMeta: Record<string, { icon: React.ReactNode; color: string; glow: string }> = {
  VPS: { icon: <Server size={24} />, color: 'var(--vps-color)', glow: 'rgba(59,130,246,0.12)' },
  DOCKER: { icon: <Package size={24} />, color: 'var(--docker-color)', glow: 'rgba(6,182,212,0.12)' },
  EMAIL: { icon: <Mail size={24} />, color: 'var(--email-color)', glow: 'rgba(139,92,246,0.12)' },
};

// ── Minimal rich-text HTML editor ─────────────────────────────
function HtmlEditor({ value, onChange, onSave, onCancel }: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(false);

  function exec(cmd: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  function handleInput() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  const tools = [
    { icon: <Bold size={14} />, cmd: 'bold', title: 'Bold' },
    { icon: <Italic size={14} />, cmd: 'italic', title: 'Italic' },
    { icon: <Heading1 size={14} />, cmd: 'formatBlock', val: 'h2', title: 'Heading 2' },
    { icon: <Heading2 size={14} />, cmd: 'formatBlock', val: 'h3', title: 'Heading 3' },
    { icon: <List size={14} />, cmd: 'insertUnorderedList', title: 'Bullet list' },
    { icon: <Code size={14} />, cmd: 'formatBlock', val: 'pre', title: 'Code block' },
    { icon: <AlignLeft size={14} />, cmd: 'formatBlock', val: 'p', title: 'Paragraph' },
  ];

  return (
    <>
      <style>{`
        .html-editor { outline: none; min-height: 180px; }
        .html-editor h2 { font-family: var(--font-display); font-size: 22px; margin: 12px 0 6px; }
        .html-editor h3 { font-size: 16px; font-weight: 600; margin: 10px 0 4px; }
        .html-editor p  { margin: 6px 0; color: var(--text-secondary); line-height: 1.7; }
        .html-editor ul { padding-left: 20px; margin: 8px 0; }
        .html-editor li { color: var(--text-secondary); margin: 4px 0; }
        .html-editor pre { background: var(--bg-elevated); padding: 10px 14px; border-radius: 6px; font-family: var(--font-mono); font-size: 13px; color: var(--accent-bright); margin: 8px 0; }
        .html-editor a  { color: var(--accent-bright); }
        .editor-tool { padding: 5px 8px; border-radius: 4px; border: none; background: none; cursor: pointer; color: var(--text-secondary); transition: background 0.1s, color 0.1s; }
        .editor-tool:hover { background: var(--bg-hover); color: var(--text-primary); }
        .preview-content h2 { font-family: var(--font-display); font-size: 22px; margin: 12px 0 6px; }
        .preview-content h3 { font-size: 16px; font-weight: 600; margin: 10px 0 4px; }
        .preview-content p  { margin: 6px 0; color: var(--text-secondary); line-height: 1.7; }
        .preview-content ul { padding-left: 20px; margin: 8px 0; }
        .preview-content li { color: var(--text-secondary); margin: 4px 0; }
        .preview-content pre { background: var(--bg-elevated); padding: 10px 14px; border-radius: 6px; font-family: var(--font-mono); font-size: 13px; color: var(--accent-bright); margin: 8px 0; }
        .preview-content a { color: var(--accent-bright); }
      `}</style>
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent)44', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', background: 'var(--bg-surface)' }}>
          {tools.map(t => (
            <button key={t.title} className="editor-tool" type="button" title={t.title} onClick={() => exec(t.cmd, t.val)}>
              {t.icon}
            </button>
          ))}
          <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px' }} />
          <button className="editor-tool" type="button" title="Add link" onClick={() => {
            const url = prompt('Enter URL:');
            if (url) exec('createLink', url);
          }}>
            <LinkIcon size={14} />
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="editor-tool" type="button" onClick={() => setPreview(!preview)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 10px', background: preview ? 'var(--accent-glow)' : 'none', color: preview ? 'var(--accent-bright)' : 'var(--text-secondary)', borderRadius: 6 }}>
              {preview ? <Edit3 size={13} /> : <Eye size={13} />}
              {preview ? 'Edit' : 'Preview'}
            </button>
          </div>
        </div>

        {/* Editor / Preview */}
        <div style={{ padding: 16, minHeight: 180 }}>
          {preview ? (
            <div className="preview-content" dangerouslySetInnerHTML={{ __html: value }} />
          ) : (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              className="html-editor"
              onInput={handleInput}
              dangerouslySetInnerHTML={{ __html: value }}
              style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)' }}
            />
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: 'var(--bg-surface)' }}>
          <button type="button" onClick={onSave} className="btn btn-primary btn-sm">
            <Save size={13} /> Save changes
          </button>
          <button type="button" onClick={onCancel} className="btn btn-secondary btn-sm">
            <X size={13} /> Cancel
          </button>
        </div>
      </div>
    </>
  );
}

export default function ProductDetailPage() {
  const { slug } = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    fetch(`/api/products/${slug}`).then(r => r.json()).then(d => {
      setProduct(d.data?.product || null);
      setLoading(false);
    });
    try {
      const u = JSON.parse(localStorage.getItem('dv_user') || '{}');
      setIsAdmin(u.role === 'ADMIN' || u.role === 'SUPER_ADMIN');
    } catch {}
  }, [slug]);

  function startEdit() {
    setDescDraft(product?.description || '');
    setEditingDesc(true);
  }

  async function saveDescription() {
    if (!product) return;
    setSavingDesc(true);
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: descDraft }),
    });
    if (res.ok) {
      setProduct(p => p ? { ...p, description: descDraft } : p);
      setEditingDesc(false);
      setSaveMsg('Description saved!');
      setTimeout(() => setSaveMsg(''), 3000);
    }
    setSavingDesc(false);
  }

  function handleSubscribe(planId: string) {
    const user = localStorage.getItem('dv_user');
    if (!user) {
      router.push(`/login?next=/checkout?plan=${planId}&product=${product?.id}`);
      return;
    }
    router.push(`/checkout?plan=${planId}&product=${product?.id}`);
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  if (!product) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
        <h2>Product not found</h2>
        <Link href="/products" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>Browse products</Link>
      </div>
    </div>
  );

  const meta = categoryMeta[product.category] || categoryMeta.VPS;

  // Check if description looks like plain text (no HTML tags) — wrap in <p> for rendering
  const isHtml = /<[a-z][\s\S]*>/i.test(product.description);
  const renderedDesc = isHtml ? product.description : `<p>${product.description}</p>`;

  return (
    <>
      <style>{`
        .plan-row { transition: border-color 0.2s, box-shadow 0.2s; }
        .plan-row:hover { box-shadow: var(--shadow-md); }
        .edit-desc-btn { opacity: 0; transition: opacity 0.2s; }
        .desc-wrapper:hover .edit-desc-btn { opacity: 1; }
        .rendered-desc h2 { font-family: var(--font-display); font-size: 20px; margin: 12px 0 6px; }
        .rendered-desc h3 { font-size: 16px; font-weight: 600; margin: 10px 0 4px; }
        .rendered-desc p  { margin: 6px 0; color: var(--text-secondary); line-height: 1.7; font-size: 15px; }
        .rendered-desc ul { padding-left: 20px; margin: 8px 0; }
        .rendered-desc li { color: var(--text-secondary); margin: 4px 0; font-size: 15px; }
        .rendered-desc pre { background: var(--bg-elevated); padding: 10px 14px; border-radius: 6px; font-family: var(--font-mono); font-size: 13px; color: var(--accent-bright); }
        .rendered-desc a { color: var(--accent-bright); }
        .subscribe-btn { transition: opacity 0.15s, transform 0.15s; }
        .subscribe-btn:hover:not(:disabled) { transform: translateY(-1px); }
      `}</style>
      <div style={{ minHeight: '100vh' }}>
        <Navbar />
        <div style={{ paddingTop: 96 }}>
          {/* Hero */}
          <div style={{ padding: '48px 0', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${meta.glow} 0%, transparent 70%)`, pointerEvents: 'none' }} />
            <div className="container">
              <Link href="/products" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
                <ArrowLeft size={14} /> Back to Products
              </Link>
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ width: 72, height: 72, borderRadius: 18, background: meta.glow, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${meta.color}33`, flexShrink: 0 }}>
                  {meta.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)' }}>{product.name}</h1>
                    <span className={`badge badge-${product.category.toLowerCase()}`}>{product.category}</span>
                  </div>

                  {/* Description — editable if admin */}
                  {saveMsg && (
                    <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Check size={13} /> {saveMsg}
                    </div>
                  )}

                  <div className="desc-wrapper" style={{ position: 'relative' }}>
                    {editingDesc ? (
                      <HtmlEditor
                        value={descDraft}
                        onChange={setDescDraft}
                        onSave={saveDescription}
                        onCancel={() => setEditingDesc(false)}
                      />
                    ) : (
                      <>
                        <div className="rendered-desc" dangerouslySetInnerHTML={{ __html: renderedDesc }} style={{ maxWidth: 700 }} />
                        {isAdmin && (
                          <button onClick={startEdit} className="edit-desc-btn btn btn-secondary btn-sm" style={{ marginTop: 10, display: 'inline-flex' }}>
                            <Edit3 size={13} /> Edit description
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* Specs */}
                  <div style={{ display: 'flex', gap: 24, marginTop: 20, flexWrap: 'wrap' }}>
                    {Object.entries(product.specs).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: meta.color }} />
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{k}:</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="container" style={{ padding: '48px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 48, alignItems: 'start' }}>
              {/* Plans */}
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 }}>Choose your plan</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
                  All plans include a 7-day free trial. No credit card required to start.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {product.plans.map(plan => (
                    <div key={plan.id} className="plan-row" style={{ background: plan.isPopular ? `linear-gradient(135deg, ${meta.glow}, var(--bg-card))` : 'var(--bg-card)', border: plan.isPopular ? `1px solid ${meta.color}44` : '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 28, position: 'relative' }}>
                      {plan.isPopular && (
                        <div style={{ position: 'absolute', top: -12, left: 24, background: meta.color, color: 'white', fontSize: 12, fontWeight: 600, padding: '3px 12px', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Star size={11} fill="white" /> Most Popular
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                        <div>
                          <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{plan.name}</h3>
                          {plan.description && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{plan.description}</p>}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8 }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 36 }}>${plan.price}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>/{plan.billingCycle.toLowerCase()}</span>
                          </div>
                          {plan.billingCycle === 'ANNUAL' && (
                            <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 4 }}>
                              Billed annually · save ${(plan.price * 0.2 * 12 / 12).toFixed(2)}/mo vs monthly
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleSubscribe(plan.id)}
                          className="subscribe-btn btn"
                          style={{ background: plan.isPopular ? meta.color : 'var(--bg-elevated)', color: plan.isPopular ? 'white' : 'var(--text-primary)', border: plan.isPopular ? 'none' : '1px solid var(--border)', minWidth: 160, justifyContent: 'center', padding: '12px 20px', fontSize: 15 }}>
                          Subscribe Now
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, marginTop: 20 }}>
                        {Object.entries(plan.limits).map(([k, v]) => (
                          <div key={k} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'capitalize' }}>{k}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: meta.color }}>{String(v)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sidebar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="card">
                  <h3 style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>All plans include</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {product.features.map(f => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: meta.glow, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={11} color={meta.color} />
                        </div>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { icon: <Shield size={16} />, title: '99.9% SLA', desc: 'Guaranteed uptime' },
                    { icon: <Zap size={16} />, title: 'Instant setup', desc: 'Live in under 60 seconds' },
                    { icon: <Globe size={16} />, title: '24/7 support', desc: 'Always here to help' },
                  ].map(t => (
                    <div key={t.title} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ color: meta.color, flexShrink: 0 }}>{t.icon}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🛡️ 30-day money-back guarantee
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Not satisfied? Get a full refund within 30 days, no questions asked.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
