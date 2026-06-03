'use client'

import { useEffect, useState } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import { useRouter } from 'next/navigation'
import { formatLakhs } from '@/lib/utils'

type Tab = 'overall' | 'fortnight' | 'mtd'

interface DashboardData {
  totalLeads: number
  approved: number
  disbursed: number
  rejected: number
  pending: number
  totalDisbursalAmount: number
  approvalRate: number
  avgCibil: number | null
  avgFoir: number | null
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'overall', label: 'OVERALL' },
  { key: 'fortnight', label: 'FORTNIGHT' },
  { key: 'mtd', label: 'MTD' },
]

export default function ClinicDashboard() {
  const { user, status } = useTabSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overall')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  // Enforce mustChangePassword redirect client-side
  useEffect(() => {
    if (status === 'authenticated' && user?.mustChangePassword) {
      router.replace('/dashboard/clinic/change-password')
    }
  }, [status, user, router])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/clinic/dashboard?tab=${tab}`)
      .then(r => r.json())
      .then(d => { setData(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tab])

  if (status === 'loading') {
    return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" /></div>
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-gray-900">Clinic Dashboard</h1>
        <p className="text-sm text-gray-500">{user?.name}</p>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.key ? 'bg-white text-trustiva-navy shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" /></div>
        ) : data ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard label="Total Leads" value={data.totalLeads} color="blue" />
            <MetricCard label="Approved Leads" value={data.approved} color="green" />
            <MetricCard label="Disbursed Leads" value={data.disbursed} color="emerald" />
            <MetricCard label="Rejected Leads" value={data.rejected} color="red" />
            <MetricCard label="Pending Leads" value={data.pending} color="yellow" />
            <MetricCard label="Total Disbursals" value={formatLakhs(data.totalDisbursalAmount)} color="purple" isRupee />
            <MetricCard label="Approval Rate" value={`${data.approvalRate}%`} color="indigo" />
            <MetricCard label="Avg CIBIL Score" value={data.avgCibil ?? '—'} color="cyan" />
            <MetricCard label="Avg FOIR" value={data.avgFoir != null ? `${data.avgFoir}%` : '—'} color="orange" />
          </div>
        ) : (
          <p className="text-center text-gray-500 py-16">No data available</p>
        )}
      </div>
    </div>
  )
}

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  green: 'bg-green-50 text-green-700 border-green-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  red: 'bg-red-50 text-red-700 border-red-100',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  orange: 'bg-orange-50 text-orange-700 border-orange-100',
}

function MetricCard({ label, value, color, isRupee }: { label: string; value: string | number; color: string; isRupee?: boolean }) {
  const cls = COLOR_MAP[color] ?? 'bg-gray-50 text-gray-700 border-gray-100'
  return (
    <div className={`rounded-xl border p-5 ${cls}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
