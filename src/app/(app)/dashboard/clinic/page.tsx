'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { cn } from '@/lib/utils'

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

function formatAmount(n: number) {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(2)}L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${n}`
}

export default function ClinicDashboardPage() {
  const [tab, setTab] = useState<Tab>('overall')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/clinic/dashboard?tab=${tab}`)
      .then(r => r.json())
      .then(d => { setData(d.data ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tab])

  const cards = data
    ? [
        { label: 'Total Leads', value: data.totalLeads, color: 'bg-blue-50 border-blue-200 text-blue-700' },
        { label: 'Approved Leads', value: data.approved, color: 'bg-green-50 border-green-200 text-green-700' },
        { label: 'Disbursed Leads', value: data.disbursed, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
        { label: 'Rejected Leads', value: data.rejected, color: 'bg-red-50 border-red-200 text-red-700' },
        { label: 'Pending Leads', value: data.pending, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
        { label: 'Total Disbursals', value: formatAmount(data.totalDisbursalAmount), color: 'bg-purple-50 border-purple-200 text-purple-700' },
        { label: 'Approval Rate', value: `${data.approvalRate}%`, color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
        { label: 'Avg CIBIL Score', value: data.avgCibil !== null ? data.avgCibil : '—', color: 'bg-orange-50 border-orange-200 text-orange-700' },
        { label: 'Avg FOIR', value: data.avgFoir !== null ? `${data.avgFoir}%` : '—', color: 'bg-pink-50 border-pink-200 text-pink-700' },
      ]
    : []

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Clinic Dashboard" subtitle="Your loan application summary" />

      <div className="flex-1 p-6 space-y-5">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'px-5 py-2 rounded-lg text-xs font-semibold transition',
                tab === t.key
                  ? 'bg-trustiva-navy text-trustiva-lime shadow'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
            {cards.map(card => (
              <div
                key={card.label}
                className={cn('rounded-xl border p-5 flex flex-col gap-1', card.color)}
              >
                <p className="text-xs font-medium opacity-80">{card.label}</p>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
