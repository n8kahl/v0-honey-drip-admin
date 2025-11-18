import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import '../src/index.css'
import TraderHeader from '@/components/Header/TraderHeader'
import ActiveTradesDock from '@/components/trading/ActiveTradesDock'

const geistSans = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Honey Drip Admin',
  description: 'Trading Dashboard',
  generator: 'v0.app',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.className} ${geistMono.className} antialiased`}>
        <TraderHeader />
        {children}
        <div className="fixed bottom-0 left-0 right-0 w-full z-50">
          <ActiveTradesDock />
        </div>
      </body>
    </html>
  );
}
