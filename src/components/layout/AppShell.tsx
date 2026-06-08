'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { PermissionsProvider } from '@/contexts/PermissionsContext'
import { InactivityGuard } from '@/components/InactivityGuard'
import { CelebrationPopup } from '@/components/hr/CelebrationPopup'
import { ComplianceFooter } from '@/components/layout/ComplianceFooter'
import { cn } from '@/lib/utils'

const isTestingMode = process.env.NEXT_PUBLIC_TESTING_MODE === 'true'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <PermissionsProvider>
      <InactivityGuard />
      <CelebrationPopup />
      {isTestingMode && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-400 text-amber-900 text-center text-xs font-bold py-1 tracking-wide shadow">
          ⚠ TESTING MODE — Auto-random lead processing is active. Not for production use.
        </div>
      )}
      <div className={cn('flex h-screen overflow-hidden bg-gray-50', isTestingMode && 'pt-6')}>
        {/* Mobile overlay */}
        {mobileOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex flex-1 flex-col overflow-hidden lg:pl-64">
          {/* Mobile top bar */}
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-semibold text-gray-900 text-sm">Trustiva Setu LMS</span>
          </div>

          <main className={cn('flex-1 overflow-y-auto')}>
            {children}
            <ComplianceFooter />
          </main>
        </div>
      </div>
    </PermissionsProvider>
  )
}
