'use client';
import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

/** Image URL input with an upload button (uploads to the media library) and a preview. */
export default function ImageField({ label, value, onChange, hint }: { label: string; value: string; onChange: (url: string) => void; hint?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(file: File) {
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/media', { method: 'POST', body: fd });
      const d = await res.json();
      if (res.ok) onChange(d.data.url); else setError(d.error || 'Upload failed');
    } catch { setError('Upload failed — check your connection'); }
    setBusy(false);
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input className="input" value={value} onChange={e => onChange(e.target.value)} placeholder="Upload, or paste an https:// image URL" style={{ fontSize: 13 }} />
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => fileRef.current?.click()} style={{ whiteSpace: 'nowrap' }}>
          {busy ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <><Upload size={13} /> Upload</>}
        </button>
        {value && <button type="button" className="icon-btn" title="Remove" onClick={() => onChange('')}><X size={14} /></button>}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
      {error && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{error}</div>}
      {value && /^(\/api\/media\/|https:\/\/)/.test(value) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" style={{ marginTop: 8, maxHeight: 120, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
      )}
    </div>
  );
}
