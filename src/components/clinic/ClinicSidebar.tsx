'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTabSession, tabSignOut } from '@/contexts/TabSessionContext'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard/clinic', label: 'Dashboard', icon: IconDashboard, exact: true },
  { href: '/dashboard/clinic/leads', label: 'My Leads', icon: IconLeads },
  { href: '/dashboard/clinic/disbursals', label: 'Disbursals', icon: IconDisbursal },
  { href: '/dashboard/clinic/change-password', label: 'Change Password', icon: IconKey },
]

interface ClinicSidebarProps {
  mobileOpen?: boolean
  onClose?: () => void
}

export function ClinicSidebar({ mobileOpen = false, onClose }: ClinicSidebarProps) {
  const { user } = useTabSession()
  const pathname = usePathname()

  const asideClass = cn(
    'fixed inset-y-0 left-0 w-64 bg-trustiva-panel flex flex-col z-50 transition-transform duration-200 border-r border-white/10',
    'lg:translate-x-0',
    mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
  )

  return (
    <aside className={asideClass}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-trustiva-lime rounded-md flex items-center justify-center flex-shrink-0 text-trustiva-navy font-bold text-sm">T</div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Trustiva Setu</p>
            <p className="text-trustiva-lime/70 text-[10px]">Clinic Portal</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="lg:hidden text-slate-400 hover:text-white p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV.map(item => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-2.5 px-2 py-2 rounded-md text-xs font-medium transition-colors',
                active ? 'bg-trustiva-lime text-trustiva-navy font-semibold' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate flex-1">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="flex-shrink-0 px-3 py-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
          <div className="w-7 h-7 bg-trustiva-lime rounded-full flex items-center justify-center text-trustiva-navy text-xs font-bold flex-shrink-0">
            {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate leading-tight">{user?.name}</p>
            <p className="text-trustiva-muted text-[10px] truncate leading-tight">{user?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => tabSignOut('/lms/login')}
          className="w-full text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white rounded-md transition flex items-center gap-2"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function IconLeads({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function IconDisbursal({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconKey({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  )
}
