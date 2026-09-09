import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({ variable: '--font-geist', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_ORIGIN ?? 'http://localhost:3000'),
  title: 'Central Comercial | WG Hidráulica',
  description: 'Sistema web empresarial integrado aos processos comerciais da WG Hidráulica.',
  openGraph: {
    title: 'WG Hidráulica',
    description: 'Soluções hidráulicas para operações que não podem parar.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WG Hidráulica',
    description: 'Soluções hidráulicas para operações que não podem parar.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={geist.variable}>{children}</body></html>;
}
