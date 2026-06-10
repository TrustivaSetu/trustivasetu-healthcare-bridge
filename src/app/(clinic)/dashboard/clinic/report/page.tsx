'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function ClinicReportPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/clinic/leads/export?month=${month}&year=${year}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? 'Failed to generate report')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `leads-report-${MONTHS[month - 1]}-${year}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-bold text-gray-900">Download Report</h1>
        <p className="text-sm text-gray-500">Excel export of your leads for a selected month</p>
      </div>

      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-sm font-semibold text-gray-800">Monthly Lead Report</h2>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Download a detailed Excel report with 30 columns including patient details, loan amounts, lender info, UTR, EMI dates and more.
          </p>

          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-gray-600 w-12">Month</label>
              <select
                value={month}
                onChange={e => setMonth(Number(e.target.value))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-navy"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-gray-600 w-12">Year</label>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-trustiva-navy"
              >
                {[now.getFullYear() - 1, now.getFullYear()].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="w-full flex items-center justify-center gap-2 bg-[#07111f] text-[#bef264] font-semibold text-sm px-4 py-3 rounded-lg hover:bg-gray-800 transition disabled:opacity-60"
          >
            {downloading ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-trustiva-lime border-t-transparent" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {downloading ? 'Generating...' : `Download ${MONTHS[month - 1]} ${year} Report`}
          </button>
        </div>
      </div>
    </div>
  )
}
