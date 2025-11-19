import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import Navigation from '@/components/Navigation';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'VendorFlow AI - Vendor Risk Management & Compliance',
    template: '%s | VendorFlow AI',
  },
  description:
    'AI-powered multi-tenant SaaS platform for vendor risk assessment, compliance management, and DORA/NIS2/AI Act regulatory compliance tracking.',
  keywords: [
    'vendor management',
    'risk assessment',
    'compliance',
    'DORA',
    'NIS2',
    'AI Act',
    'vendor risk',
    'third-party risk',
    'regulatory compliance',
  ],
  authors: [{ name: 'VendorFlow AI' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'VendorFlow AI - Vendor Risk Management & Compliance',
    description:
      'AI-powered platform for vendor risk assessment and regulatory compliance (DORA, NIS2, AI Act)',
    siteName: 'VendorFlow AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VendorFlow AI - Vendor Risk Management & Compliance',
    description:
      'AI-powered platform for vendor risk assessment and regulatory compliance',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <AuthProvider>
            <Navigation />
            {children}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
