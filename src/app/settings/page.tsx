'use client';
import { useEffect, useState } from 'react';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import { User, Lock, Bell, Shield, Save } from 'lucide-react';

interface UserData { id: string; name: string; email: string; role: string; createdAt: string; }

export default function SettingsPage() {
  const [user,        setUser]        = useState<UserData | null>(null);
  const [name,        setName]        = useState('');
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [savingProf,  setSavingProf]  = useState(false);
  const [savingPwd,   setSavingPwd]   = useState(false);
  const [profMsg,     setProfMsg]     = useState<{text:string;ok:boolean}|null>(null);
  const [pwdMsg,      setPwdMsg]      = useState<{text:string;ok:boolean}|null>(null);
  const [activeTab,   setActiveTab]   = useState('profile');

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { const u = JSON.parse(stored); setUser(u); setName(u.name); } catch {}
    fetch('/api/users/me').then(r => r.json()).then(d => {
      if (d.data?.user) { setUser(d.data.user); setName(d.data.user.name); }
    });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProf(true);
    const res = await fetch('/api/users/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const data = await res.json();
    setProfMsg({ text: res.ok ? 'Profile updated successfully' : (data.error || 'Update failed'), ok: res.ok });
    if (res.ok) localStorage.setItem('dv_user', JSON.stringify({ ...user, name }));
    setSavingProf(false);
    setTimeout(() => setProfMsg(null), 3000);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 8) { setPwdMsg({ text: 'New password must be at least 8 characters', ok: false }); return; }
    setSavingPwd(true);
    const res = await fetch('/api/users/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }) });
    const data = await res.json();
    setPwdMsg({ text: res.ok ? 'Password changed successfully' : (data.error || 'Failed'), ok: res.ok });
    if (res.ok) { setCurrentPwd(''); setNewPwd(''); }
    setSavingPwd(false);
    setTimeout(() => setPwdMsg(null), 3000);
  }

  const tabs = [
    { id: 'profile',       icon: <User  size={16} />, label: 'Profile'       },
    { id: 'security',      icon: <Lock  size={16} />, label: 'Security'      },
    { id: 'notifications', icon: <Bell  size={16} />, label: 'Notifications' },
  ];

  return (
    <div className="page-shell">
      <DashboardSidebar user={user} />
      <main className="page-main">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Settings</h1>
            <p className="page-header-sub">Manage your account preferences</p>
          </div>
        </div>

        <div className="page-content">
          <div className="settings-layout">
            <div className="settings-tabs">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={`settings-tab-btn${activeTab === t.id ? ' active' : ''}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <div className="settings-content">
              {activeTab === 'profile' && (
                <div className="settings-card">
                  <h2 className="settings-title">Profile Information</h2>
                  <p className="settings-sub">Update your name and account details.</p>
                  {profMsg && <div className={`settings-msg ${profMsg.ok ? 'success' : 'error'}`}>{profMsg.text}</div>}
                  <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <label className="label">Full Name</label>
                      <input className="input" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label">Email Address</label>
                      <input className="input" value={user?.email || ''} disabled />
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Email cannot be changed. Contact support if needed.</p>
                    </div>
                    <div>
                      <label className="label">Member Since</label>
                      <input className="input" value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''} disabled />
                    </div>
                    <div>
                      <label className="label">Role</label>
                      <input className="input" value={user?.role || ''} disabled />
                    </div>
                    <button type="submit" disabled={savingProf} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                      {savingProf ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <><Save size={15} /> Save Changes</>}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="settings-card">
                  <h2 className="settings-title">Security</h2>
                  <p className="settings-sub">Keep your account secure with a strong password.</p>
                  {pwdMsg && <div className={`settings-msg ${pwdMsg.ok ? 'success' : 'error'}`}>{pwdMsg.text}</div>}
                  <form onSubmit={savePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <label className="label">Current Password</label>
                      <input type="password" className="input" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} required />
                    </div>
                    <div>
                      <label className="label">New Password</label>
                      <input type="password" className="input" value={newPwd} onChange={e => setNewPwd(e.target.value)} required placeholder="Min. 8 characters" />
                    </div>
                    <button type="submit" disabled={savingPwd} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                      {savingPwd ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <><Lock size={15} /> Change Password</>}
                    </button>
                  </form>
                  <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)', flexShrink: 0 }}>
                      <Shield size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>Two-Factor Authentication</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Add an extra layer of security to your account.</div>
                      <button className="btn btn-secondary btn-sm">Enable 2FA</button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="settings-card">
                  <h2 className="settings-title">Notifications</h2>
                  <p className="settings-sub">Choose what notifications you receive.</p>
                  <div>
                    {[
                      { label: 'Service alerts',    desc: 'Downtime, performance issues',                   on: true  },
                      { label: 'Billing reminders', desc: 'Invoice due dates, payment confirmations',       on: true  },
                      { label: 'Security alerts',   desc: 'Unusual login activity, password changes',       on: true  },
                      { label: 'Product updates',   desc: 'New features, maintenance windows',               on: false },
                      { label: 'Newsletter',         desc: 'Tips, tutorials, and company news',              on: false },
                    ].map(item => (
                      <div key={item.label} className="notif-row">
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14 }}>{item.label}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.desc}</div>
                        </div>
                        <div className="toggle" style={{ background: item.on ? 'var(--accent)' : 'var(--bg-elevated)' }}>
                          <div className="toggle-thumb" style={{ left: item.on ? 22 : 3 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-primary" style={{ marginTop: 24 }}>
                    <Save size={15} /> Save Preferences
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
