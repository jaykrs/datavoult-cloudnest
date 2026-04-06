import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DataVoult — Cloud Infrastructure',
  description: 'High-performance VPS, Docker hosting, and Business Email for modern teams.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="noise">
      <body>{children}</body>
    </html>
  );
}
