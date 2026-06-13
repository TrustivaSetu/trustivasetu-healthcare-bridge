'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDate, formatLakhs, cn } from '@/lib/utils'

const STATUSES = ['', 'PENDING', 'APPROVED', 'DISBURSED', 'REJECTED', 'CANCELLED', 'DOCS_PENDING']

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  DISBURSED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  DOCS_PENDING: 'bg-purple-100 text-purple-800',
}

interface Lead {
  id: string
  leadNumber: number
  applicantName: string
  phone: string | null
  amount: number
  status: string
  applicationDate: string
  approvalDate: string | null
  disbursalDate: string | null
  approvedAmount: number | null
  disbursedAmount: number | null
  utrNumber: string | null
  treatmentName: string | null
  lender: { id: string; name: string } | null
}

interface Lender {
  id: string
  name: string
}

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function calcFirstEmi(disbursalDate: string | null, status: string): string {
  if (status !== 'DISBURSED' || !disbursalDate) return '—'
  const d = new Date(disbursalDate)
  d.setDate(d.getDate() + 45)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function ClinicLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [lenders, setLenders] = useState<Lender[]>([])
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [lenderId, setLenderId] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [page, setPage] = useState(1)
  const pageSize = 10

  useEffect(() => {
    fetch('/api/clinic/lenders')
      .then(r => r.json())
      .then(d => setLenders(d.data ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (status) params.set('status', status)
    if (search) params.set('search', search)
    if (lenderId) params.set('lenderId', lenderId)
    if (month) { params.set('month', month); params.set('year', year) }
    fetch(`/api/clinic/leads?${params}`)
      .then(r => r.json())
      .then(d => { setLeads(d.data ?? []); setTotal(d.total ?? 0); setLoading(false) })
      .catch(() => setLoading(false))
  }, [status, search, lenderId, month, year, page])

  const totalPages = Math.ceil(total / pageSize)
  const nowYear = new Date().getFullYear()

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-gray-900">My Leads</h1>
        <p className="text-sm text-gray-500">{total} total</p>
      </div>

      <div className="flex-1 p-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <input
            type="search"
            placeholder="Search by name..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-lime w-44"
          />
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-lime"
          >
            {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
          {lenders.length > 0 && (
            <select
              value={lenderId}
              onChange={e => { setLenderId(e.target.value); setPage(1) }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-lime"
            >
              <option value="">All Lenders</option>
              {lenders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <select
            value={month}
            onChange={e => { setMonth(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-lime"
          >
            {MONTHS.map((m, i) => <option key={i} value={i === 0 ? '' : String(i)}>{m || 'All Months'}</option>)}
          </select>
          {month && (
            <select
              value={year}
              onChange={e => { setYear(e.target.value); setPage(1) }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-lime"
            >
              {[nowYear - 1, nowYear].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {['Lead ID', 'Patient Name', 'Phone', 'Amount', 'Treatment', 'Status', 'Lender', 'Approved Amt', 'Disbursed Amt', 'UTR', 'Applied On', 'Approval Date', 'Disbursal Date', 'First EMI Date'].map(h => (
                      <th key={h} className="px-3 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leads.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 whitespace-nowrap"><span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{l.leadNumber ? `TS-${l.leadNumber.toString().padStart(6,'0')}` : l.id.slice(-8).toUpperCase()}</span></td>
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                        <Link href={`/dashboard/clinic/leads/${l.id}`} className="text-blue-600 hover:text-blue-800">{l.applicantName}</Link>
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
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{l.approvedAmount ? formatLakhs(l.approvedAmount) : '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{l.disbursedAmount ? formatLakhs(l.disbursedAmount) : '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-600 whitespace-nowrap">{l.utrNumber ?? '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{formatDate(l.applicationDate)}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{l.approvalDate ? formatDate(l.approvalDate) : '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{l.disbursalDate ? formatDate(l.disbursalDate) : '—'}</td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{calcFirstEmi(l.disbursalDate, l.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leads.length === 0 && <p className="text-center text-sm text-gray-400 py-8">No leads found</p>}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-500">Page {page} of {totalPages} ({total} total)</p>
            <div className="flex gap-2">
              <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Prev</button>
              <button type="button" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
