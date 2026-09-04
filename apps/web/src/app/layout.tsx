import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OmniFlow',
  description: 'Multi-tenant SaaS platform for CRM, ecommerce, and AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
