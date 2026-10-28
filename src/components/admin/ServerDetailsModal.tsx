'use client';
import { useEffect, useState } from 'react';
import { X, Upload } from 'lucide-react';

interface Props { subscriptionId: string; title: string; pending: boolean; onClose: () => void; onSaved: (msg: string) => void }

/** Admin form: record (or update) a service's server details and credentials, optionally emailing the customer. */
export default function ServerDetailsModal({ subscriptionId, title, pending, onClose, onSaved }: Props) {
  const [f, setF] = useState({ hostname: '', ipAddress: '', domain: '', region: 'ap-south-1 (Mumbai)', os: 'Ubuntu 22.04 LTS', sshPort: '22', username: 'root', hostKeySha256: '' });
  const [auth, setAuth] = useState<'password' | 'key'>('password');
  const [password, setPassword] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [existingAuth, setExistingAuth] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/subscriptions/${subscriptionId}/provision`).then(r => r.json()).then(d => {
      const x = d.data?.details;
      if (x) {
        setF(p => ({ ...p, hostname: x.hostname || '', ipAddress: x.ipAddress || '', domain: x.domain || '', region: x.region || p.region, os: x.os || p.os, sshPort: String(x.sshPort || 22), username: x.username || p.username, hostKeySha256: x.hostKeySha256 || '' }));
        setExistingAuth(x.authType);
        if (x.authType === 'key') setAuth('key');
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [subscriptionId]);

  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));

  async function readKeyFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 16 * 1024) { setError('That file is too large to be a private key'); return; }
    setPrivateKey(await file.text());
    setError('');
  }

  async function save() {
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${subscriptionId}/provision`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostname: f.hostname, ipAddress: f.ipAddress, domain: f.domain, region: f.region, os: f.os, sshPort: Number(f.sshPort),
          hostKeySha256: f.hostKeySha256,
          credentials: f.username.trim() ? { username: f.username.trim(), password: auth === 'password' ? password : '', privateKey: auth === 'key' ? privateKey : '' } : undefined,
          notifyCustomer: notify,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Could not save'); return; }
      onSaved(pending ? `Service activated${d.data.emailed ? ' and details emailed to the customer' : notify ? ' (email not sent — check SMTP settings)' : ''}` : `Details updated${d.data.emailed ? ' and emailed to the customer' : ''}`);
    } catch { setError('Network error — please try again'); }
    finally { setSaving(false); }
  }

  const field = (label: string, k: keyof typeof f, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div><label className="label">{label}</label><input className="input" value={f[k]} onChange={e => set(k, e.target.value)} {...props} style={{ fontSize: 13 }} /></div>
  );

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>{pending ? 'Provision service' : 'Server details'}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{title}</p>
        {loading ? <span className="spinner" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {field('Hostname', 'hostname', { placeholder: 'srv-1.example.com' })}
              {field('IP address', 'ipAddress', { placeholder: '203.0.113.10' })}
              {field('Domain (optional)', 'domain')}
              {field('Region', 'region')}
              {field('Operating system', 'os')}
              {field('SSH port', 'sshPort', { type: 'number', min: 1, max: 65535 })}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Login credentials</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {field('Username', 'username')}
                <div>
                  <label className="label">Authentication</label>
                  <select className="input" value={auth} onChange={e => setAuth(e.target.value as 'password' | 'key')} style={{ fontSize: 13, cursor: 'pointer' }}>
                    <option value="password">Password</option><option value="key">Private key file</option>
                  </select>
                </div>
              </div>
              {auth === 'password' ? (
                <div style={{ marginTop: 12 }}>
                  <label className="label">Password</label>
                  <input className="input" type="text" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }} placeholder={existingAuth ? 'Leave blank to keep the stored secret' : ''} />
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <label className="label">Private key (PEM / OpenSSH)</label>
                  <label className="btn btn-secondary btn-sm" style={{ marginBottom: 8, display: 'inline-flex', cursor: 'pointer' }}>
                    <Upload size={13} /> Choose key file
                    <input type="file" hidden onChange={e => { void readKeyFile(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  <textarea className="input" rows={5} value={privateKey} onChange={e => setPrivateKey(e.target.value)} spellCheck={false} style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }} placeholder={existingAuth ? 'Leave blank to keep the stored secret' : '-----BEGIN OPENSSH PRIVATE KEY-----'} />
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Stored encrypted. The customer sees these details on their dashboard and by email. Customers can run CloudOps and app deployments with them.</div>
            </div>

            {field('SSH host key SHA-256 (optional, 64 hex chars — pinned for CloudOps)', 'hostKeySha256')}

            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} /> Email these details to the customer
            </label>
            {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>{saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : pending ? 'Activate & send details' : 'Save'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
