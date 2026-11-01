import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import { COMPANY } from '@/lib/company';
import { Server, Layers, Smartphone, Workflow, Bot, Boxes, MapPin, Mail, Phone } from 'lucide-react';

export const metadata: Metadata = {
  title: 'About us — DataVoult',
  description: 'DataVoult provides cloud servers, Docker hosting and email services in India, backed by a technology team delivering business-driven solutions since 2011.',
};

const h2 = { fontSize: 24, fontWeight: 700, margin: '44px 0 12px' } as const;
const p = { color: 'var(--text-secondary)', lineHeight: 1.75, margin: '0 0 14px', fontSize: 16 } as const;

const EXPERTISE = [
  { icon: <Layers size={20} />,     title: 'Strategic enterprise consulting', text: 'Enterprise roll-out planning plus technical and functional design help for scalable, departmental implementations.' },
  { icon: <Boxes size={20} />,      title: 'Application development',        text: 'Business intelligence, e-business, internet and intranet, portal and custom application development.' },
  { icon: <Smartphone size={20} />, title: 'Mobile app development',         text: 'Android and iOS apps built with React Native, Flutter and native Android.' },
  { icon: <Workflow size={20} />,   title: 'Business process management',    text: 'Mapping current-state processes and systems, and documenting goals and objectives.' },
  { icon: <Bot size={20} />,        title: 'Agentic AI consulting',          text: 'Secure, automated systems for the education and financial services sectors.' },
  { icon: <Server size={20} />,     title: 'AEM consulting',                 text: 'Adobe Experience Manager services delivered by certified AEM experts.' },
];

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />
      <main className="container" style={{ maxWidth: 900, padding: '56px 24px' }}>
        <h1 style={{ fontSize: 38, fontWeight: 700, marginBottom: 10 }}>About {COMPANY.name}</h1>
        <p style={{ ...p, fontSize: 18 }}>
          {COMPANY.name} gives startups and growing businesses in India dependable cloud infrastructure — VPS servers, Docker hosting and
          business email — with simple per-day pricing in rupees and a real team behind every order.
        </p>

        <h2 style={h2}>Who we are</h2>
        <p style={p}>
          We are a professional IT service team working across web technologies and mobility. Since 2011 we have delivered business-driven
          technology solutions to small and medium enterprises, helping small startups establish their IT and offering consultation that
          helps them grow.
        </p>
        <p style={p}>
          We bring together innovation, storytelling and revenue generation to inspire action — and we apply the same hands-on approach to
          the infrastructure we sell: every server is set up and handed over by people who understand the stack you are running.
        </p>

        <h2 style={h2}>What we do</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {EXPERTISE.map(e => (
            <div key={e.title} className="card" style={{ padding: 20 }}>
              <div style={{ color: 'var(--accent-bright)', marginBottom: 10 }}>{e.icon}</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{e.title}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>{e.text}</div>
            </div>
          ))}
        </div>

        <h2 style={h2}>Industries we serve</h2>
        <p style={p}>Financial services, retail and healthcare — alongside startups and small businesses building their first products.</p>

        <h2 style={h2}>Find us</h2>
        <div className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 15 }}>
          <div style={{ display: 'flex', gap: 12 }}><MapPin size={18} style={{ flexShrink: 0, marginTop: 2 }} /><span>{COMPANY.addressLines.join(', ')}</span></div>
          <div style={{ display: 'flex', gap: 12 }}><Phone size={18} style={{ flexShrink: 0, marginTop: 2 }} /><a href={`tel:${COMPANY.phoneHref}`}>{COMPANY.phoneDisplay}</a></div>
          <div style={{ display: 'flex', gap: 12 }}><Mail size={18} style={{ flexShrink: 0, marginTop: 2 }} /><a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 36, flexWrap: 'wrap' }}>
          <Link href="/products" className="btn btn-primary">Explore products</Link>
          <Link href="/contact" className="btn btn-secondary">Contact us</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
