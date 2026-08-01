import type { Metadata, Viewport } from 'next';
import { inter, jetbrainsMono, spaceGrotesk } from '@/lib/fonts';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Ledgerline — the trading journal that shows you why',
    template: '%s · Ledgerline',
  },
  description:
    'Log every trade, import from any broker, and see exactly which setups, sessions and states of mind make you money.',
  applicationName: 'Ledgerline',
  manifest: '/manifest.webmanifest',
  keywords: [
    'trading journal',
    'trade tracker',
    'forex journal',
    'crypto trading journal',
    'trading analytics',
    'risk management',
  ],
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName: 'Ledgerline',
    title: 'Ledgerline — the trading journal that shows you why',
    description:
      'Import your fills, tag your setups, and find the pattern behind your P&L.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Ledgerline dashboard' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ledgerline — the trading journal that shows you why',
    description: 'Import your fills, tag your setups, find the pattern behind your P&L.',
    images: ['/og.png'],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#070910' },
    { media: '(prefers-color-scheme: light)', color: '#fbfbfd' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Applied before paint so a light-theme user never sees a dark flash.
 * Inline is deliberate: a fetched script would run after first paint.
 */
const themeScript = `
(function(){try{
  var stored=localStorage.getItem('theme');
  var theme=stored==='light'||stored==='dark'?stored:
    (window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
  document.documentElement.setAttribute('data-theme',theme);
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Ledgerline',
              applicationCategory: 'FinanceApplication',
              operatingSystem: 'Web',
              description:
                'A trading journal that groups your trades by setup, session and state of mind, and reports which combination actually pays.',
              url: siteUrl,
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'INR',
                description: 'Free for your first 50 trades',
              },
            }),
          }}
        />
      </head>
      <body className="min-h-dvh bg-base text-fg antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-iris-500 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
