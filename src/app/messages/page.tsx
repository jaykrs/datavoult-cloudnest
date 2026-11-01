'use client';
import { useCallback, useEffect, useState } from 'react';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import Thread from '@/components/conversations/Thread';
import { MessageSquare } from 'lucide-react';

interface User { name: string; email: string; role: string; }
interface Row { id: string; subject: string; status: string; userUnread: boolean; lastMessageAt: string; last: { body: string; senderRole: string } | null }

export default function MessagesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch('/api/conversations', { cache: 'no-store' }).then(r => r.json()).catch(() => null);
    setRows(d?.data?.conversations || []); setLoading(false);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
    const c = new URLSearchParams(window.location.search).get('c');
    if (c) setSelected(c);
    void load();
  }, [load]);

  return (
    <div className="page-shell">
      <DashboardSidebar user={user} />
      <main className="page-main">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Messages</h1>
            <p className="page-header-sub">Conversations with the DataVoult team</p>
          </div>
        </div>
        <div className="page-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: 20, alignItems: 'start' }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {loading ? <div style={{ padding: 32, textAlign: 'center' }}><span className="spinner" style={{ width: 22, height: 22 }} /></div>
                : rows.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>No messages yet.</div>
                : rows.map(r => (
                  <button key={r.id} type="button" onClick={() => { setSelected(r.id); setRows(rs => rs.map(x => x.id === r.id ? { ...x, userUnread: false } : x)); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', border: 0, borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', background: selected === r.id ? 'var(--bg-elevated)' : 'transparent', color: 'inherit' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: r.userUnread ? 700 : 500, fontSize: 14 }}>{r.subject}</span>
                      {r.userUnread && <span className="badge badge-pending" style={{ fontSize: 10 }}>New</span>}
                    </div>
                    {r.last && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.last.senderRole === 'USER' ? 'You: ' : ''}{r.last.body}</div>}
                  </button>
                ))}
            </div>
            <div className="card" style={{ padding: 22, minHeight: 240 }}>
              {selected ? <Thread base="/api/conversations" id={selected} viewer="USER" onChanged={load} />
                : <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}><MessageSquare size={28} style={{ marginBottom: 8 }} /><div>Select a conversation to read and reply.</div></div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
