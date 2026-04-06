'use client';
import { useEffect, useRef, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Plus, Edit2, Trash2, Server, Package, Mail, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Save, X, Eye, Edit3, Bold, Italic, List, Link as LinkIcon, Code, AlignLeft, Heading1, Heading2 } from 'lucide-react';

interface User { name: string; email: string; role: string; }
interface Plan { id: string; name: string; price: number; billingCycle: string; isPopular: boolean; limits: Record<string, string | number>; }
interface Product { id: string; name: string; slug: string; description: string; category: string; status: string; plans: Plan[]; createdAt: string; }

const catIcon: Record<string, React.ReactNode> = { VPS: <Server size={16} />, DOCKER: <Package size={16} />, EMAIL: <Mail size={16} /> };

// ── Minimal HTML Editor (same as product detail) ─────────────
function HtmlEditor({ value, onChange, onSave, onCancel, saving }: {
  value: string; onChange: (v: string) => void;
  onSave: () => void; onCancel: () => void; saving?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(false);

  function exec(cmd: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  const tools = [
    { icon: <Bold size={13} />, cmd: 'bold', title: 'Bold' },
    { icon: <Italic size={13} />, cmd: 'italic', title: 'Italic' },
    { icon: <Heading1 size={13} />, cmd: 'formatBlock', val: 'h2', title: 'H2' },
    { icon: <Heading2 size={13} />, cmd: 'formatBlock', val: 'h3', title: 'H3' },
    { icon: <List size={13} />, cmd: 'insertUnorderedList', title: 'List' },
    { icon: <Code size={13} />, cmd: 'formatBlock', val: 'pre', title: 'Code' },
    { icon: <AlignLeft size={13} />, cmd: 'formatBlock', val: 'p', title: 'Paragraph' },
    { icon: <LinkIcon size={13} />, cmd: 'createLink', title: 'Link' },
  ];

  return (
    <>
      <style>{`
        .admin-html-editor { outline: none; min-height: 140px; font-size: 14px; line-height: 1.7; }
        .admin-html-editor h2 { font-family: var(--font-display); font-size: 20px; margin: 10px 0 4px; }
        .admin-html-editor h3 { font-size: 15px; font-weight: 600; margin: 8px 0 4px; }
        .admin-html-editor p  { margin: 4px 0; color: var(--text-secondary); }
        .admin-html-editor ul { padding-left: 18px; margin: 6px 0; }
        .admin-html-editor li { color: var(--text-secondary); margin: 3px 0; }
        .admin-html-editor pre { background: var(--bg-base); padding: 8px 12px; border-radius: 5px; font-family: var(--font-mono); font-size: 12px; color: var(--accent-bright); margin: 6px 0; }
        .admin-html-preview h2 { font-family: var(--font-display); font-size: 20px; margin: 10px 0 4px; }
        .admin-html-preview h3 { font-size: 15px; font-weight: 600; margin: 8px 0 4px; }
        .admin-html-preview p  { margin: 4px 0; color: var(--text-secondary); font-size: 14px; }
        .admin-html-preview ul { padding-left: 18px; margin: 6px 0; }
        .admin-html-preview li { color: var(--text-secondary); font-size: 14px; }
        .admin-html-preview pre { background: var(--bg-base); padding: 8px 12px; border-radius: 5px; font-family: var(--font-mono); font-size: 12px; color: var(--accent-bright); }
        .etool { padding: 4px 7px; border-radius: 4px; border: none; background: none; cursor: pointer; color: var(--text-secondary); transition: background 0.1s, color 0.1s; }
        .etool:hover { background: var(--bg-hover); color: var(--text-primary); }
      `}</style>
      <div style={{ border: '1px solid var(--accent)44', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 2, flexWrap: 'wrap', background: 'var(--bg-surface)', alignItems: 'center' }}>
          {tools.map(t => (
            <button key={t.title} className="etool" type="button" title={t.title}
              onClick={() => t.cmd === 'createLink' ? (() => { const u = prompt('URL:'); if (u) exec('createLink', u); })() : exec(t.cmd, t.val)}>
              {t.icon}
            </button>
          ))}
          <div style={{ marginLeft: 'auto' }}>
            <button className="etool" type="button" onClick={() => setPreview(!preview)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px', background: preview ? 'var(--accent-glow)' : 'none', color: preview ? 'var(--accent-bright)' : 'var(--text-secondary)', borderRadius: 4 }}>
              {preview ? <Edit3 size={12} /> : <Eye size={12} />}
              {preview ? 'Edit' : 'Preview'}
            </button>
          </div>
        </div>
        <div style={{ padding: 14, minHeight: 140, background: 'var(--bg-elevated)' }}>
          {preview
            ? <div className="admin-html-preview" dangerouslySetInnerHTML={{ __html: value }} />
            : <div ref={editorRef} contentEditable suppressContentEditableWarning className="admin-html-editor"
                onInput={() => { if (editorRef.current) onChange(editorRef.current.innerHTML); }}
                dangerouslySetInnerHTML={{ __html: value }} style={{ color: 'var(--text-primary)' }} />
          }
        </div>
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: 'var(--bg-surface)' }}>
          <button type="button" onClick={onSave} disabled={saving} className="btn btn-primary btn-sm">
            {saving ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <><Save size={12} /> Save</>}
          </button>
          <button type="button" onClick={onCancel} className="btn btn-secondary btn-sm"><X size={12} /> Cancel</button>
        </div>
      </div>
    </>
  );
}

export default function AdminProductsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [descDraft, setDescDraft] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ name: '', price: '', billingCycle: 'MONTHLY', isPopular: false, description: '', limitsRaw: '{}' });

  const [form, setForm] = useState({ name: '', slug: '', description: '', category: 'VPS', features: '', specs: '{}' });

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
    loadProducts();
  }, []);

  function loadProducts() {
    fetch('/api/products?status=all').then(r => r.json()).then(d => {
      setProducts(d.data?.products || []);
      setLoading(false);
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const features = form.features.split('\n').map(f => f.trim()).filter(Boolean);
      let specs: Record<string, string> = {};
      try { specs = JSON.parse(form.specs); } catch { alert('Invalid JSON in specs'); setSaving(false); return; }
      const res = await fetch('/api/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, features, specs }),
      });
      if (res.ok) {
        setShowCreateForm(false);
        setForm({ name: '', slug: '', description: '', category: 'VPS', features: '', specs: '{}' });
        loadProducts();
      } else { const d = await res.json(); alert(d.error || 'Failed to create product'); }
    } finally { setSaving(false); }
  }

  async function saveDescription(productId: string) {
    setSavingDesc(true);
    const res = await fetch(`/api/products/${productId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: descDraft }),
    });
    if (res.ok) {
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, description: descDraft } : p));
      setEditingDescId(null);
    }
    setSavingDesc(false);
  }

  async function toggleStatus(product: Product) {
    const newStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await fetch(`/api/products/${product.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, status: newStatus } : p));
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product and all its plans? This cannot be undone.')) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    setProducts(prev => prev.filter(p => p.id !== id));
  }

  async function handleAddPlan(productId: string) {
    try {
      let limits: Record<string, string | number> = {};
      try { limits = JSON.parse(planForm.limitsRaw); } catch { alert('Invalid JSON in limits'); return; }
      const res = await fetch('/api/plans', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          name: planForm.name,
          description: planForm.description || undefined,
          price: parseFloat(planForm.price),
          billingCycle: planForm.billingCycle,
          isPopular: planForm.isPopular,
          limits,
        }),
      });
      if (res.ok) {
        setShowPlanForm(null);
        setPlanForm({ name: '', price: '', billingCycle: 'MONTHLY', isPopular: false, description: '', limitsRaw: '{}' });
        loadProducts();
      } else { const d = await res.json(); alert(d.error || 'Failed'); }
    } catch (err) { alert('Error creating plan'); }
  }

  return (
    <>
      <style>{`
        .product-row { transition: background 0.1s; }
        .product-row:hover { background: var(--bg-elevated); }
        .icon-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 4px; transition: color 0.1s; }
        .icon-btn:hover { color: var(--text-primary); }
        .icon-btn.danger:hover { color: var(--red); }
      `}</style>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <AdminSidebar user={user} />
        <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg-base)' }}>
          <div style={{ padding: '32px 40px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>Products</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Manage products, plans, and descriptions</p>
            </div>
            <button onClick={() => setShowCreateForm(!showCreateForm)} className="btn btn-primary btn-sm">
              <Plus size={15} /> Add Product
            </button>
          </div>

          <div style={{ padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── Create product form ── */}
            {showCreateForm && (
              <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 'var(--radius-xl)', padding: 28 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 20 }}>New Product</h2>
                <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="label">Product Name</label>
                    <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') }))} placeholder="Cloud VPS Pro" required />
                  </div>
                  <div>
                    <label className="label">Slug</label>
                    <input className="input" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="cloud-vps-pro" required />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="label">Description (plain text — edit as HTML later)</label>
                    <textarea className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} required style={{ resize: 'vertical' }} placeholder="A powerful VPS solution..." />
                  </div>
                  <div>
                    <label className="label">Category</label>
                    <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ cursor: 'pointer' }}>
                      <option value="VPS">VPS</option>
                      <option value="DOCKER">DOCKER</option>
                      <option value="EMAIL">EMAIL</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Specs (JSON)</label>
                    <input className="input" value={form.specs} onChange={e => setForm(f => ({ ...f, specs: e.target.value }))} placeholder='{"network":"1 Gbps","datacenter":"Tier 4"}' style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="label">Features (one per line)</label>
                    <textarea className="input" value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))} rows={4} placeholder={"NVMe SSD Storage\nDDoS Protection\n24/7 Support"} style={{ resize: 'vertical' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
                    <button type="submit" disabled={saving} className="btn btn-primary">
                      {saving ? <span className="spinner" style={{ width: 15, height: 15 }} /> : <><Plus size={14} /> Create Product</>}
                    </button>
                    <button type="button" onClick={() => setShowCreateForm(false)} className="btn btn-secondary">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Products list ── */}
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><span className="spinner" style={{ width: 32, height: 32 }} /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {products.length === 0 && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No products yet. Create your first product above.
                  </div>
                )}
                {products.map(product => (
                  <div key={product.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                    {/* Product row */}
                    <div className="product-row" style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 16, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{product.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{product.slug}</div>
                      </div>
                      <div>
                        <span className={`badge badge-${product.category.toLowerCase()}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {catIcon[product.category]} {product.category}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        {product.plans.length} plan{product.plans.length !== 1 ? 's' : ''}
                        {product.plans.length > 0 && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            from ${Math.min(...product.plans.map(p => Number(p.price))).toFixed(2)}/mo
                          </div>
                        )}
                      </div>
                      <div><span className={`badge badge-${product.status === 'ACTIVE' ? 'active' : 'inactive'}`}>{product.status}</span></div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button className="icon-btn" onClick={() => toggleStatus(product)} title="Toggle status" style={{ color: product.status === 'ACTIVE' ? 'var(--green)' : 'var(--text-muted)' }}>
                          {product.status === 'ACTIVE' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                        <button className="icon-btn" title="Edit description"
                          onClick={() => { setEditingDescId(product.id); setDescDraft(product.description); setExpandedProduct(product.id); }}>
                          <Edit2 size={15} />
                        </button>
                        <button className="icon-btn danger" onClick={() => handleDelete(product.id)} title="Delete product">
                          <Trash2 size={15} />
                        </button>
                        <button className="icon-btn" onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)} title="Expand">
                          {expandedProduct === product.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded panel */}
                    {expandedProduct === product.id && (
                      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>

                        {/* Description editor */}
                        <div style={{ padding: '20px 20px 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <h3 style={{ fontWeight: 600, fontSize: 14 }}>Product Description</h3>
                            {editingDescId !== product.id && (
                              <button className="btn btn-secondary btn-sm" onClick={() => { setEditingDescId(product.id); setDescDraft(product.description); }}>
                                <Edit3 size={13} /> Edit with HTML Editor
                              </button>
                            )}
                          </div>
                          {editingDescId === product.id ? (
                            <HtmlEditor
                              value={descDraft}
                              onChange={setDescDraft}
                              onSave={() => saveDescription(product.id)}
                              onCancel={() => setEditingDescId(null)}
                              saving={savingDesc}
                            />
                          ) : (
                            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, maxHeight: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}
                              dangerouslySetInnerHTML={{ __html: /<[a-z]/i.test(product.description) ? product.description : `<p>${product.description}</p>` }}
                            />
                          )}
                        </div>

                        {/* Plans table */}
                        <div style={{ padding: 20 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h3 style={{ fontWeight: 600, fontSize: 14 }}>Plans ({product.plans.length})</h3>
                            <button className="btn btn-primary btn-sm" onClick={() => setShowPlanForm(showPlanForm === product.id ? null : product.id)}>
                              <Plus size={13} /> Add Plan
                            </button>
                          </div>

                          {showPlanForm === product.id && (
                            <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 16 }}>
                              <h4 style={{ fontWeight: 600, fontSize: 13, marginBottom: 14, color: 'var(--accent-bright)' }}>New Plan for {product.name}</h4>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                                <div>
                                  <label className="label">Plan Name</label>
                                  <input className="input" value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} placeholder="Professional" required style={{ fontSize: 13 }} />
                                </div>
                                <div>
                                  <label className="label">Price (USD/mo)</label>
                                  <input className="input" type="number" step="0.01" min="0" value={planForm.price} onChange={e => setPlanForm(f => ({ ...f, price: e.target.value }))} placeholder="19.99" required style={{ fontSize: 13 }} />
                                </div>
                                <div>
                                  <label className="label">Billing Cycle</label>
                                  <select className="input" value={planForm.billingCycle} onChange={e => setPlanForm(f => ({ ...f, billingCycle: e.target.value }))} style={{ cursor: 'pointer', fontSize: 13 }}>
                                    <option value="MONTHLY">Monthly</option>
                                    <option value="QUARTERLY">Quarterly</option>
                                    <option value="ANNUAL">Annual</option>
                                  </select>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <label className="label">Description (optional)</label>
                                  <input className="input" value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} placeholder="Best for growing teams" style={{ fontSize: 13 }} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                  <label className="label">Limits (JSON)</label>
                                  <input className="input" value={planForm.limitsRaw} onChange={e => setPlanForm(f => ({ ...f, limitsRaw: e.target.value }))} placeholder='{"cpu":"2 vCPUs","ram":"4 GB","storage":"80 GB"}' style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <input type="checkbox" id={`popular-${product.id}`} checked={planForm.isPopular} onChange={e => setPlanForm(f => ({ ...f, isPopular: e.target.checked }))} style={{ cursor: 'pointer' }} />
                                  <label htmlFor={`popular-${product.id}`} style={{ fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>Mark as Popular</label>
                                </div>
                                <div style={{ gridColumn: '2 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                  <button type="button" onClick={() => handleAddPlan(product.id)} className="btn btn-primary btn-sm">
                                    <Plus size={13} /> Create Plan
                                  </button>
                                  <button type="button" onClick={() => setShowPlanForm(null)} className="btn btn-secondary btn-sm">Cancel</button>
                                </div>
                              </div>
                            </div>
                          )}

                          {product.plans.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 8 }}>
                              No plans yet — add one above to make this product subscribable.
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                              {product.plans.map(plan => (
                                <div key={plan.id} style={{ background: 'var(--bg-card)', border: `1px solid ${plan.isPopular ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`, borderRadius: 10, padding: 14 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: 13 }}>{plan.name}</div>
                                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{plan.billingCycle}</div>
                                    </div>
                                    {plan.isPopular && <span style={{ fontSize: 10, background: 'var(--accent)', color: 'white', padding: '1px 7px', borderRadius: 100, fontWeight: 600 }}>Popular</span>}
                                  </div>
                                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8 }}>${Number(plan.price).toFixed(2)}</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    {Object.entries(plan.limits).slice(0, 4).map(([k, v]) => (
                                      <div key={k} style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ textTransform: 'capitalize' }}>{k}</span>
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{String(v)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
