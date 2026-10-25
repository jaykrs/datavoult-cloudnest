'use client';
import { useCallback, useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import Pagination from '@/components/ui/Pagination';
import { Search, Mail, Trash2 } from 'lucide-react';

interface User { name: string; email: string; role: string; }
type Status = 'NEW' | 'READ' | 'RESOLVED';
interface Msg { id: string; name: string; email: string; subject: string; message: string; status: Status; createdAt: string; }

const LIMIT = 10;
const FILTERS: Array<{ v: '' | Status; label: string }> = [
  { v: '', label: 'All' }, { v: 'NEW', label: 'New' }, { v: 'READ', label: 'Read' }, { v: 'RESOLVED', label: 'Resolved' },
];
const badge: Record<Status, string> = { NEW: 'pending', READ: 'active', RESOLVED: 'active' };

export default function AdminContactMessagesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | Status>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/contact-messages?search=${encodeURIComponent(search)}&status=${status}&limit=${LIMIT}&page=${page}`)
      .then(r => r.json())
      .then(d => { setMessages(d.data?.messages || []); setTotal(d.data?.meta?.total || 0); setNewCount(d.data?.newCount || 0); })
      .finally(() => setLoading(false));
  }, [search, status, page]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function setMsgStatus(id: string, next: Status) {
    const res = await fetch(`/api/admin/contact-messages/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    if (res.ok) load();
  }
  async function remove(id: string) {
    if (!confirm('Delete this message permanently?')) return;
    const res = await fetch(`/api/admin/contact-messages/${id}`, { method: 'DELETE' });
    if (res.ok) { setOpenId(null); load(); }
  }
  function toggle(m: Msg) {
    const opening = openId !== m.id;
    setOpenId(opening ? m.id : null);
    if (opening && m.status === 'NEW') setMsgStatus(m.id, 'READ');
  }

  return (
    <div className="page-shell">
      <AdminSidebar user={user} />
      <main className="page-main">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Contact messages</h1>
            <p className="page-header-sub">{total} messages · {newCount} new</p>
          </div>
        </div>
        <div className="page-content">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', maxWidth: 360, flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="input" style={{ paddingLeft: 40 }} placeholder="Search messages…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {FILTERS.map(f => (
                <button key={f.label} type="button" className={`btn btn-sm ${status === f.v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setStatus(f.v); setPage(1); }}>{f.label}</button>
              ))}
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>From</th><th>Subject</th><th>Received</th><th>Status</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} style={{ padding: 48, textAlign: 'center' }}><span className="spinner" style={{ width: 28, height: 28, display: 'inline-block' }} /></td></tr>
                ) : messages.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No messages</td></tr>
                ) : messages.flatMap(m => [
                  <tr key={m.id} onClick={() => toggle(m)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ fontWeight: m.status === 'NEW' ? 700 : 500, fontSize: 14 }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={10} /> {m.email}</div>
                    </td>
                    <td style={{ fontSize: 14, fontWeight: m.status === 'NEW' ? 600 : 400 }}>{m.subject}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(m.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                    <td><span className={`badge badge-${badge[m.status]}`}>{m.status}</span></td>
                  </tr>,
                  ...(openId === m.id ? [
                    <tr key={`${m.id}-body`}>
                      <td colSpan={4} style={{ background: 'var(--bg-elevated, rgba(255,255,255,0.02))' }}>
                        {/* React escapes the text; pre-wrap keeps the sender's line breaks. */}
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, padding: '8px 4px 14px' }}>{m.message}</div>
                        <div style={{ display: 'flex', gap: 8, paddingBottom: 8 }}>
                          <a className="btn btn-primary btn-sm" href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + m.subject)}`}>Reply by email</a>
                          {m.status !== 'RESOLVED' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMsgStatus(m.id, 'RESOLVED')}>Mark resolved</button>}
                          {m.status === 'RESOLVED' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMsgStatus(m.id, 'NEW')}>Reopen</button>}
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => remove(m.id)} style={{ marginLeft: 'auto' }}><Trash2 size={13} /> Delete</button>
                        </div>
                      </td>
                    </tr>,
                  ] : []),
                ])}
              </tbody>
            </table>
            <Pagination page={page} totalPages={Math.ceil(total / LIMIT)} total={total} limit={LIMIT} onPageChange={setPage} />
          </div>
        </div>
      </main>
    </div>
  );
}
