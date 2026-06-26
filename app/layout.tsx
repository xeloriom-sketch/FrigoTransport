import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import PWAUpdater from '@/components/PWAUpdater'
import ErrorBoundary from '@/components/ErrorBoundary'

const inter = Inter({ subsets: ['latin'] })

const BASE = '/FrigoTransport'

export const metadata: Metadata = {
  title: 'FrigoTransport',
  description: 'Suivi GPS de flotte frigorifique',
  manifest: `${BASE}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FrigoTransport',
  },
}

export const viewport: Viewport = {
  themeColor: '#020817',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" style={{ backgroundColor: '#020817' }}>
      <head>
        {/* PWA manifest */}
        <link rel="manifest" href={`${BASE}/manifest.json`} />

        {/* iOS — icône bureau */}
        <link rel="apple-touch-icon" href={`${BASE}/apple-touch-icon.png`} />
        <link rel="apple-touch-icon" sizes="180x180" href={`${BASE}/apple-touch-icon.png`} />

        {/* iOS — comportement app native */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="FrigoTransport" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Android */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="FrigoTransport" />

        {/* Favicon navigateur */}
        <link rel="icon" type="image/svg+xml" href={`${BASE}/icon.svg`} />
        <link rel="shortcut icon" href={`${BASE}/icon-192.png`} />

        {/* iOS splash screens — fond noir pendant le chargement */}
        <meta name="msapplication-TileColor" content="#020817" />
        <meta name="msapplication-TileImage" content={`${BASE}/icon-192.png`} />

        {/* Empêche la détection automatique de numéros de téléphone */}
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <PWAUpdater />
      </body>
    </html>
  )
}
