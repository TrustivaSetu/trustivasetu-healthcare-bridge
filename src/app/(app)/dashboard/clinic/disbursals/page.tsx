'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { formatDate, formatLakhs } from '@/lib/utils'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

interface Disbursal {
  id: string
  applicantName: string
  disbursedAmount: number | null
  utrNumber: string | null
  disbursalDate: string | null
  applicationDate: string
  lender: { id: string; name: string } | null
}

export default function ClinicDisbursalsPage() {
  const [disbursals, setDisbursals] = useState<Disbursal[]>([])
  const [total, setTotal] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 20

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    fetch(`/api/clinic/disbursals?${params}`)
      .then(r => r.json())
      .then(d => {
        setDisbursals(d.data ?? [])
        setTotal(d.total ?? 0)
        setTotalAmount(d.totalAmount ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(load, [page])

  async function exportToExcel() {
    try {
      const all: Disbursal[] = []
      let p = 1
      while (true) {
        const params = new URLSearchParams({ page: String(p), pageSize: '100' })
        const res = await fetch(`/api/clinic/disbursals?${params}`)
        const d = await res.json()
        all.push(...(d.data ?? []))
        if (all.length >= d.total) break
        p++
      }

      const rows = all.map(d => ({
        'Patient Name': d.applicantName,
        'Amount': d.disbursedAmount ?? 0,
        'UTR Number': d.utrNumber ?? '',
        'Lender': d.lender?.name ?? '',
        'Disbursal Date': d.disbursalDate ? formatDate(d.disbursalDate) : '',
      }))

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Disbursals')
      XLSX.writeFile(wb, `disbursals-${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success('Exported successfully')
    } catch {
      toast.error('Export failed')
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Disbursals" subtitle={`${total} disbursed loans`} />

      <div className="flex-1 p-6 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium">Total Disbursals</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{total}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 font-medium">Total Amount</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{formatLakhs(totalAmount)}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={exportToExcel}
            className="flex items-center gap-1.5 text-xs bg-trustiva-navy text-trustiva-lime font-semibold px-3 py-2 rounded-lg hover:bg-gray-800 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export to Excel
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Patient Name', 'Amount', 'UTR Number', 'Lender', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {disbursals.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{d.applicantName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{d.disbursedAmount ? formatLakhs(d.disbursedAmount) : '—'}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{d.utrNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{d.lender?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{d.disbursalDate ? formatDate(d.disbursalDate) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {disbursals.length === 0 && <p className="text-center text-sm text-gray-400 py-8">No disbursals yet</p>}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
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
