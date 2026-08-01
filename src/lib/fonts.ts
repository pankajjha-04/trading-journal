import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';

/** Display: technical grotesk with open counters — reads as instrument, not marketing. */
export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

/** Every price, P&L and ratio. Monospace keeps decimal points on one axis. */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
});
