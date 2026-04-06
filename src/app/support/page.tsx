'use client';
import { useEffect, useState } from 'react';
import DashboardSidebar from '@/components/dashboard/Sidebar';
import { MessageSquare, Plus, Send, HelpCircle, BookOpen, Video } from 'lucide-react';

interface User { name: string; email: string; role: string; }

export default function SupportPage() {
  const [user,      setUser]      = useState<User | null>(null);
  const [showForm,  setShowForm]  = useState(false);
  const [subject,   setSubject]   = useState('');
  const [body,      setBody]      = useState('');
  const [submitting,setSubmitting]= useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('dv_user');
    if (stored) try { setUser(JSON.parse(stored)); } catch {}
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1000));
    setSubmitted(true); setSubmitting(false);
    setShowForm(false); setSubject(''); setBody('');
  }

  return (
    <div className="page-shell">
      <DashboardSidebar user={user} />
      <main className="page-main">
        <div className="page-header">
          <div>
            <h1 className="page-header-title">Support</h1>
            <p className="page-header-sub">We&apos;re here to help, 24/7</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn btn-primary btn-sm">
            <Plus size={15} /> New Ticket
          </button>
        </div>

        <div className="page-content">
          {submitted && (
            <div style={{ background: 'var(--green-glow)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)', padding: '14px 20px', fontSize: 14, color: 'var(--green)' }}>
              ✓ Your support ticket has been submitted. We&apos;ll get back to you within 2 hours.
            </div>
          )}

          {showForm && (
            <div className="card card-xl">
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 24 }}>Submit a Support Ticket</h2>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label className="label">Subject</label>
                  <input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Describe your issue briefly" required />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea className="input" value={body} onChange={e => setBody(e.target.value)} placeholder="Please provide as much detail as possible…" required rows={5} style={{ resize: 'vertical', minHeight: 120 }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" disabled={submitting} className="btn btn-primary">
                    {submitting ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <><Send size={15} /> Submit Ticket</>}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Resources */}
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 16 }}>Self-service Resources</h2>
            <div className="resource-cards">
              {[
                { icon: <BookOpen size={20} />, title: 'Documentation',   desc: 'Guides, tutorials and API reference', color: 'var(--accent)',  cls: 'c-accent'  },
                { icon: <Video    size={20} />, title: 'Video Tutorials',  desc: 'Step-by-step walkthrough videos',    color: 'var(--purple)', cls: 'c-purple' },
                { icon: <HelpCircle size={20}/>,title: 'FAQ',              desc: 'Answers to common questions',        color: 'var(--green)',  cls: 'c-green'  },
              ].map(r => (
                <div key={r.title} className={`resource-card ${r.cls}`}>
                  <div className="resource-icon" style={{ background: `${r.color}15`, color: r.color }}>{r.icon}</div>
                  <h3 style={{ fontWeight: 600, marginBottom: 4 }}>{r.title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="card card-xl">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--accent-glow)', color: 'var(--accent-bright)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={22} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Contact Support</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Average response time: under 2 hours</p>
              </div>
            </div>
            <div className="contact-channels">
              {[
                { label: 'Live Chat', desc: 'Available 24/7',          status: 'Online',          statusColor: 'var(--green)'        },
                { label: 'Email',     desc: 'support@datavoult.io',     status: '< 2hr',           statusColor: 'var(--accent-bright)'},
                { label: 'Phone',     desc: '+1 (800) 555-0123',        status: 'Business hours',  statusColor: 'var(--amber)'        },
              ].map(c => (
                <div key={c.label} className="contact-channel">
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{c.desc}</div>
                  <div style={{ fontSize: 12, color: c.statusColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="status-dot" style={{ background: c.statusColor }} />
                    {c.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
