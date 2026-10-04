'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import { ArrowLeft, Download, Play, RefreshCw, X, CheckCircle, XCircle, Clock, ChevronDown, Settings, Plus, Trash2 } from 'lucide-react';
import { SOFTWARE_OPTIONS } from '@/config/software';

export default function CloudOpsPage({ params }: { params: { id: string } }) {
  const [user, setUser] = useState(null);
  const [sub, setSub] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
    
    // Fetch subscription details to get IP and Product Name
    fetch(`/api/subscriptions/${params.id}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          setSub(data.data);
        }
      });
  }, [params.id]);

  const [software, setSoftware] = useState('nodejs');
  const [version, setVersion] = useState('20.12.2 (LTS)');
  const [installing, setInstalling] = useState(false);
  const [deploying, setDeploying] = useState(false);
  
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [port, setPort] = useState('3000');
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'} | null>(null);

  // Environment variables state
  const [envVars, setEnvVars] = useState([
    { key: '', value: '' }
  ]);
  const [tempEnvVars, setTempEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);

  const handleEnvVarChange = (index: number, field: 'key' | 'value', val: string) => {
    const updated = tempEnvVars.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: val };
      }
      return item;
    });
    setTempEnvVars(updated);
  };

  const handleAddEnvVar = () => {
    setTempEnvVars([...tempEnvVars, { key: '', value: '' }]);
  };

  const handleRemoveEnvVar = (index: number) => {
    setTempEnvVars(tempEnvVars.filter((_, idx) => idx !== index));
  };

  const handleSaveEnvVars = () => {
    setEnvVars(tempEnvVars);
    setIsEnvModalOpen(false);
  };

  // Modal & Logs state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [operationTitle, setOperationTitle] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [logStatus, setLogStatus] = useState<'PENDING'|'RUNNING'|'SUCCESS'|'FAILED'>('PENDING');
  
  // History state
  const [history, setHistory] = useState<{id: string, title: string, status: 'SUCCESS'|'FAILED'|'RUNNING', time: string}[]>([
    { id: '1', title: 'Installed Node.js v20', status: 'SUCCESS', time: '2 hours ago' },
    { id: '2', title: 'Installed Docker', status: 'SUCCESS', time: '1 day ago' },
    { id: '3', title: 'Deployed my-app', status: 'SUCCESS', time: '2 days ago' }
  ]);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    setVersion(SOFTWARE_OPTIONS[software][0] || 'latest');
  }, [software]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const showToast = (msg: string, type: 'success'|'error') => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 3000);
  };

  const getCredentials = () => {
    const ip = sub?.serviceConfig?.ipAddress || '127.0.0.1';
    return { host: ip, username: 'root', password: 'password' };
  };

  const handleInstall = async () => {
    if (installing) return;
    setInstalling(true);
    setOperationTitle(`Installing ${software} v${version.split(' ')[0]}`);
    setLogStatus('RUNNING');
    setLogs([]);
    setIsModalOpen(true);
    addLog(`Initiating installation for ${software} v${version.split(' ')[0]}...`);

    try {
      const creds = getCredentials();
      const res = await fetch('/api/deploy/cmd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...creds,
          packageName: software
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        addLog(data.output || `${software} installed successfully.`);
        setLogStatus('SUCCESS');
        showToast('Software installed successfully', 'success');
        setHistory(prev => [{id: Date.now().toString(), title: `Installed ${software} v${version.split(' ')[0]}`, status: 'SUCCESS' as const, time: 'Just now'}, ...prev].slice(0, 4));
      } else {
        addLog(`Error: ${data.error} - ${data.details}`);
        if (data.stderr) addLog(data.stderr);
        setLogStatus('FAILED');
        showToast('Installation failed', 'error');
        setHistory(prev => [{id: Date.now().toString(), title: `Installed ${software} v${version.split(' ')[0]}`, status: 'FAILED' as const, time: 'Just now'}, ...prev].slice(0, 4));
      }
    } catch (err: any) {
      addLog(`Request failed: ${err.message}`);
      setLogStatus('FAILED');
      showToast('Installation failed', 'error');
      setHistory(prev => [{id: Date.now().toString(), title: `Installed ${software} v${version.split(' ')[0]}`, status: 'FAILED' as const, time: 'Just now'}, ...prev].slice(0, 4));
    } finally {
      setInstalling(false);
    }
  };

  const pollLogs = (pm2AppName: string, host: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/deploy/deploy-logs?host=${host}&username=root&password=password&pm2AppName=${pm2AppName}&lines=50`);
        const data = await res.json();
        if (res.ok && data.logs) {
          setLogs(prev => {
            const newLogs = data.logs.split('\n').filter((l: string) => l.trim().length > 0);
            return [`[${new Date().toLocaleTimeString()}] -- Polling remote logs --`, ...newLogs];
          });
        }
      } catch (err) {
        // ignore polling errors
      }
    }, 3000);
  };

  const handleDeploy = async () => {
    if (deploying || !repoUrl) return;
    setDeploying(true);
    setOperationTitle(`Deploying application to port ${port}`);
    setLogStatus('RUNNING');
    setLogs([]);
    setIsModalOpen(true);
    addLog(`Preparing deployment from ${repoUrl} (branch: ${branch})...`);

    try {
      const creds = getCredentials();
      const res = await fetch('/api/deploy/deploy-remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...creds,
          repoUrl,
          branch,
          port: parseInt(port),
          env: envVars.filter(v => v.key.trim() !== '')
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        addLog(`Deployment successful! App is running on port ${port}.`);
        addLog(data.message || '');
        setLogStatus('SUCCESS');
        showToast('Application deployed successfully', 'success');
        setHistory(prev => [{id: Date.now().toString(), title: `Deployed application`, status: 'SUCCESS' as const, time: 'Just now'}, ...prev].slice(0, 4));
        
        if (data.pm2AppName) {
          pollLogs(data.pm2AppName, creds.host);
        }
      } else {
        addLog(`Error: ${data.error} - ${data.details}`);
        setLogStatus('FAILED');
        showToast('Deployment failed', 'error');
        setHistory(prev => [{id: Date.now().toString(), title: `Deployment failed`, status: 'FAILED' as const, time: 'Just now'}, ...prev].slice(0, 4));
      }
    } catch (err: any) {
      addLog(`Request failed: ${err.message}`);
      setLogStatus('FAILED');
      showToast('Deployment failed', 'error');
      setHistory(prev => [{id: Date.now().toString(), title: `Deployment failed`, status: 'FAILED' as const, time: 'Just now'}, ...prev].slice(0, 4));
    } finally {
      setDeploying(false);
    }
  };

  const handleCloseModal = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setIsModalOpen(false);
  };

  return (
    <div className="page-shell">
      <DashboardSidebar user={user}/>
      <main className="page-main">
        
        <div className="page-header" style={{borderBottom: '1px solid var(--border)', paddingBottom: 24, marginBottom: 32}}>
          <div>
            <div style={{display:'flex', alignItems:'center', gap: 8, marginBottom: 20}}>
              <Link href="/services" style={{color:'var(--text-secondary)', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '6px 14px', background: 'var(--bg-elevated)', borderRadius: '100px', border: '1px solid var(--border)', transition: 'all 0.15s'}} className="btn-ghost">
                <ArrowLeft size={14}/> Back to Services
              </Link>
            </div>
            <h1 className="page-header-title" style={{fontSize: 32}}>CloudOps</h1>
            <p className="page-header-sub" style={{marginTop: 8, fontSize: 15}}>
              Manage DevOps and deployments for your service 
              <strong style={{color: 'var(--text-primary)', marginLeft: 6}}>
                {sub ? `${sub.product?.name} (${sub.serviceConfig?.ipAddress || 'No IP'})` : '...'}
              </strong>
            </p>
          </div>
          {toast && (
            <div className={`badge ${toast.type === 'success' ? 'badge-active' : 'badge-inactive'}`} style={{padding: '8px 16px', fontSize: 14}}>
              {toast.type === 'success' ? <CheckCircle size={16}/> : <XCircle size={16}/>}
              {toast.msg}
            </div>
          )}
        </div>

        <div className="page-content" style={{paddingTop: 0, maxWidth: 1200, margin: '0 auto', width: '100%'}}>
          
          {/* Top Row: Symmetrical Layout for Install and Deploy */}
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 32, marginBottom: 32}}>
            
            {/* Software Installer Card */}
            <div className="card" style={{padding: 32, display: 'flex', flexDirection: 'column'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32}}>
                <div style={{width: 48, height: 48, borderRadius: 12, background: 'rgba(59,130,246,0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <Download size={24}/>
                </div>
                <div>
                  <h3 style={{fontSize: 20, fontWeight: 600}}>Install Software</h3>
                  <p style={{fontSize: 14, color: 'var(--text-muted)', marginTop: 4}}>Install and manage software packages</p>
                </div>
              </div>
              
              <div style={{display: 'flex', flexDirection: 'column', gap: 24, flex: 1}}>
                <div>
                  <label className="label" style={{marginBottom: 8, fontSize: 14}}>Software Package</label>
                  <div style={{position: 'relative'}}>
                    <select className="input" value={software} onChange={(e) => setSoftware(e.target.value)} style={{appearance: 'none', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '14px 16px', fontSize: 15, cursor: 'pointer', outline: 'none', borderRadius: '10px'}}>
                      {Object.keys(SOFTWARE_OPTIONS).map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} color="var(--text-muted)" style={{position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none'}}/>
                  </div>
                </div>
                <div>
                  <label className="label" style={{marginBottom: 8, fontSize: 14}}>Version</label>
                  <div style={{position: 'relative'}}>
                    <select className="input" value={version} onChange={(e) => setVersion(e.target.value)} style={{appearance: 'none', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '14px 16px', fontSize: 15, cursor: 'pointer', outline: 'none', borderRadius: '10px'}}>
                      {SOFTWARE_OPTIONS[software]?.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                    <ChevronDown size={18} color="var(--text-muted)" style={{position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none'}}/>
                  </div>
                </div>
                <div style={{marginTop: 'auto', paddingTop: 8}}>
                  <button 
                    onClick={handleInstall} 
                    disabled={installing} 
                    className="btn btn-primary btn-full"
                    style={{padding: '14px 24px', fontSize: 15, fontWeight: 600, borderRadius: '10px'}}
                  >
                    {installing ? <RefreshCw size={18} className="spinner"/> : <Download size={18}/>}
                    {installing ? 'Installing Package...' : 'Install Software'}
                  </button>
                </div>
              </div>
            </div>

            {/* Application Deployment Card */}
            <div className="card" style={{padding: 32, display: 'flex', flexDirection: 'column'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32}}>
                <div style={{width: 48, height: 48, borderRadius: 12, background: 'rgba(139,92,246,0.1)', color: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <Play size={24}/>
                </div>
                <div>
                  <h3 style={{fontSize: 20, fontWeight: 600}}>Deploy Application</h3>
                  <p style={{fontSize: 14, color: 'var(--text-muted)', marginTop: 4}}>Deploy from Git repository instantly</p>
                </div>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: 24, flex: 1}}>
                <div>
                  <label className="label" style={{marginBottom: 8, fontSize: 14}}>Git Repository URL</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="https://github.com/user/project.git" 
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    style={{background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '14px 16px', fontSize: 15, borderRadius: '10px'}}
                  />
                </div>
                <div style={{display: 'flex', gap: 20}}>
                  <div style={{flex: 1}}>
                    <label className="label" style={{marginBottom: 8, fontSize: 14}}>Branch</label>
                    <input 
                      type="text" 
                      className="input" 
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      style={{background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '14px 16px', fontSize: 15, borderRadius: '10px'}}
                    />
                  </div>
                  <div style={{flex: 1}}>
                    <label className="label" style={{marginBottom: 8, fontSize: 14}}>Port</label>
                    <input 
                      type="text" 
                      className="input" 
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      style={{background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '14px 16px', fontSize: 15, borderRadius: '10px'}}
                    />
                  </div>
                </div>
                <div style={{marginTop: 'auto', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 12}}>
                  <button 
                    onClick={() => {
                      setTempEnvVars(envVars.map(v => ({ ...v })));
                      setIsEnvModalOpen(true);
                    }}
                    type="button"
                    className="btn btn-secondary btn-full"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 24px',
                      fontSize: 15,
                      fontWeight: 600,
                      borderRadius: '10px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                      <Settings size={18}/>
                      <span>Environment Variables</span>
                    </div>
                    <span style={{
                      fontSize: 13, 
                      color: 'var(--text-muted)', 
                      background: 'var(--bg-card)', 
                      padding: '4px 10px', 
                      borderRadius: '6px', 
                      border: '1px solid var(--border)',
                      fontWeight: 500
                    }}>
                      {envVars.filter(v => v.key.trim() !== '').length} Configured
                    </span>
                  </button>

                  <button 
                    onClick={handleDeploy} 
                    disabled={deploying || !repoUrl} 
                    className="btn btn-primary btn-full"
                    style={{padding: '14px 24px', fontSize: 15, fontWeight: 600, background: 'linear-gradient(90deg, var(--accent), var(--purple))', border: 'none', borderRadius: '10px'}}
                  >
                    {deploying ? <RefreshCw size={18} className="spinner"/> : <Play size={18}/>}
                    {deploying ? 'Deploying Project...' : 'Deploy Application'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Full width Recent Operations */}
          <div className="card" style={{padding: 32}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24}}>
              <h3 style={{fontSize: 20, fontWeight: 600}}>Recent Operations</h3>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
              {history.map(op => (
                <div key={op.id} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border)'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                    {op.status === 'SUCCESS' ? <CheckCircle size={20} color="var(--green)"/> : op.status === 'FAILED' ? <XCircle size={20} color="var(--red)"/> : <RefreshCw size={20} className="spinner" color="var(--accent)"/>}
                    <div>
                      <div style={{fontSize: 15, fontWeight: 500, color: 'var(--text-primary)'}}>{op.title}</div>
                      <div style={{fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 6}}>
                        <Clock size={14}/> {op.time}
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${op.status === 'SUCCESS' ? 'badge-active' : op.status === 'FAILED' ? 'badge-inactive' : 'badge-pending'}`} style={{fontSize: 12, padding: '4px 12px'}}>
                    {op.status}
                  </span>
                </div>
              ))}
              {history.length === 0 && (
                <div style={{padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, background: 'var(--bg-elevated)', borderRadius: '12px'}}>
                  No recent operations found.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Logs Modal Overlay */}
        {isModalOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(5, 8, 15, 0.75)', backdropFilter: 'blur(8px)', 
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, animation: 'fadeIn 0.2s ease-out'
          }}>
            <div className="card" style={{
              width: '100%', maxWidth: 760, background: 'var(--bg-card)', 
              border: '1px solid var(--border)', borderRadius: '20px',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)'
            }}>
              
              <div style={{padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                    {logStatus === 'RUNNING' && <RefreshCw size={20} className="spinner" color="var(--accent)"/>}
                    {logStatus === 'SUCCESS' && <CheckCircle size={20} color="var(--green)"/>}
                    {logStatus === 'FAILED' && <XCircle size={20} color="var(--red)"/>}
                    <h3 style={{fontSize: 18, fontWeight: 600, color: 'var(--text-primary)'}}>{operationTitle}</h3>
                  </div>
                  <span className={`badge ${logStatus === 'RUNNING' ? 'badge-pending' : logStatus === 'SUCCESS' ? 'badge-active' : logStatus === 'FAILED' ? 'badge-inactive' : 'badge-pending'}`} style={{fontSize: 12, padding: '4px 10px'}}>
                    {logStatus}
                  </span>
                </div>
                <button onClick={handleCloseModal} className="btn-ghost" style={{border: 'none', background: 'var(--bg-elevated)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)'}}>
                  <X size={18}/>
                </button>
              </div>

              <div style={{
                background: '#0a0a0a', height: 460, padding: 24, 
                overflowY: 'auto', fontFamily: 'var(--font-mono)', 
                fontSize: 15, color: '#a3a3a3', lineHeight: 1.6
              }}>
                {logs.length === 0 && <div style={{color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8}}><RefreshCw size={16} className="spinner"/> Waiting for logs...</div>}
                {logs.map((log, i) => (
                  <div key={i} style={{marginBottom: 6, color: log.includes('error') || log.includes('FAILED') ? '#ef4444' : log.includes('success') || log.includes('SUCCESS') ? '#10b981' : 'inherit', whiteSpace: 'pre-wrap'}}>
                    {log}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
              
              <div style={{padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16}}>
                {logStatus === 'RUNNING' && <div style={{fontSize: 14, color: 'var(--text-muted)'}}>Operation in progress...</div>}
                <button onClick={handleCloseModal} className="btn btn-secondary" style={{padding: '10px 24px', fontSize: 14, borderRadius: '8px'}}>
                  {logStatus === 'RUNNING' ? 'Run in Background' : 'Close Details'}
                </button>
              </div>

            </div>
          </div>
        )}
        {/* Environment Variables Modal */}
        {isEnvModalOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            background: 'rgba(5, 8, 15, 0.75)', backdropFilter: 'blur(8px)', 
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, animation: 'fadeIn 0.2s ease-out'
          }}>
            <div className="card" style={{
              width: '100%', maxWidth: 640, background: 'var(--bg-card)', 
              border: '1px solid var(--border)', borderRadius: '20px',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)'
            }}>
              
              <div style={{padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)'}}>
                <h3 style={{fontSize: 18, fontWeight: 600, color: 'var(--text-primary)'}}>Environment Variables</h3>
                <button onClick={() => setIsEnvModalOpen(false)} className="btn-ghost" style={{border: 'none', background: 'var(--bg-elevated)', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)'}}>
                  <X size={18}/>
                </button>
              </div>

              <div style={{padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '350px', overflowY: 'auto'}}>
                {tempEnvVars.map((envVar, idx) => (
                  <div key={idx} style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="KEY" 
                      value={envVar.key}
                      onChange={(e) => handleEnvVarChange(idx, 'key', e.target.value)}
                      style={{flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '12px 14px', fontSize: 14, borderRadius: '8px'}}
                    />
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="VALUE" 
                      value={envVar.value}
                      onChange={(e) => handleEnvVarChange(idx, 'value', e.target.value)}
                      style={{flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '12px 14px', fontSize: 14, borderRadius: '8px', fontFamily: 'var(--font-mono)'}}
                    />
                    <button 
                      onClick={() => handleRemoveEnvVar(idx)} 
                      type="button"
                      style={{
                        border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', 
                        borderRadius: '8px', width: 42, height: 42, display: 'flex', 
                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      className="btn-ghost"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                ))}

                {tempEnvVars.length === 0 && (
                  <div style={{padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14}}>
                    No environment variables configured. Click below to add one.
                  </div>
                )}

                <button 
                  onClick={handleAddEnvVar} 
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '10px 16px', fontSize: 14, borderRadius: '8px', width: 'fit-content'
                  }}
                >
                  <Plus size={16}/> Add Variable
                </button>
              </div>

              <div style={{padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', justifyContent: 'flex-end', gap: 12}}>
                <button onClick={() => setIsEnvModalOpen(false)} type="button" className="btn btn-secondary" style={{padding: '10px 20px', fontSize: 14, borderRadius: '8px'}}>
                  Cancel
                </button>
                <button onClick={handleSaveEnvVars} type="button" className="btn btn-primary" style={{padding: '10px 20px', fontSize: 14, borderRadius: '8px'}}>
                  Save Variables
                </button>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
