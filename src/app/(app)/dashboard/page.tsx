'use client'

import { useTabSession } from '@/contexts/TabSessionContext'
import SuperAdminDashboard from './SuperAdminDashboard'
import ManagerDashboard from './ManagerDashboard'
import RMDashboard from './RMDashboard'

export default function DashboardPage() {
  const { user, status } = useTabSession()

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" />
      </div>
    )
  }

  const role = user?.role

  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return <SuperAdminDashboard />
  if (role === 'REGIONAL_MANAGER') return <ManagerDashboard />
  if (role === 'TEAM_MEMBER') return <RMDashboard />

  return (
    <div className="flex h-screen items-center justify-center text-gray-500">
      Loading dashboard...
    </div>
  )
}
