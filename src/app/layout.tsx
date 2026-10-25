import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Baloo_2, Space_Grotesk } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

const be = Be_Vietnam_Pro({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700'], variable: '--font-be' });
const baloo = Baloo_2({ subsets: ['latin', 'vietnamese'], variable: '--font-baloo' });
const grotesk = Space_Grotesk({ subsets: ['latin', 'vietnamese'], variable: '--font-grotesk' });

export const metadata: Metadata = {
  title: 'Gia Đình Số',
  description: 'Gia Đình Số - Digital Family: cây ký ức, từ điển Gen Z và trò chơi cho ba thế hệ.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-theme="adult" data-font="sans" data-size="normal" className={`${be.variable} ${baloo.variable} ${grotesk.variable}`} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
