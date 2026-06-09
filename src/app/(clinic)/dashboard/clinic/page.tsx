'use client'

import { useEffect, useState } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import { useRouter } from 'next/navigation'
import { formatLakhs } from '@/lib/utils'
import toast from 'react-hot-toast'

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

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function ClinicDashboard() {
  const { user, status } = useTabSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overall')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1)
  const [reportYear, setReportYear] = useState(now.getFullYear())
  const [downloading, setDownloading] = useState(false)

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

  async function downloadReport(format: 'xlsx' | 'pdf') {
    setDownloading(true)
    try {
      const res = await fetch(`/api/clinic/report?month=${reportMonth}&year=${reportYear}&format=${format}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Failed to generate report')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${MONTHS[reportMonth - 1]}-${reportYear}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} report downloaded`)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setDownloading(false)
    }
  }

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

        {/* Download Monthly Report */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-sm font-semibold text-gray-800">Download Monthly Report</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Excel report with 3 sheets — Summary, All Leads, and Disbursals for the selected month.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Month</label>
              <select
                value={reportMonth}
                onChange={e => setReportMonth(Number(e.target.value))}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-trustiva-navy"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Year</label>
              <select
                value={reportYear}
                onChange={e => setReportYear(Number(e.target.value))}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-trustiva-navy"
              >
                {[now.getFullYear() - 1, now.getFullYear()].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => downloadReport('xlsx')}
                disabled={downloading}
                className="flex items-center gap-1.5 bg-[#07111f] text-[#bef264] font-semibold text-sm px-3 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-60"
              >
                {downloading ? (
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-trustiva-lime border-t-transparent" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                Excel
              </button>
              <button
                type="button"
                onClick={() => downloadReport('pdf')}
                disabled={downloading}
                className="flex items-center gap-1.5 bg-red-600 text-white font-semibold text-sm px-3 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-60"
              >
                {downloading ? (
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}
                PDF
              </button>
            </div>
          </div>
        </div>
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
