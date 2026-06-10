import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { CookieConsent } from '@/components/CookieConsent'

export const dynamic = 'force-dynamic'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'Trustiva Setu — Healthcare Loan Facilitation Platform',
    template: '%s — Trustiva Setu',
  },
  description:
    'Trustiva Setu is a loan facilitation platform connecting patients with partner banks and NBFCs for healthcare financing. Not a bank or NBFC.',
  keywords: ['healthcare loan', 'medical loan facilitation', 'EMI healthcare India'],
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    siteName: 'Trustiva Setu',
    title: 'Trustiva Setu — Healthcare Loan Facilitation',
    description:
      'Loan facilitation platform for healthcare financing in India. Partner banks and NBFCs provide all loans.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className={`${inter.className} min-h-full font-sans`}>
        <Providers>{children}</Providers>
        <CookieConsent />
      </body>
    </html>
  )
}
