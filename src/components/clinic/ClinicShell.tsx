'use client'

import { useState } from 'react'
import { ClinicSidebar } from './ClinicSidebar'
import { ComplianceFooter } from '@/components/layout/ComplianceFooter'
import { cn } from '@/lib/utils'

export function ClinicShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <ClinicSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden lg:pl-64">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-gray-900 text-sm">Trustiva Setu — Clinic Portal</span>
        </div>

        <main className={cn('flex-1 overflow-y-auto')}>
          {children}
          <ComplianceFooter />
        </main>
      </div>
    </div>
  )
}
