'use client'

import { useEffect, useState } from 'react'
import { formatDate, formatLakhs } from '@/lib/utils'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

interface Disbursal {
  id: string
  applicantName: string
  phone: string | null
  amount: number
  approvedAmount: number | null
  disbursedAmount: number | null
  disbursalDate: string | null
  utrNumber: string | null
  lender: { name: string } | null
}

export default function ClinicDisbursalsPage() {
  const [disbursals, setDisbursals] = useState<Disbursal[]>([])
  const [total, setTotal] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    setLoading(true)
    fetch(`/api/clinic/disbursals?page=${page}&pageSize=${pageSize}`)
      .then(r => r.json())
      .then(d => {
        setDisbursals(d.data ?? [])
        setTotal(d.total ?? 0)
        setTotalAmount(d.totalAmount ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [page])

  function exportExcel() {
    const rows = disbursals.map(d => ({
      'Patient Name': d.applicantName,
      'Phone': d.phone ?? '',
      'Applied Amount': d.amount,
      'Approved Amount': d.approvedAmount ?? '',
      'Disbursed Amount': d.disbursedAmount ?? '',
      'UTR Number': d.utrNumber ?? '',
      'Lender': d.lender?.name ?? '',
      'Disbursal Date': d.disbursalDate ? formatDate(d.disbursalDate) : '',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Disbursals')
    XLSX.writeFile(wb, 'disbursals.xlsx')
    toast.success('Excel exported')
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Disbursals</h1>
          <p className="text-sm text-gray-500">{total} disbursals · Total: {formatLakhs(totalAmount)}</p>
        </div>
        <button
          type="button"
          onClick={exportExcel}
          className="flex items-center gap-2 bg-[#07111f] text-[#bef264] font-semibold text-xs px-4 py-2.5 rounded-lg hover:bg-gray-800 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Excel
        </button>
      </div>

      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['Patient Name', 'Applied', 'Approved', 'Disbursed', 'UTR Number', 'Lender', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {disbursals.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{d.applicantName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatLakhs(d.amount)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{d.approvedAmount != null ? formatLakhs(d.approvedAmount) : '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-700">{d.disbursedAmount != null ? formatLakhs(d.disbursedAmount) : '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-mono">{d.utrNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{d.lender?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{d.disbursalDate ? formatDate(d.disbursalDate) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {disbursals.length === 0 && <p className="text-center text-sm text-gray-400 py-8">No disbursals found</p>}
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
