'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

export interface ThreadMessage { id: string; senderRole: 'ADMIN' | 'USER'; body: string; createdAt: string }
export interface ThreadData {
  id: string; subject: string; status: 'OPEN' | 'CLOSED'; messages: ThreadMessage[];
  user?: { name: string; email: string };
}

/**
 * One conversation: the messages (plain text — React escapes them) plus a reply box.
 * `base` is the API root: `/api/admin/conversations` for admins, `/api/conversations` for customers.
 */
export default function Thread({ base, id, viewer, onChanged }: { base: string; id: string; viewer: 'ADMIN' | 'USER'; onChanged?: () => void }) {
  const [conv, setConv] = useState<ThreadData | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`${base}/${id}`, { cache: 'no-store' });
    const d = await res.json().catch(() => ({}));
    if (res.ok) setConv(d.data.conversation); else setError(d.error || 'Could not load the conversation');
  }, [base, id]);

  useEffect(() => { setConv(null); setError(''); void load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [conv?.messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true); setError('');
    const res = await fetch(`${base}/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setError(d.error || 'Could not send'); else { setText(''); await load(); onChanged?.(); }
    setSending(false);
  }

  async function setStatus(status: 'OPEN' | 'CLOSED') {
    const res = await fetch(`${base}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) { await load(); onChanged?.(); }
  }

  if (!conv) return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>{error || <span className="spinner" style={{ width: 24, height: 24 }} />}</div>;

  const closedForUser = viewer === 'USER' && conv.status === 'CLOSED';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{conv.subject}</div>
          {conv.user && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{conv.user.name} · {conv.user.email}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`badge badge-${conv.status === 'OPEN' ? 'active' : 'inactive'}`}>{conv.status}</span>
          {viewer === 'ADMIN' && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatus(conv.status === 'OPEN' ? 'CLOSED' : 'OPEN')}>
              {conv.status === 'OPEN' ? 'Close' : 'Re-open'}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto', padding: 4 }}>
        {conv.messages.map(m => {
          const mine = m.senderRole === viewer;
          return (
            <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
              <div style={{ background: mine ? 'var(--accent)' : 'var(--bg-elevated)', color: mine ? '#fff' : 'var(--text-primary)', borderRadius: 12, padding: '10px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14, lineHeight: 1.55 }}>
                {m.body}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, textAlign: mine ? 'right' : 'left' }}>
                {m.senderRole === 'ADMIN' ? 'DataVoult team' : (conv.user?.name || 'You')} · {new Date(m.createdAt).toLocaleString('en-IN')}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
      {closedForUser ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>This conversation is closed. Contact us if you need anything else.</div>
      ) : (
        <form onSubmit={send} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea className="input" rows={3} value={text} onChange={e => setText(e.target.value)} maxLength={5000}
            placeholder={viewer === 'ADMIN' ? 'Write a reply to the customer…' : 'Write a reply…'} style={{ flex: 1, resize: 'vertical' }} />
          <button type="submit" className="btn btn-primary" disabled={sending || !text.trim()}>
            {sending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <>Send <Send size={14} /></>}
          </button>
        </form>
      )}
    </div>
  );
}
