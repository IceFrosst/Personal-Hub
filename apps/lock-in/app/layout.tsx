import type { Metadata, Viewport } from 'next'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lock In',
  description: 'Tasks, prioritised. Voice in, lock in.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lock In',
  },
  icons: {
    apple: '/icons/lock-in-180.png',
    icon: '/icons/lock-in-192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  )
}
