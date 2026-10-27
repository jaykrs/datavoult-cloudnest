'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import { ArrowLeft, Rocket, RefreshCw, Trash2, ExternalLink, Plus, X, Lock, Box, Cpu } from 'lucide-react';

interface Dep {
  id: string; appName: string; repoUrl: string; branch: string; port: number; mode: 'PM2' | 'DOCKER';
  httpsMode: 'NONE' | 'SELF_SIGNED' | 'LETSENCRYPT'; domain: string | null; status: 'DEPLOYING' | 'RUNNING' | 'FAILED';
  envKeys: string[]; url: string | null; selfSigned: boolean; log?: string; lastDeployedAt: string | null;
}
interface EnvRow { key: string; value: string }

const badge = (s: Dep['status']) => (s === 'RUNNING' ? 'badge-active' : s === 'FAILED' ? 'badge-inactive' : 'badge-pending');
const httpsLabel = { NONE: 'HTTP only', SELF_SIGNED: 'Self-signed HTTPS', LETSENCRYPT: "Let's Encrypt HTTPS" } as const;

export default function DeployPage({ params }: { params: { id: string } }) {
  const [user, setUser] = useState(null);
  const [sub, setSub] = useState<any>(null);
  const [deps, setDeps] = useState<Dep[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openDep, setOpenDep] = useState<Dep | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [port, setPort] = useState('3000');
  const [mode, setMode] = useState<'PM2' | 'DOCKER'>('PM2');
  const [domain, setDomain] = useState('');
  const [https, setHttps] = useState<'AUTO' | 'NONE' | 'SELF_SIGNED' | 'LETSENCRYPT'>('AUTO');
  const [token, setToken] = useState('');
  const [env, setEnv] = useState<EnvRow[]>([]);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const s = localStorage.getItem('dv_user');
    if (s) try { setUser(JSON.parse(s)); } catch {}
    fetch(`/api/subscriptions/${params.id}`).then(r => r.json()).then(d => setSub(d?.data?.subscription || null)).catch(() => {});
  }, [params.id]);

  const load = useCallback(() => {
    fetch(`/api/deployments?subscriptionId=${params.id}`).then(r => r.json()).then(d => setDeps(d.data?.deployments || [])).catch(() => {});
  }, [params.id]);
  useEffect(load, [load]);

  // Poll the open deployment (live log) and the list while anything is running.
  const anyRunning = deps.some(d => d.status === 'DEPLOYING');
  useEffect(() => {
    if (!anyRunning && !(openDep && openDep.status === 'DEPLOYING')) return;
    const t = setInterval(() => {
      load();
      if (openId) fetch(`/api/deployments/${openId}`).then(r => r.json()).then(d => d.data && setOpenDep(d.data.deployment)).catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, [anyRunning, openId, openDep, load]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [openDep?.log]);

  async function show(id: string) {
    setOpenId(id);
    const r = await fetch(`/api/deployments/${id}`); const d = await r.json();
    if (r.ok) setOpenDep(d.data.deployment);
  }

  async function submit() {
    setError('');
    const p = Number(port);
    if (!Number.isInteger(p)) { setError('Enter a port number'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/deployments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: params.id, repoUrl: repoUrl.trim(), branch: branch.trim() || 'main', port: p, mode,
          domain: domain.trim(), httpsMode: https === 'AUTO' ? undefined : https, gitToken: token.trim(),
          env: env.filter(e => e.key.trim()).map(e => ({ key: e.key.trim(), value: e.value })),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Could not start the deployment'); return; }
      setToken(''); load(); setOpenId(d.data.deployment.id); setOpenDep(d.data.deployment);
    } catch { setError('Network error — please try again'); }
    finally { setBusy(false); }
  }

  async function redeploy(dep: Dep) {
    let gitToken = '';
    if (confirm('Is this a private repository? Press OK to enter an access token, or Cancel to continue without one.')) gitToken = window.prompt('Access token (used for this clone only, never stored)') || '';
    const res = await fetch(`/api/deployments/${dep.id}/redeploy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gitToken }) });
    const d = await res.json();
    if (!res.ok) { alert(d.error || 'Could not redeploy'); return; }
    load(); setOpenId(dep.id); setOpenDep(d.data.deployment);
  }

  async function remove(dep: Dep, force = false) {
    if (!force && !confirm(`Remove "${dep.appName}"? The app is stopped and its files and nginx config are deleted from your server.`)) return;
    const res = await fetch(`/api/deployments/${dep.id}${force ? '?force=1' : ''}`, { method: 'DELETE' });
    const d = await res.json();
    if (res.ok) { if (openId === dep.id) { setOpenId(null); setOpenDep(null); } load(); return; }
    if (confirm(`${d.error || 'Could not remove the app from your server.'}\n\nDelete the record only (the server is left as is)?`)) remove(dep, true);
  }

  const ready = sub?.status === 'ACTIVE' && !!sub?.serviceConfig?.ipAddress;
  const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 };

  return (
    <div className="page-shell">
      <DashboardSidebar user={user} />
      <main className="page-main">
        <div className="page-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 24, marginBottom: 24 }}>
          <div>
            <Link href="/services" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }}><ArrowLeft size={14} /> Back to Services</Link>
            <h1 className="page-header-title">App Deployments</h1>
            <p className="page-header-sub">
              Deploy a Next.js / Node.js repo to <strong>{sub ? `${sub.product?.name} (${sub.serviceConfig?.ipAddress || 'no IP yet'})` : '…'}</strong> —
              {' '}built and served by nginx on ports 80/443.{' '}
              <Link href={`/services/${params.id}/cloudops`} style={{ color: 'var(--accent-bright)' }}>CloudOps</Link>
            </p>
          </div>
        </div>

        <div className="page-content" style={{ maxWidth: 1100, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {sub && !ready && <div className="card" style={{ padding: 16, fontSize: 14 }}>{sub.status !== 'ACTIVE' ? `This service is ${String(sub.status).toLowerCase()}.` : 'Your server is still being set up.'}</div>}

          <div style={card}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}><Rocket size={18} /> New deployment</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label">Git repository URL</label>
                <input className="input" value={repoUrl} onChange={e => setRepoUrl(e.target.value)} placeholder="https://github.com/you/your-app" />
              </div>
              <div><label className="label">Branch</label><input className="input" value={branch} onChange={e => setBranch(e.target.value)} /></div>
              <div><label className="label">App port (nginx proxies 80/443 → this)</label><input className="input" type="number" min={1024} max={65535} value={port} onChange={e => setPort(e.target.value)} /></div>
              <div>
                <label className="label">Run with</label>
                <select className="input" value={mode} onChange={e => setMode(e.target.value as 'PM2' | 'DOCKER')} style={{ cursor: 'pointer' }}>
                  <option value="PM2">Node.js + PM2 (no Docker)</option>
                  <option value="DOCKER">Docker (uses your Dockerfile, or a generated one)</option>
                </select>
              </div>
              <div><label className="label">Domain (optional)</label><input className="input" value={domain} onChange={e => setDomain(e.target.value)} placeholder="app.example.com" /></div>
              <div>
                <label className="label">HTTPS</label>
                <select className="input" value={https} onChange={e => setHttps(e.target.value as typeof https)} style={{ cursor: 'pointer' }}>
                  <option value="AUTO">Automatic ({domain.trim() ? "Let's Encrypt" : 'self-signed on the IP'})</option>
                  <option value="LETSENCRYPT">Let&apos;s Encrypt (needs a domain pointing here)</option>
                  <option value="SELF_SIGNED">Self-signed certificate</option>
                  <option value="NONE">HTTP only</option>
                </select>
              </div>
              <div><label className="label">Access token (private repos only)</label><input className="input" type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} placeholder="Used for the clone only — never stored" /></div>
            </div>

            <div style={{ marginTop: 20 }}>
              <label className="label">Environment variables</label>
              {env.map((row, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input className="input" placeholder="KEY" value={row.key} onChange={e => setEnv(env.map((r, j) => j === i ? { ...r, key: e.target.value } : r))} style={{ maxWidth: 240, fontFamily: 'var(--font-mono)' }} />
                  <input className="input" placeholder="value" value={row.value} onChange={e => setEnv(env.map((r, j) => j === i ? { ...r, value: e.target.value } : r))} style={{ fontFamily: 'var(--font-mono)' }} />
                  <button type="button" className="icon-btn" aria-label="Remove variable" onClick={() => setEnv(env.filter((_, j) => j !== i))}><X size={14} /></button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEnv([...env, { key: '', value: '' }])}><Plus size={13} /> Add variable</button>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Stored encrypted and never shown again. <code>PORT</code> is set for you.</div>
            </div>

            {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 14 }}>{error}</div>}
            <button type="button" className="btn btn-primary" style={{ marginTop: 18 }} disabled={busy || !ready || !repoUrl.trim()} onClick={submit}>
              {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <><Rocket size={15} /> Deploy</>}
            </button>
          </div>

          <div style={card}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Your apps</h2>
            {deps.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nothing deployed yet.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {deps.map(d => (
                <div key={d.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: openId === d.id ? 'var(--bg-elevated)' : undefined }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{d.appName}</strong>
                    <span className={`badge ${badge(d.status)}`}>{d.status === 'DEPLOYING' ? 'Deploying…' : d.status === 'RUNNING' ? 'Running' : 'Failed'}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>{d.mode === 'DOCKER' ? <Box size={12} /> : <Cpu size={12} />}{d.mode === 'DOCKER' ? 'Docker' : 'PM2'} · port {d.port}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Lock size={12} />{httpsLabel[d.httpsMode]}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                      {d.url && d.status === 'RUNNING' && <a className="btn btn-secondary btn-sm" href={d.url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open</a>}
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => show(d.id)}>Logs</button>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={d.status === 'DEPLOYING'} onClick={() => redeploy(d)}><RefreshCw size={13} /> Redeploy</button>
                      <button type="button" className="icon-btn" aria-label="Remove app" disabled={d.status === 'DEPLOYING'} onClick={() => remove(d)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, wordBreak: 'break-all' }}>
                    {d.repoUrl} @ {d.branch}{d.envKeys.length > 0 && ` · ${d.envKeys.length} env var${d.envKeys.length > 1 ? 's' : ''}`}
                  </div>
                  {d.selfSigned && d.status === 'RUNNING' && <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 6 }}>Self-signed certificate: browsers show a warning until you add a domain and redeploy with Let&apos;s Encrypt.</div>}
                  {openId === d.id && openDep && (
                    <pre ref={logRef} style={{ marginTop: 12, maxHeight: 360, overflow: 'auto', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>{openDep.log || 'Waiting for output…'}</pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
