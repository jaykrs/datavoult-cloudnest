'use client';
import { useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import BlogEditorForm, { EMPTY_POST } from '@/components/admin/BlogEditorForm';

export default function NewBlogPostPage() {
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  useEffect(() => { const s = localStorage.getItem('dv_user'); if (s) try { setUser(JSON.parse(s)); } catch {} }, []);
  return (
    <div className="page-shell">
      <AdminSidebar user={user} />
      <main className="page-main">
        <div className="page-header"><div><h1 className="page-header-title">New blog post</h1></div></div>
        <div className="page-content"><BlogEditorForm initial={EMPTY_POST} /></div>
      </main>
    </div>
  );
}
