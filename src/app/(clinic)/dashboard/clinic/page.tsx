'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTabSession } from '@/contexts/TabSessionContext'
import { useRouter } from 'next/navigation'
import { formatDate, formatLakhs, cn } from '@/lib/utils'

interface Stats {
  totalLeads: number
  todayLeads: number
  monthLeads: number
  approved: number
  disbursed: number
  rejected: number
  pendingDisbursal: number
}

interface Lead {
  id: string
  applicantName: string
  phone: string | null
  amount: number
  status: string
  applicationDate: string
  disbursalDate: string | null
  treatmentName: string | null
  lender: { name: string } | null
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  DISBURSED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  DOCS_PENDING: 'bg-purple-100 text-purple-800',
}

function calcFirstEmi(disbursalDate: string | null, status: string): string {
  if (status !== 'DISBURSED' || !disbursalDate) return '—'
  const d = new Date(disbursalDate)
  d.setDate(d.getDate() + 45)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ClinicDashboard() {
  const { user, status } = useTabSession()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'authenticated' && user?.mustChangePassword) {
      router.replace('/dashboard/clinic/change-password')
    }
  }, [status, user, router])

  useEffect(() => {
    Promise.all([
      fetch('/api/clinic/dashboard').then(r => r.json()),
      fetch('/api/clinic/leads?pageSize=10').then(r => r.json()),
    ])
      .then(([statsRes, leadsRes]) => {
        setStats(statsRes.data ?? null)
        setLeads(leadsRes.data ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  if (status === 'loading') {
    return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" /></div>
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">{user?.name}</p>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" /></div>
        ) : stats ? (
          <>
            {/* Row 1: Volume */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Total Leads" value={stats.totalLeads} color="blue" />
              <StatCard label="Today" value={stats.todayLeads} color="indigo" />
              <StatCard label="This Month" value={stats.monthLeads} color="violet" />
            </div>

            {/* Row 2: Status */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Approved" value={stats.approved} color="green" />
              <StatCard label="Disbursed" value={stats.disbursed} color="emerald" />
              <StatCard label="Rejected" value={stats.rejected} color="red" />
            </div>

            {/* Row 3: Pending Disbursal alert */}
            {stats.pendingDisbursal > 0 && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
                <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 animate-pulse" />
                <p className="text-sm font-medium text-amber-800">
                  <span className="font-bold">{stats.pendingDisbursal}</span> lead{stats.pendingDisbursal > 1 ? 's' : ''} approved but pending disbursal
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-gray-500 py-16">No data available</p>
        )}

        {/* Recent Leads table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-800">Recent Leads</h2>
            <Link href="/dashboard/clinic/leads" className="text-xs text-blue-600 hover:text-blue-800 font-medium">View all →</Link>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Lead ID', 'Patient Name', 'Phone', 'Loan Amount', 'Treatment', 'Status', 'Lender', 'Applied On', 'First EMI Date'].map(h => (
                        <th key={h} className="px-3 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {leads.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-mono text-gray-500 whitespace-nowrap">{l.id.slice(-8).toUpperCase()}</td>
                        <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                          <Link href={`/dashboard/clinic/leads/${l.id}`} className="hover:text-blue-600">{l.applicantName}</Link>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{l.phone ?? '—'}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{formatLakhs(l.amount)}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap max-w-[120px] truncate">{l.treatmentName ?? '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_BADGE[l.status] ?? 'bg-gray-100 text-gray-700')}>
                            {l.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{l.lender?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(l.applicationDate)}</td>
                        <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{calcFirstEmi(l.disbursalDate, l.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {leads.length === 0 && <p className="text-center text-sm text-gray-400 py-8">No leads yet</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-red-50 text-red-700 border-red-100',
  }
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color] ?? 'bg-gray-50 text-gray-700 border-gray-100'}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}
