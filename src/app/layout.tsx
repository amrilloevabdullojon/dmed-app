import type { Metadata } from 'next'
import { Manrope, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Snowfall, NewYearBanner } from '@/components/Snowfall'
import { OfflineIndicator } from '@/components/OfflineIndicator'

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: true,
  variable: '--font-manrope',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-space',
})

export const metadata: Metadata = {
  title: '🎄 DMED Letters - С Новым Годом!',
  description: 'Система управления письмами DMED',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.svg', type: 'image/svg+xml' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" className="dark">
      <body className={`${manrope.variable} ${spaceGrotesk.variable} app-body text-white min-h-screen`}>
        <Providers>
          <NewYearBanner />
          {children}
          <Snowfall />
          <OfflineIndicator />
        </Providers>
      </body>
    </html>
  )
}
