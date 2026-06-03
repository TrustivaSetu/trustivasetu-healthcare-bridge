'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDate, formatLakhs, cn } from '@/lib/utils'

const STATUSES = ['', 'PENDING', 'APPROVED', 'DISBURSED', 'REJECTED', 'CANCELLED']

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  DISBURSED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

interface Lead {
  id: string
  applicantName: string
  phone: string | null
  amount: number
  status: string
  applicationDate: string
  disbursedAmount: number | null
  lender: { name: string } | null
}

export default function ClinicLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (status) params.set('status', status)
    if (search) params.set('search', search)
    fetch(`/api/clinic/leads?${params}`)
      .then(r => r.json())
      .then(d => { setLeads(d.data ?? []); setTotal(d.total ?? 0); setLoading(false) })
      .catch(() => setLoading(false))
  }, [status, search, page])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-gray-900">My Leads</h1>
        <p className="text-sm text-gray-500">{total} total leads</p>
      </div>

      <div className="flex-1 p-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="search"
            placeholder="Search by name..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-lime"
          />
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-lime"
          >
            {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Patient Name', 'Phone', 'Amount', 'Status', 'Lender', 'Applied On'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leads.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/clinic/leads/${l.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                          {l.applicantName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{l.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatLakhs(l.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_BADGE[l.status] ?? 'bg-gray-100 text-gray-700')}>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{l.lender?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(l.applicationDate)}</td>
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
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
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
