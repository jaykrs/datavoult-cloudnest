'use client';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Copy, Download, KeyRound, Check } from 'lucide-react';

interface Meta { username: string; authType: 'password' | 'key' | 'both' | null; port: number; host: string; sshCommand: string | null }

/** Customer-facing server access: username is shown, the password / key only on request. */
export default function ServerAccess({ subscriptionId, status }: { subscriptionId: string; status: string }) {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [state, setState] = useState<'loading' | 'none' | 'ready'>('loading');
  const [secret, setSecret] = useState<{ password: string | null; privateKey: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (status !== 'ACTIVE') { setState('none'); return; }
    fetch(`/api/subscriptions/${subscriptionId}/credentials`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (r.ok) { setMeta(d.data); setState('ready'); } else setState('none'); })
      .catch(() => setState('none'));
  }, [subscriptionId, status]);

  async function reveal() {
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/subscriptions/${subscriptionId}/credentials`, { method: 'POST', cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Could not load your credentials'); return; }
      setSecret({ password: d.data.password, privateKey: d.data.privateKey });
    } catch { setError('Network error — please try again'); }
    finally { setBusy(false); }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 1500); }).catch(() => {});
  }

  function downloadKey() {
    if (!secret?.privateKey) return;
    const url = URL.createObjectURL(new Blob([secret.privateKey], { type: 'application/x-pem-file' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'server-key.pem'; a.click();
    URL.revokeObjectURL(url);
  }

  if (status === 'PENDING') {
    return <div className="service-card-config" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
      Your server is being prepared. We&apos;ll email your access details as soon as it&apos;s ready — they&apos;ll also appear here.
    </div>;
  }
  if (state !== 'ready' || !meta) return null;

  const row = (label: string, value: string, key: string) => (
    <div>
      <div className="config-label">{label}</div>
      <div className="config-val"><code className="config-code">{value}</code>
        <button className="copy-btn" aria-label={`Copy ${label}`} onClick={() => copy(value, key)}>{copied === key ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}</button>
      </div>
    </div>
  );

  return (
    <div className="service-card-config" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {row('Username', meta.username, 'u')}
        {meta.port !== 22 && row('SSH port', String(meta.port), 'p')}
        {secret?.password && (
          <div>
            <div className="config-label">Password</div>
            <div className="config-val"><code className="config-code" style={{ userSelect: 'all' }}>{secret.password}</code>
              <button className="copy-btn" aria-label="Copy password" onClick={() => copy(secret.password!, 'pw')}>{copied === 'pw' ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}</button>
            </div>
          </div>
        )}
      </div>
      {meta.sshCommand && <div><div className="config-label">Connect</div>
        <div className="config-val"><code className="config-code">{meta.sshCommand}</code>
          <button className="copy-btn" aria-label="Copy command" onClick={() => copy(meta.sshCommand!, 'cmd')}>{copied === 'cmd' ? <Check size={12} color="var(--green)" /> : <Copy size={12} />}</button>
        </div></div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {!secret ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={reveal} disabled={busy}>
            {busy ? <span className="spinner" style={{ width: 13, height: 13 }} /> : <><Eye size={13} /> {meta.authType === 'key' ? 'Show access key' : 'Show password'}</>}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSecret(null)}><EyeOff size={13} /> Hide</button>
            {secret.privateKey && <button type="button" className="btn btn-secondary btn-sm" onClick={downloadKey}><Download size={13} /> Download key file</button>}
          </>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', gap: 4, alignItems: 'center' }}><KeyRound size={11} /> Change the password after your first login.</span>
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 12 }}>{error}</div>}
    </div>
  );
}
