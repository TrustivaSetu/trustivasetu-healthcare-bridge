'use client'

import dynamic from 'next/dynamic'
import { SessionProvider } from 'next-auth/react'
import { TabSessionProvider } from '@/contexts/TabSessionContext'

const Toaster = dynamic(
  () => import('react-hot-toast').then(mod => mod.Toaster),
  { ssr: false }
)

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <TabSessionProvider>
        {children}
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      </TabSessionProvider>
    </SessionProvider>
  )
}
