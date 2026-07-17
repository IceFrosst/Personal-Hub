import type { Metadata, Viewport } from 'next'
import './globals.css'
import RegisterSW from '@/components/RegisterSW'

export const metadata: Metadata = {
  title: 'Event Radar',
  description: 'Find hackathons worth traveling to.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Event Radar',
  },
  icons: {
    apple: '/icons/event-radar-180.png',
    icon: '/icons/event-radar-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#161618',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RegisterSW />
        {children}
      </body>
    </html>
  )
}
