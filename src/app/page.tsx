'use client';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import { Database, Server, Package, Mail, Shield, Zap, Globe, ArrowRight, Check } from 'lucide-react';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />

      {/* Hero */}
      <section className="hero grid-bg">
        <div className="glow-orb hero-glow" style={{ top: -200, left: '50%', transform: 'translateX(-50%)', width: 800, height: 800, background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }} />
        <div className="glow-orb hero-glow" style={{ top: 100, right: -200, width: 500, height: 500, background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)' }} />

        <div className="container hero-inner">
          <div className="hero-pill">
            <span className="hero-pill-dot" />
            All systems operational · 99.98% uptime
          </div>

          <h1 className="hero-title">
            Cloud infrastructure<br />
            <em className="hero-title-em">built for velocity</em>
          </h1>

          <p className="hero-sub">
            Deploy VPS servers, containerized applications, and professional email — all from one unified platform with transparent pricing.
          </p>

          <div className="hero-ctas">
            <Link href="/register" className="btn btn-primary btn-lg">Start free trial <ArrowRight size={18} /></Link>
            <Link href="/products" className="btn btn-secondary btn-lg">Explore products</Link>
          </div>

          <div className="hero-stats">
            {[
              { value: '50K+',  label: 'Active servers' },
              { value: '99.98%',label: 'Uptime SLA' },
              { value: '12',    label: 'Global regions' },
              { value: '<2ms',  label: 'Avg. latency' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div className="hero-stat-value">{s.value}</div>
                <div className="hero-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section style={{ padding: '80px 0', background: 'var(--bg-surface)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,48px)', marginBottom: 12 }}>Everything you need to ship</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>Three categories of services, one dashboard to rule them all.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {[
              { slug: 'vps',    color: 'var(--vps-color)',    glow: 'rgba(59,130,246,0.12)',  icon: <Server  size={28} />, title: 'Cloud VPS',       desc: 'NVMe-powered virtual servers with dedicated resources, full root access, and instant provisioning.',  features: ['KVM virtualization','NVMe SSD storage','1 Gbps network','DDoS protection'],       href: '/products?category=VPS' },
              { slug: 'docker', color: 'var(--docker-color)', glow: 'rgba(6,182,212,0.12)',   icon: <Package size={28} />, title: 'Managed Docker',   desc: 'Deploy containers at scale with auto-scaling, load balancing, and zero-downtime deployments.',          features: ['Docker Swarm & K8s','Private registry','CI/CD integration','Auto-scaling'],          href: '/products?category=DOCKER' },
              { slug: 'email',  color: 'var(--email-color)',  glow: 'rgba(139,92,246,0.12)',  icon: <Mail    size={28} />, title: 'Business Email',   desc: 'Professional email with your domain, AI-powered spam filtering, and enterprise security.',             features: ['Custom domains','AI spam filter','IMAP/SMTP/POP3','Webmail interface'],               href: '/products?category=EMAIL' },
            ].map(p => (
              <div key={p.title} className={`product-card ${p.slug}`}>
                <div className="product-card-icon" style={{ background: p.glow, color: p.color, border: `1px solid ${p.color}22` }}>
                  {p.icon}
                </div>
                <div>
                  <h3 className="product-card-title">{p.title}</h3>
                  <p className="product-card-desc">{p.desc}</p>
                </div>
                <ul className="product-card-features">
                  {p.features.map(f => (
                    <li key={f} className="product-card-feature">
                      <Check size={14} color={p.color} style={{ flexShrink: 0 }} /> {f}
                    </li>
                  ))}
                </ul>
                <Link href={p.href} className="product-card-link" style={{ color: p.color }}>
                  Explore plans <ArrowRight size={15} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,3vw,44px)', marginBottom: 20, lineHeight: 1.15 }}>
                Infrastructure you can<br /><em style={{ color: 'var(--accent-bright)' }}>actually trust</em>
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 32 }}>
                We obsess over reliability so you can focus on building. With Tier 4 data centers across 12 regions, your services stay online even when things go wrong.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { icon: <Shield size={18} />, title: 'DDoS Protection',     desc: 'Always-on protection up to 1 Tbps' },
                  { icon: <Zap    size={18} />, title: 'Instant Provisioning', desc: 'Services up in under 60 seconds'   },
                  { icon: <Globe  size={18} />, title: 'Global Network',       desc: '12 regions, 40+ edge locations'    },
                ].map(f => (
                  <div key={f.title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div className="stat-card-icon" style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-glow)', color: 'var(--accent-bright)', flexShrink: 0 }}>{f.icon}</div>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 2, fontSize: 15 }}>{f.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Terminal */}
            <div className="card card-xl" style={{ overflow: 'hidden', boxShadow: 'var(--shadow-lg)', padding: 0 }}>
              <div style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', padding: '12px 16px', display: 'flex', gap: 6, alignItems: 'center' }}>
                {['#ef4444','#f59e0b','#10b981'].map(c => <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />)}
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8, fontFamily: 'var(--font-mono)' }}>datavoult-cli</span>
              </div>
              <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 2 }}>
                {[
                  { prompt: '$ ',  cmd: 'dv deploy --type vps --plan professional', color: 'var(--text-primary)' },
                  { prompt: '✓ ',  cmd: 'Provisioning srv-a3f9e2b1.datavoult.io',   color: 'var(--green)'       },
                  { prompt: '✓ ',  cmd: 'Assigning IP: 192.168.1.42',                color: 'var(--green)'       },
                  { prompt: '✓ ',  cmd: 'Configuring firewall rules',                 color: 'var(--green)'       },
                  { prompt: '✓ ',  cmd: 'Setting up automated backups',               color: 'var(--green)'       },
                  { prompt: '→ ',  cmd: 'Server ready in 42s 🚀',                     color: 'var(--accent-bright)'},
                ].map((line, i) => (
                  <div key={i} style={{ color: line.color }} className="animate-fade-in">
                    <span style={{ color: 'var(--text-muted)' }}>{line.prompt}</span>{line.cmd}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 0', background: 'var(--bg-surface)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.08) 100%)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 'var(--radius-xl)', padding: '64px 48px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,48px)', marginBottom: 16 }}>Ready to deploy?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 32, maxWidth: 480, margin: '0 auto 32px' }}>Start with a free trial. No credit card required. Upgrade anytime.</p>
            <Link href="/register" className="btn btn-primary btn-lg">Create free account <ArrowRight size={18} /></Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '40px 0', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
            <div style={{ width: 24, height: 24, background: 'var(--accent)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={14} color="white" />
            </div>
            DataVoult
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>© 2025 DataVoult. All rights reserved.</div>
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--text-muted)' }}>
            <Link href="/products">Products</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/login">Login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
