import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Special_Elite } from 'next/font/google'
import './globals.css'
import { ApplicationProvider } from '@/lib/applicationContext'
import { IdleNudge } from '@/components/IdleNudge'
import { SITE_METADATA } from '@/lib/content'

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
})

const specialElite = Special_Elite({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-special-elite',
  display: 'swap',
})

export const metadata: Metadata = {
  title: SITE_METADATA.title,
  description: SITE_METADATA.description,
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: SITE_METADATA.appName,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f4f0e8',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plexMono.variable} ${specialElite.variable}`}>
      <body>
        <ApplicationProvider>
          {children}
          <IdleNudge />
        </ApplicationProvider>
      </body>
    </html>
  )
}
