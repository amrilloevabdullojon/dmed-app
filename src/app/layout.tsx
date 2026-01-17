import type { Metadata } from 'next'
import { Manrope, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { Snowfall, NewYearBanner } from '@/components/Snowfall'
import { Particles } from '@/components/Particles'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { AuthGuard } from '@/components/AuthGuard'
import { PageTransition } from '@/components/PageTransition'
import { ThemeProvider } from '@/components/ThemeProvider'

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
  title:
    '\u0421\u0438\u0441\u0442\u0435\u043c\u0430 \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f \u043f\u0438\u0441\u044c\u043c\u0430\u043c\u0438 \u2014 DMED Letters',
  description:
    '\u0415\u0434\u0438\u043d\u044b\u0439 \u0446\u0435\u043d\u0442\u0440 \u0434\u043b\u044f \u043f\u0438\u0441\u0435\u043c, \u043e\u0442\u0447\u0451\u0442\u043e\u0432 \u0438 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044f \u0438\u0441\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u044f \u0432 DMED.',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-touch-icon.svg', type: 'image/svg+xml' }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body
        className={`${manrope.variable} ${spaceGrotesk.variable} app-body min-h-screen text-white`}
      >
        <Providers>
          <ThemeProvider>
            <AuthGuard>
              <NewYearBanner />
              <PageTransition>{children}</PageTransition>
              <Particles />
              <Snowfall />
              <OfflineIndicator />
            </AuthGuard>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
