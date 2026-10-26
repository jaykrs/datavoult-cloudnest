'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminSidebar from '@/components/admin/AdminSidebar';
import Pagination from '@/components/ui/Pagination';
import { Plus, Search, Edit2, Trash2, Tag, X } from 'lucide-react';

interface Post { id: string; title: string; slug: string; status: 'DRAFT' | 'PUBLISHED'; publishedAt: string | null; updatedAt: string; category: { id: string; name: string } | null }
interface Category { id: string; name: string; slug: string; description: string | null; posts: number }
const LIMIT = 10;

function CategoryManager({ categories, reload }: { categories: Category[]; reload: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  async function add() {
    setError('');
    if (name.trim().length < 2) { setError('Name must be at least 2 characters'); return; }
    const res = await fetch('/api/admin/blog-categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) });
    const d = await res.json();
    if (res.ok) { setName(''); reload(); } else setError(d.error || 'Could not add category');
  }
  async function rename(c: Category) {
    const next = window.prompt('Rename category', c.name);
    if (!next || next.trim() === c.name) return;
    const res = await fetch(`/api/admin/blog-categories/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: next.trim() }) });
    if (res.ok) reload(); else { const d = await res.json(); alert(d.error || 'Could not rename'); }
  }
  async function remove(c: Category) {
    if (!confirm(`Delete "${c.name}"? Its ${c.posts} post(s) will become uncategorised.`)) return;
    const res = await fetch(`/api/admin/blog-categories/${c.id}`, { method: 'DELETE' });
    if (res.ok) reload();
  }
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
      <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, display: 'flex', gap: 6, alignItems: 'center' }}><Tag size={14} /> Categories</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {categories.length === 0 && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No categories yet.</span>}
        {categories.map(c => (
          <span key={c.id} className="badge badge-active" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <button type="button" onClick={() => rename(c)} title="Rename" style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0 }}>{c.name} ({c.posts})</button>
            <button type="button" onClick={() => remove(c)} title="Delete" aria-label={`Delete ${c.name}`} style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12} /></button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, maxWidth: 380 }}>
        <input className="input" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} placeholder="New category name" style={{ fontSize: 13 }} maxLength={60} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={add}>Add</button>
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

export default function AdminBlogPage() {
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [drafts, setDrafts] = useState(0);

  useEffect(() => { const s = localStorage.getItem('dv_user'); if (s) try { setUser(JSON.parse(s)); } catch {} }, []);

  const loadCategories = useCallback(() => {
    fetch('/api/admin/blog-categories').then(r => r.json()).then(d => setCategories(d.data?.categories || [])).catch(() => {});
  }, []);
  useEffect(loadCategories, [loadCategories]);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/blog?search=${encodeURIComponent(search)}&status=${status}&category=${category}&limit=${LIMIT}&page=${page}`)
      .then(r => r.json())
      .then(d => { setPosts(d.data?.posts || []); setTotal(d.data?.meta?.total || 0); setDrafts(d.data?.drafts || 0); })
      .finally(() => setLoading(false));
  }, [search, status, category, page]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function remove(p: Post) {
    if (!confirm(`Delete "${p.title}" permanently?`)) return;
    const res = await fetch(`/api/admin/blog/${p.id}`, { method: 'DELETE' });
    if (res.ok) { load(); loadCategories(); }
  }

  const state = (p: Post) => {
    if (p.status === 'DRAFT') return { label: 'Draft', cls: 'pending' };
    if (p.publishedAt && new Date(p.publishedAt) > new Date()) return { label: 'Scheduled', cls: 'pending' };
    return { label: 'Published', cls: 'active' };
  };

  return (
    <div className="page-shell">
      <AdminSidebar user={user} />
      <main className="page-main">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Blog</h1>
            <p className="page-header-sub">{total} posts · {drafts} drafts</p>
          </div>
          <Link href="/admin/blog/new" className="btn btn-primary"><Plus size={15} /> New post</Link>
        </div>
        <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CategoryManager categories={categories} reload={loadCategories} />

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="input" style={{ paddingLeft: 40 }} placeholder="Search posts…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <select className="input" style={{ width: 160, cursor: 'pointer' }} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option><option value="PUBLISHED">Published</option><option value="DRAFT">Drafts</option>
            </select>
            <select className="input" style={{ width: 200, cursor: 'pointer' }} value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Updated</th><th style={{ width: 90 }} /></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24 }}><span className="spinner" /></td></tr>}
                {!loading && posts.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No posts yet — write your first one.</td></tr>}
                {!loading && posts.map(p => {
                  const s = state(p);
                  return (
                    <tr key={p.id}>
                      <td><Link href={`/admin/blog/${p.id}`} style={{ fontWeight: 600 }}>{p.title}</Link><div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>/blog/{p.slug}</div></td>
                      <td>{p.category?.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td><span className={`badge badge-${s.cls}`}>{s.label}</span></td>
                      <td style={{ fontSize: 13 }}>{new Date(p.updatedAt).toLocaleDateString('en-IN')}</td>
                      <td>
                        <Link href={`/admin/blog/${p.id}`} className="icon-btn" title="Edit"><Edit2 size={14} /></Link>
                        <button type="button" className="icon-btn" title="Delete" onClick={() => remove(p)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={Math.ceil(total / LIMIT)} total={total} limit={LIMIT} onPageChange={setPage} />
        </div>
      </main>
    </div>
  );
}
