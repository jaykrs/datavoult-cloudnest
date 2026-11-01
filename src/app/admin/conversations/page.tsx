'use client';
import { useCallback, useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import Thread from '@/components/conversations/Thread';
import { Plus, MessageSquare } from 'lucide-react';

interface User { name: string; email: string; role: string; }
interface Row { id: string; subject: string; status: string; adminUnread: boolean; lastMessageAt: string; user: { name: string; email: string }; last: { body: string; senderRole: string } | null }
interface Customer { id: string; name: string; email: string }

export default function AdminConversationsPage() {
  const [me, setMe] = useState<User | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    const q = status !== 'all' ? `&status=${status}` : '';
    const d = await fetch(`/api/admin/conversations?limit=50${q}`, { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    setRows(d?.data?.conversations || []); setUnread(d?.data?.unread ?? 0); setLoading(false);
  }, [status]);

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setMe(JSON.parse(stored)); } catch {}
    const c = new URLSearchParams(window.location.search).get('c');
    if (c) setSelected(c);
  }, []);
  useEffect(() => { setLoading(true); void load(); }, [load]);

  return (
    <div className="page-shell">
      <AdminSidebar user={me} />
      <main className="page-main">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Conversations</h1>
            <p className="page-header-sub">Start a conversation with a customer and follow their replies{unread ? ` · ${unread} unread` : ''}</p>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setComposing(true); setSelected(null); }}><Plus size={15} /> New conversation</button>
        </div>

        <div className="page-content">
          <div className="filter-bar">
            {['all', 'OPEN', 'CLOSED'].map(s => (
              <button key={s} onClick={() => setStatus(s)} className={`btn btn-sm${status === s ? ' btn-primary' : ' btn-secondary'}`}>{s === 'all' ? 'All' : s}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 20, alignItems: 'start' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {loading ? <div style={{ padding: 32, textAlign: 'center' }}><span className="spinner" style={{ width: 22, height: 22 }} /></div>
                : rows.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No conversations yet.</div>
                : rows.map(r => (
                  <button key={r.id} type="button" onClick={() => { setSelected(r.id); setComposing(false); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', border: 0, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', background: selected === r.id ? 'var(--bg-elevated)' : 'transparent', color: 'inherit' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: r.adminUnread ? 700 : 500, fontSize: 14 }}>{r.subject}</span>
                      {r.adminUnread && <span className="badge badge-pending" style={{ fontSize: 10 }}>New reply</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.user.name} · {r.status}</div>
                    {r.last && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.last.senderRole === 'ADMIN' ? 'You: ' : ''}{r.last.body}</div>}
                  </button>
                ))}
            </div>

            <div className="card" style={{ padding: 22, minHeight: 240 }}>
              {composing ? <Compose onCreated={(id) => { setComposing(false); setSelected(id); void load(); }} />
                : selected ? <Thread base="/api/admin/conversations" id={selected} viewer="ADMIN" onChanged={load} />
                : <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}><MessageSquare size={28} style={{ marginBottom: 8 }} /><div>Select a conversation or start a new one.</div></div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Compose({ onCreated }: { onCreated: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [picked, setPicked] = useState<Customer | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (picked || q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/admin/users?limit=8&search=${encodeURIComponent(q.trim())}`).then(r => r.json()).then(d => setResults(d.data?.users || [])).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q, picked]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) { setError('Choose a customer first'); return; }
    setBusy(true); setError('');
    const res = await fetch('/api/admin/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: picked.id, subject, message }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d.error || 'Could not start the conversation'); return; }
    onCreated(d.data.id);
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 17 }}>New conversation</div>
      {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
      <div>
        <label className="label">Customer</label>
        {picked ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{picked.name} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{picked.email}</span></span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setPicked(null); setQ(''); }}>Change</button>
          </div>
        ) : (
          <>
            <input className="input" placeholder="Search by name or email…" value={q} onChange={e => setQ(e.target.value)} />
            {results.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 6 }}>
                {results.map(u => (
                  <button key={u.id} type="button" onClick={() => setPicked(u)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
                    {u.name} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{u.email}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <div><label className="label">Subject</label><input className="input" value={subject} onChange={e => setSubject(e.target.value)} required minLength={3} maxLength={150} /></div>
      <div><label className="label">Message</label><textarea className="input" rows={6} value={message} onChange={e => setMessage(e.target.value)} required maxLength={5000} style={{ resize: 'vertical' }} /></div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>The customer gets this by email and sees it under Messages in their dashboard, where they can reply.</div>
      <button type="submit" className="btn btn-primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>
        {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Send message'}
      </button>
    </form>
  );
}
