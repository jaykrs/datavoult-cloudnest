import type { Metadata } from 'next';
import './globals.css';
import CookieConsent from '@/components/ui/CookieConsent';
import Analytics from '@/components/ui/Analytics';
import SessionGuard from '@/components/ui/SessionGuard';
import { getSiteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: 'DataVoult — Cloud Infrastructure', template: '%s' },
  description: 'High-performance VPS, Docker hosting, and Business Email for modern teams.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="noise">
      <body>
        {children}
        <SessionGuard />
        <Analytics />
        <CookieConsent />
      </body>
    </html>
  );
}
