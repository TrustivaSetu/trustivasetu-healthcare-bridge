'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTabSession, tabSignOut } from '@/contexts/TabSessionContext'
import { cn } from '@/lib/utils'
import { ADMIN_ROLES } from '@/lib/constants'
import { usePermissions } from '@/contexts/PermissionsContext'
import type { ModuleKey } from '@/types/permissions'
import { ChangePasswordModal } from '@/components/users/ChangePasswordModal'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: string[]
  panel?: 'admin' | 'hr'
  module?: ModuleKey
  hasBadge?: boolean
}

const navItems: NavItem[] = [
  // Core
  { href: '/dashboard',  label: 'Dashboard',        icon: IconDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'], module: 'DASHBOARD' },
  { href: '/leads',      label: 'Leads',             icon: IconLeads,     roles: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'], module: 'LEADS' },
  { href: '/clinics',    label: 'Clinics / Centres', icon: IconClinic,    roles: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'], module: 'CLINICS' },
  { href: '/reports',    label: 'Reports',           icon: IconReports,   roles: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'], module: 'REPORTS' },
  { href: '/dashboard/approvals', label: 'Approvals', icon: IconApprovals, roles: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER'], hasBadge: true },
  // HR — module key used for permissions filtering
  { href: '/hr/my-profile',            label: 'My Profile',         icon: IconProfile,    roles: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'], panel: 'hr' },
  { href: '/dashboard/my/attendance',  label: 'My Attendance',      icon: IconCalendar,   roles: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'], panel: 'hr', module: 'ATTENDANCE' },
  { href: '/dashboard/my/leaves',      label: 'My Leaves',          icon: IconLeave,      roles: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'], panel: 'hr' },
  { href: '/expenses',                 label: 'My Expenses',        icon: IconExpense,    roles: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'], panel: 'hr', module: 'EXPENSES' },
  { href: '/hr/payslip',               label: 'Payslip',            icon: IconPayslip,    roles: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'], panel: 'hr', module: 'DOCUMENTS' },
  { href: '/hr/policies',              label: 'HR Policies',        icon: IconPolicies,   roles: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'], panel: 'hr', module: 'HR_POLICIES' },
  { href: '/hr/directory',             label: 'Employee Directory', icon: IconDirectory,  roles: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'], panel: 'hr', module: 'DIRECTORY' },
  { href: '/hr',                       label: 'HR Dashboard',       icon: IconHR,         roles: ['SUPER_ADMIN', 'ADMIN'], panel: 'hr', module: 'HR_MODULE' },
  { href: '/hr/salary',                label: 'Salary Management',  icon: IconSalary,     roles: ['SUPER_ADMIN', 'ADMIN'], panel: 'hr', module: 'SALARY' },
  { href: '/hr/holidays',              label: 'Holiday Calendar',   icon: IconHoliday,    roles: ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'], panel: 'hr', module: 'HR_POLICIES' },
  // Administration
  { href: '/admin/appointment-letters', label: 'Appointment Letters', icon: IconLetter,  roles: ['SUPER_ADMIN', 'ADMIN'], panel: 'admin', module: 'APPOINTMENT_LETTERS' },
  { href: '/users',              label: 'User Management', icon: IconUsers,  roles: ['SUPER_ADMIN', 'ADMIN'], panel: 'admin', module: 'USERS' },
  { href: '/admin/regions',      label: 'Regions',         icon: IconGlobe,  roles: ['SUPER_ADMIN', 'ADMIN'], panel: 'admin', module: 'REGIONS' },
  { href: '/admin/lenders',      label: 'Lenders',         icon: IconBank,   roles: ['SUPER_ADMIN', 'ADMIN'], panel: 'admin', module: 'LENDERS' },
  { href: '/admin/targets',      label: 'Targets',         icon: IconTarget, roles: ['SUPER_ADMIN', 'ADMIN'], panel: 'admin', module: 'TARGETS' },
  { href: '/admin/permissions',  label: 'Permissions',     icon: IconShield, roles: ['SUPER_ADMIN', 'ADMIN'], panel: 'admin', module: 'PERMISSIONS' },
  { href: '/admin/audit-logs',   label: 'Audit Logs',      icon: IconAudit,  roles: ['SUPER_ADMIN', 'ADMIN'], panel: 'admin', module: 'AUDIT_LOGS' },
  { href: '/admin/webhooks',     label: 'Webhook Logs',    icon: IconWebhook,roles: ['SUPER_ADMIN', 'ADMIN'], panel: 'admin', module: 'WEBHOOKS' },
  { href: '/dashboard/recycle-bin', label: 'Recycle Bin', icon: IconTrash, roles: ['SUPER_ADMIN'], panel: 'admin' },
]

interface SidebarProps {
  mobileOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const { user: session } = useTabSession()
  const pathname = usePathname()
  const { can, loading: permLoading } = usePermissions()
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [pendingApprovals, setPendingApprovals] = useState(0)
  const navRef = useRef<HTMLElement>(null)
  const savedScroll = useRef(0)

  const role = session?.role ?? ''
  const isAdmin = ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])
  const canChangePasswords = role === 'SUPER_ADMIN' || role === 'ADMIN'

  // Fetch current user's photo once per session
  useEffect(() => {
    if (!session?.id) return
    fetch('/api/hr/photo').then(r => r.json()).then(d => setPhotoUrl(d.photoUrl ?? null)).catch(() => {})
  }, [session?.id])

  // Fetch pending approvals count for manager/admin roles
  useEffect(() => {
    if (!session?.role) return
    if (!['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER'].includes(session.role)) return
    fetch('/api/approvals/pending-count')
      .then(r => r.json())
      .then(d => setPendingApprovals(d.count ?? 0))
      .catch(() => {})
    // Refresh every 60 seconds
    const interval = setInterval(() => {
      fetch('/api/approvals/pending-count')
        .then(r => r.json())
        .then(d => setPendingApprovals(d.count ?? 0))
        .catch(() => {})
    }, 60_000)
    return () => clearInterval(interval)
  }, [session?.role])

  // Persist scroll position across navigations
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    el.scrollTop = savedScroll.current
    const onScroll = () => { savedScroll.current = el.scrollTop }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const visible = navItems.filter(item => {
    if (!item.roles.includes(role)) return false
    // SUPER_ADMIN always sees everything — no permission check
    if (role === 'SUPER_ADMIN') return true
    // While permissions are still loading from the DB, show all role-appropriate items
    // so RM/TEAM_MEMBER don't see an empty sidebar during the fetch
    if (permLoading) return true
    // Permissions loaded — apply module gate
    if (item.module) return can(item.module, 'VIEW')
    return true
  })

  const mainNav = visible.filter(item => item.panel !== 'admin' && item.panel !== 'hr')
  const hrNav = visible.filter(item => item.panel === 'hr')
  const adminNav = isAdmin ? visible.filter(item => item.panel === 'admin') : []

  const asideClass = cn(
    'fixed inset-y-0 left-0 w-64 bg-trustiva-panel flex flex-col z-50 transition-transform duration-200 border-r border-white/10',
    'lg:translate-x-0',
    mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
  )

  return (
    <aside className={asideClass}>
      {/* Logo — fixed top */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-trustiva-lime rounded-md flex items-center justify-center flex-shrink-0 text-trustiva-navy font-bold text-sm">
            T
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Trustiva Setu</p>
            <p className="text-trustiva-lime/70 text-[10px]">{isAdmin ? 'Admin Panel' : 'RM Panel'}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="lg:hidden text-slate-400 hover:text-white p-1" aria-label="Close">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable nav — min-h-0 is critical so flex-1 can shrink */}
      <nav
        ref={navRef}
        className="flex-1 min-h-0 overflow-y-scroll px-2 py-3 space-y-0.5"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}
      >
        <NavSection items={mainNav} pathname={pathname} onNavigate={onClose} pendingApprovals={pendingApprovals} />

        {hrNav.length > 0 && (
          <div className="pt-3">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-trustiva-muted">HR</p>
            <NavSection items={hrNav} pathname={pathname} onNavigate={onClose} />
          </div>
        )}

        {adminNav.length > 0 && (
          <div className="pt-3">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-trustiva-muted">Administration</p>
            <NavSection items={adminNav} pathname={pathname} onNavigate={onClose} />
          </div>
        )}

        {/* Bottom padding so last item isn't flush */}
        <div className="h-2" />
      </nav>

      {/* User section — pinned at bottom */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-white/10">
        <div className="flex items-center gap-2.5 px-2 py-1.5 mb-1">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-white/20" />
          ) : (
            <div className="w-7 h-7 bg-trustiva-lime rounded-full flex items-center justify-center text-trustiva-navy text-xs font-bold flex-shrink-0">
              {session?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate leading-tight">{session?.name}</p>
            <p className="text-trustiva-muted text-[10px] truncate leading-tight">{session?.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowPasswordModal(true)}
          className="w-full text-left px-2 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white rounded-md transition flex items-center gap-2"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          Change Password
        </button>
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

      {showPasswordModal && session && (
        <ChangePasswordModal
          userId={session.id}
          userName={session.name ?? 'My Account'}
          canChange={canChangePasswords}
          onClose={() => setShowPasswordModal(false)}
        />
      )}
    </aside>
  )
}

function NavSection({
  items,
  pathname,
  onNavigate,
  pendingApprovals = 0,
}: {
  items: NavItem[]
  pathname: string
  onNavigate?: () => void
  pendingApprovals?: number
}) {
  return (
    <div className="space-y-0.5">
      {items.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        const badge = item.hasBadge ? pendingApprovals : 0
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2.5 px-2 py-2 rounded-md text-xs font-medium transition-colors',
              active
                ? 'bg-trustiva-lime text-trustiva-navy font-semibold'
                : 'text-slate-300 hover:bg-white/10 hover:text-white'
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate flex-1">{item.label}</span>
            {badge > 0 && (
              <span className={cn(
                'text-[10px] font-bold min-w-[16px] h-4 rounded-full px-1 flex items-center justify-center flex-shrink-0',
                active ? 'bg-trustiva-navy/20 text-trustiva-navy' : 'bg-red-500 text-white'
              )}>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}
function IconLeads({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function IconClinic({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
}
function IconReports({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}
function IconGlobe({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconBank({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  )
}
function IconTarget({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}
function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}
function IconAudit({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}
function IconWebhook({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  )
}
function IconProfile({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}
function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
function IconPayslip({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
function IconDirectory({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function IconHR({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
}
function IconSalary({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconHoliday({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}
function IconApprovals({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconLeave({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}
function IconExpense({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}
function IconPolicies({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
}
function IconLetter({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}
