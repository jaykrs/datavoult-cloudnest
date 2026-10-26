'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import BlogEditorForm, { postFromApi } from '@/components/admin/BlogEditorForm';

export default function EditBlogPostPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [post, setPost] = useState<ReturnType<typeof postFromApi> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { const s = localStorage.getItem('dv_user'); if (s) try { setUser(JSON.parse(s)); } catch {} }, []);
  useEffect(() => {
    fetch(`/api/admin/blog/${id}`).then(async r => {
      const d = await r.json();
      if (r.ok) setPost(postFromApi(d.data.post)); else setError(d.error || 'Post not found');
    }).catch(() => setError('Could not load the post'));
  }, [id]);
  return (
    <div className="page-shell">
      <AdminSidebar user={user} />
      <main className="page-main">
        <div className="page-header"><div><h1 className="page-header-title">Edit blog post</h1></div></div>
        <div className="page-content">
          {error ? <div style={{ color: 'var(--red)' }}>{error}</div> : post ? <BlogEditorForm key={post.id} initial={post} /> : <div className="spinner" />}
        </div>
      </main>
    </div>
  );
}
