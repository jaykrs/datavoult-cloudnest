'use client';
import Link from 'next/link';

export default function Footer() {
  const link = { color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' } as const;
  return (
    <footer style={{ padding: '40px 0', borderTop: '1px solid var(--border-subtle)' }}>
      <div className="container" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>© {new Date().getFullYear()} DataVoult</span>
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          <Link href="/products" style={link}>Products</Link>
          <Link href="/pricing" style={link}>Pricing</Link>
          <Link href="/contact" style={link}>Contact</Link>
          <Link href="/privacy" style={link}>Privacy Policy</Link>
          <button type="button" onClick={() => window.dispatchEvent(new Event('dv-cookie-settings'))} style={{ ...link, background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
            Cookie settings
          </button>
        </nav>
      </div>
    </footer>
  );
}
