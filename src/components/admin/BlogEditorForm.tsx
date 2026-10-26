'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Save, ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import RichTextEditor from '@/components/ui/RichTextEditor';
import ImageField from './ImageField';
import SeoFields from './SeoFields';

interface Category { id: string; name: string }
interface PostData {
  id?: string; title: string; slug: string; excerpt: string; content: string; coverImageUrl: string;
  categoryId: string; status: 'DRAFT' | 'PUBLISHED'; publishedAt: string;
  metaTitle: string; metaDescription: string; ogImageUrl: string;
}

export const EMPTY_POST: PostData = {
  title: '', slug: '', excerpt: '', content: '', coverImageUrl: '', categoryId: '', status: 'DRAFT', publishedAt: '',
  metaTitle: '', metaDescription: '', ogImageUrl: '',
};

/** ISO → value for <input type="datetime-local"> in the browser's timezone. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function postFromApi(p: Record<string, unknown>): PostData {
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  return {
    id: s(p.id), title: s(p.title), slug: s(p.slug), excerpt: s(p.excerpt), content: s(p.content),
    coverImageUrl: s(p.coverImageUrl), categoryId: s(p.categoryId),
    status: p.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
    publishedAt: toLocalInput(p.publishedAt as string),
    metaTitle: s(p.metaTitle), metaDescription: s(p.metaDescription), ogImageUrl: s(p.ogImageUrl),
  };
}

export default function BlogEditorForm({ initial }: { initial: PostData }) {
  const router = useRouter();
  const [post, setPost] = useState<PostData>(initial);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isEdit = Boolean(initial.id);

  useEffect(() => {
    fetch('/api/admin/blog-categories').then(r => r.json()).then(d => setCategories(d.data?.categories || [])).catch(() => {});
  }, []);

  const set = <K extends keyof PostData>(k: K, v: PostData[K]) => setPost(p => ({ ...p, [k]: v }));

  async function save(status: 'DRAFT' | 'PUBLISHED') {
    setError(''); setNotice('');
    if (post.title.trim().length < 3) { setError('Title must be at least 3 characters'); return; }
    setSaving(true);
    try {
      const body = {
        title: post.title.trim(),
        slug: post.slug.trim(),
        excerpt: post.excerpt.trim(),
        content: post.content,
        coverImageUrl: post.coverImageUrl.trim(),
        categoryId: post.categoryId,
        status,
        publishedAt: status === 'PUBLISHED' && post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
        metaTitle: post.metaTitle.trim(),
        metaDescription: post.metaDescription.trim(),
        ogImageUrl: post.ogImageUrl.trim(),
      };
      const res = await fetch(isEdit ? `/api/admin/blog/${initial.id}` : '/api/admin/blog', {
        method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Could not save the post'); return; }
      if (isEdit) {
        setPost(postFromApi(d.data.post));
        setNotice(status === 'PUBLISHED' ? 'Saved and published' : 'Saved as draft');
      } else {
        router.replace(`/admin/blog/${d.data.post.id}`);
      }
    } catch { setError('Network error — please try again'); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!isEdit || !confirm('Delete this post permanently?')) return;
    const res = await fetch(`/api/admin/blog/${initial.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/admin/blog'); else setError('Could not delete the post');
  }

  const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 20, alignItems: 'start' }} className="blog-editor-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div style={card}>
          <label className="label">Title</label>
          <input className="input" value={post.title} onChange={e => set('title', e.target.value)} maxLength={190} placeholder="Post title" style={{ fontSize: 18, fontWeight: 600 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <label className="label" style={{ margin: 0 }}>URL slug</label>
            <input className="input" value={post.slug} onChange={e => set('slug', e.target.value.toLowerCase())} placeholder="auto-generated from the title" style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }} />
          </div>
        </div>
        <RichTextEditor value={post.content} onChange={v => set('content', v)} />
        <div style={card}>
          <label className="label">Excerpt (shown on the blog list and as the default meta description)</label>
          <textarea className="input" rows={3} value={post.excerpt} onChange={e => set('excerpt', e.target.value)} maxLength={500} style={{ resize: 'vertical', fontSize: 14 }} />
        </div>
        <div style={card}>
          <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>SEO &amp; sharing</h3>
          <SeoFields
            values={{ metaTitle: post.metaTitle, metaDescription: post.metaDescription, ogImageUrl: post.ogImageUrl }}
            onChange={v => setPost(p => ({ ...p, metaTitle: v.metaTitle, metaDescription: v.metaDescription, ogImageUrl: v.ogImageUrl }))}
            fallbackTitle={post.title} fallbackDescription={post.excerpt}
            url={`/blog/${post.slug || 'your-post'}`}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Link href="/admin/blog" className="btn btn-ghost btn-sm"><ArrowLeft size={13} /> All posts</Link>
            <span className={`badge badge-${post.status === 'PUBLISHED' ? 'active' : 'pending'}`}>{post.status === 'PUBLISHED' ? 'Published' : 'Draft'}</span>
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
          {notice && <div style={{ color: 'var(--green)', fontSize: 13, marginBottom: 10 }}>{notice}</div>}
          <label className="label">Publish date (optional — a future date schedules the post)</label>
          <input className="input" type="datetime-local" value={post.publishedAt} onChange={e => set('publishedAt', e.target.value)} style={{ fontSize: 13, marginBottom: 12 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => save('PUBLISHED')}>
              {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <><Save size={14} /> {post.status === 'PUBLISHED' ? 'Update & keep published' : 'Publish'}</>}
            </button>
            <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => save('DRAFT')}>
              {post.status === 'PUBLISHED' ? 'Unpublish (save as draft)' : 'Save draft'}
            </button>
            {isEdit && post.status === 'PUBLISHED' && (
              <a className="btn btn-ghost btn-sm" href={`/blog/${post.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={13} /> View on site</a>
            )}
            {isEdit && <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={remove}><Trash2 size={13} /> Delete post</button>}
          </div>
        </div>

        <div style={card}>
          <label className="label">Category</label>
          <select className="input" value={post.categoryId} onChange={e => set('categoryId', e.target.value)} style={{ fontSize: 13, cursor: 'pointer' }}>
            <option value="">Uncategorised</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Manage categories from the posts list.</div>
        </div>

        <div style={card}>
          <ImageField label="Cover image" value={post.coverImageUrl} onChange={v => set('coverImageUrl', v)} hint="Shown on the list and at the top of the post." />
        </div>
      </div>
      <style>{`@media (max-width: 1100px){ .blog-editor-grid{ grid-template-columns: minmax(0,1fr) !important; } }`}</style>
    </div>
  );
}
