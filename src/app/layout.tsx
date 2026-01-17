import type { Metadata, Viewport } from 'next'
import { Manrope, Rubik } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Snowfall, NewYearBanner } from '@/components/Snowfall'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { AuthGuard } from '@/components/AuthGuard'
import { SkipToContent } from '@/components/SkipToContent'
import { PWAProvider } from '@/components/PWAProvider'

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: true,
  variable: '--font-manrope',
})

const spaceGrotesk = Rubik({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: true,
  variable: '--font-space',
})

export const metadata: Metadata = {
  title:
    '\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u043f\u0438\u0441\u044c\u043c\u0430\u043c\u0438 \u2014 DMED Letters',
  description:
    '\u0415\u0434\u0438\u043d\u044b\u0439 \u0446\u0435\u043d\u0442\u0440 \u0434\u043b\u044f \u043f\u0438\u0441\u0435\u043c, \u043e\u0442\u0447\u0451\u0442\u043e\u0432 \u0438 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044f \u0438\u0441\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f \u0432 DMED.',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.svg', type: 'image/svg+xml' }],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DMED Letters',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#14b8a6' },
    { media: '(prefers-color-scheme: dark)', color: '#14b8a6' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body
        className={`${manrope.variable} ${spaceGrotesk.variable} app-body min-h-screen text-white`}
      >
        <SkipToContent />
        <Providers>
          <PWAProvider>
            <AuthGuard>
              <NewYearBanner />
              {children}
              <Snowfall />
              <OfflineIndicator />
            </AuthGuard>
          </PWAProvider>
        </Providers>
      </body>
    </html>
  )
}
