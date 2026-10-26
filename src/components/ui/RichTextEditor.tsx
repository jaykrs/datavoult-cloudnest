'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, Heading2, Heading3, List, ListOrdered, Quote, Link as LinkIcon, Image as ImageIcon, Code, Minus, Undo2, Redo2, Pilcrow, Eye } from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * WYSIWYG HTML editor (contentEditable) with an HTML-source tab. Images are uploaded
 * to /api/admin/media and inserted by URL — pasted/dropped image files are uploaded too.
 * The server sanitises everything on save, so what you see is what is allowed.
 */
export default function RichTextEditor({ value, onChange, minHeight = 360 }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const lastEmitted = useRef<string>(value);
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Push external changes (initial load, switching tabs) into the editable area.
  useEffect(() => {
    const el = editorRef.current;
    if (mode === 'visual' && el && value !== lastEmitted.current) {
      el.innerHTML = value;
      lastEmitted.current = value;
    }
  }, [value, mode]);
  useEffect(() => {
    if (mode === 'visual' && editorRef.current) editorRef.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const emit = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? '';
    lastEmitted.current = html;
    onChange(html);
  }, [onChange]);

  // Remember where the caret was, because clicking toolbar buttons / file dialogs moves focus.
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      const el = editorRef.current;
      if (sel && sel.rangeCount && el && el.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  function restoreSelection() {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && savedRange.current) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
  }

  function exec(cmd: string, val?: string) {
    restoreSelection();
    document.execCommand(cmd, false, val);
    emit();
  }

  function addLink() {
    const url = window.prompt('Link URL (https://…, mailto:…, or /page)');
    if (!url) return;
    if (!/^(https?:\/\/|mailto:|tel:|\/)/i.test(url.trim())) { setError('Links must start with https://, mailto:, tel: or /'); return; }
    setError('');
    exec('createLink', url.trim());
  }

  function addImageByUrl() {
    const url = window.prompt('Image URL (https://…)');
    if (!url) return;
    if (!/^https:\/\//i.test(url.trim())) { setError('Image URLs must start with https://'); return; }
    setError('');
    insertImage(url.trim());
  }

  function insertImage(url: string) {
    const alt = window.prompt('Describe the image (alt text — helps SEO and accessibility)') || '';
    exec('insertHTML', `<img src="${esc(url)}" alt="${esc(alt)}">`);
  }

  async function upload(file: File) {
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/media', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Upload failed'); return; }
      insertImage(d.data.url);
    } catch { setError('Upload failed — check your connection'); }
    finally { setUploading(false); }
  }

  function firstImage(files: FileList | null | undefined): File | null {
    if (!files) return null;
    for (let i = 0; i < files.length; i++) if (files[i].type.startsWith('image/')) return files[i];
    return null;
  }

  const Btn = ({ title, onClick, children, active }: { title: string; onClick: () => void; children: React.ReactNode; active?: boolean }) => (
    <button type="button" title={title} aria-label={title} onMouseDown={e => e.preventDefault()} onClick={onClick}
      className="icon-btn" style={{ width: 30, height: 30, background: active ? 'var(--accent-glow)' : undefined }}>{children}</button>
  );
  const Sep = () => <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        {mode === 'visual' && (
          <>
            <Btn title="Paragraph" onClick={() => exec('formatBlock', '<p>')}><Pilcrow size={15} /></Btn>
            <Btn title="Heading 2" onClick={() => exec('formatBlock', '<h2>')}><Heading2 size={15} /></Btn>
            <Btn title="Heading 3" onClick={() => exec('formatBlock', '<h3>')}><Heading3 size={15} /></Btn>
            <Sep />
            <Btn title="Bold" onClick={() => exec('bold')}><Bold size={15} /></Btn>
            <Btn title="Italic" onClick={() => exec('italic')}><Italic size={15} /></Btn>
            <Btn title="Underline" onClick={() => exec('underline')}><Underline size={15} /></Btn>
            <Sep />
            <Btn title="Bulleted list" onClick={() => exec('insertUnorderedList')}><List size={15} /></Btn>
            <Btn title="Numbered list" onClick={() => exec('insertOrderedList')}><ListOrdered size={15} /></Btn>
            <Btn title="Quote" onClick={() => exec('formatBlock', '<blockquote>')}><Quote size={15} /></Btn>
            <Btn title="Divider" onClick={() => exec('insertHorizontalRule')}><Minus size={15} /></Btn>
            <Sep />
            <Btn title="Link" onClick={addLink}><LinkIcon size={15} /></Btn>
            <Btn title="Upload image" onClick={() => { restoreSelection(); fileRef.current?.click(); }}><ImageIcon size={15} /></Btn>
            <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 6px' }} onMouseDown={e => e.preventDefault()} onClick={addImageByUrl}>Image URL</button>
            <Sep />
            <Btn title="Undo" onClick={() => exec('undo')}><Undo2 size={15} /></Btn>
            <Btn title="Redo" onClick={() => exec('redo')}><Redo2 size={15} /></Btn>
          </>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button type="button" className={`btn btn-sm ${mode === 'visual' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('visual')}><Eye size={13} /> Visual</button>
          <button type="button" className={`btn btn-sm ${mode === 'html' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('html')}><Code size={13} /> HTML</button>
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
      </div>

      {error && <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--red)', background: 'rgba(239,68,68,0.08)' }}>{error}</div>}
      {uploading && <div style={{ padding: '6px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Uploading image…</div>}

      {mode === 'visual' ? (
        <div
          ref={editorRef}
          className="blog-content"
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onPaste={e => {
            const img = firstImage(e.clipboardData?.files);
            if (img) { e.preventDefault(); void upload(img); }
          }}
          onDrop={e => {
            const img = firstImage(e.dataTransfer?.files);
            if (img) { e.preventDefault(); void upload(img); }
          }}
          style={{ minHeight, padding: '16px 20px', outline: 'none', overflowY: 'auto', maxHeight: 640 }}
        />
      ) : (
        <textarea
          value={value}
          onChange={e => { lastEmitted.current = e.target.value; onChange(e.target.value); }}
          spellCheck={false}
          style={{ width: '100%', minHeight, padding: 16, background: 'var(--bg-base)', color: 'var(--text-primary)', border: 0, outline: 'none', fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.6, resize: 'vertical' }}
        />
      )}
    </div>
  );
}
