'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

type ReportType = 'clinics' | 'leads' | 'lenders' | 'schemes' | 'disbursals'

interface ReportConfig {
  id: ReportType
  title: string
  description: string
  icon: string
  color: string
  fields: string[]
}

const REPORTS: ReportConfig[] = [
  {
    id: 'clinics',
    title: 'Channel Partner Master Report',
    description: 'Complete details for all channel partners — basic info, banking, GST, PAN, schemes',
    icon: '🏥',
    color: 'blue',
    fields: [
      'Channel Partner Code (TSC-XXXXXX)',
      'Channel Partner Name',
      'Channel Partner Type',
      'Region',
      'Assigned RM',
      'Contact Person & Number',
      'Email',
      'Address & Pincode',
      'GST Number',
      'PAN Number',
      'Account Number',
      'IFSC Code',
      'Bank Name',
      'Business Potential (L)',
      'Agreement URL',
      'Onboarded Date',
      'Total Leads',
      'MTD Leads',
      'Total Disbursals',
    ],
  },
  {
    id: 'schemes',
    title: 'Channel Partner Schemes Report',
    description: 'Agreed schemes for each channel partner — subvention %, processing fee %, GST details',
    icon: '📋',
    color: 'purple',
    fields: [
      'Channel Partner Code',
      'Channel Partner Name',
      'Scheme (Tenure/Advance)',
      'Tenure (months)',
      'Advance EMI',
      'Balance EMI',
      'Hospital Subvention %',
      'GST on Subvention',
      'Total Subvention %',
      'Processing Fee %',
      'GST on PF',
      'PF GST Type',
      'Agreed Date',
    ],
  },
  {
    id: 'leads',
    title: 'Leads Report',
    description: 'Complete lead details — patient info, treatment, lender, status, amounts',
    icon: '📊',
    color: 'green',
    fields: [
      'Lead ID',
      'Patient Name',
      'Phone',
      'Email',
      'Channel Partner',
      'Treatment Category',
      'Treatment Name',
      'Loan Amount',
      'Approved Amount',
      'Disbursed Amount',
      'Status',
      'Lender',
      'Application Date',
      'Approval Date',
      'Disbursal Date',
      'RM Name',
      'Region',
    ],
  },
  {
    id: 'disbursals',
    title: 'Disbursal Report',
    description: 'Disbursed leads only — amount, lender, and clinic summary',
    icon: '💰',
    color: 'orange',
    fields: [
      'Lead ID',
      'Patient Name',
      'Channel Partner',
      'Lender',
      'Disbursed Amount',
      'Disbursement Date',
      'Disbursement Time',
      'DO Generated Date',
      'DO Generated Time',
      'EMI Amount',
      'Tenure',
      'Processing Fee',
      'Scheme',
      'Region',
      'RM Name',
    ],
  },
  {
    id: 'lenders',
    title: 'Lender Report',
    description: 'Complete lender details — API config, webhook URLs, lead stats',
    icon: '🏦',
    color: 'teal',
    fields: [
      'Lender Name',
      'Lender Code',
      'Status',
      'API Configured',
      'Webhook URL (Status)',
      'Webhook URL (Disbursal)',
      'Total Leads',
      'Approved Leads',
      'Disbursed Amount',
    ],
  },
]

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'Last 3 Months', value: 'last_3_months' },
  { label: 'Last 6 Months', value: 'last_6_months' },
  { label: 'This Year', value: 'year' },
  { label: 'All Time', value: 'all' },
  { label: 'Custom Range', value: 'custom' },
]

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null)
  const [datePreset, setDatePreset] = useState('month')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')

  const report = REPORTS.find(r => r.id === selectedReport)

  const colorMap: Record<string, string> = {
    blue: 'border-blue-400 bg-blue-50',
    purple: 'border-purple-400 bg-purple-50',
    green: 'border-green-400 bg-green-50',
    orange: 'border-orange-400 bg-orange-50',
    teal: 'border-teal-400 bg-teal-50',
  }

  const btnMap: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    green: 'bg-green-600 hover:bg-green-700',
    orange: 'bg-orange-600 hover:bg-orange-700',
    teal: 'bg-teal-600 hover:bg-teal-700',
  }

  const textMap: Record<string, string> = {
    blue: 'text-blue-700',
    purple: 'text-purple-700',
    green: 'text-green-700',
    orange: 'text-orange-700',
    teal: 'text-teal-700',
  }

  async function downloadReport() {
    if (!selectedReport) { toast.error('Please select a report type'); return }
    setDownloading(true)
    try {
      const params = new URLSearchParams({
        type: selectedReport,
        datePreset,
        format,
      })
      if (datePreset === 'custom') {
        if (!fromDate || !toDate) { toast.error('Please select a date range'); setDownloading(false); return }
        params.set('from', fromDate)
        params.set('to', toDate)
      }

      const res = await fetch(`/api/reports/download?${params}`)
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Download failed') }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = format === 'xlsx' ? 'xlsx' : 'csv'
      a.download = `trustiva-${selectedReport}-${new Date().toISOString().split('T')[0]}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded! ✅')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-800">Reports & Downloads</h1>
          <p className="text-sm text-gray-500 mt-1">
            Select a report and download it as Excel or CSV
          </p>
        </div>

        {/* Report Type Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORTS.map(r => (
            <div
              key={r.id}
              onClick={() => setSelectedReport(r.id)}
              className={`border-2 rounded-2xl p-4 cursor-pointer transition-all ${
                selectedReport === r.id
                  ? `${colorMap[r.color]} shadow-md`
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="text-3xl">{r.icon}</span>
                {selectedReport === r.id && (
                  <span className="text-green-500 text-lg">✅</span>
                )}
              </div>
              <p className={`font-bold mt-2 text-sm ${selectedReport === r.id ? textMap[r.color] : 'text-gray-800'}`}>
                {r.title}
              </p>
              <p className="text-xs text-gray-500 mt-1">{r.description}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {r.fields.slice(0, 4).map(f => (
                  <span key={f} className="text-xs bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                    {f}
                  </span>
                ))}
                {r.fields.length > 4 && (
                  <span className="text-xs text-gray-400">+{r.fields.length - 4} more</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Selected Report Config */}
        {selectedReport && report && (
          <div className={`border-2 rounded-2xl p-5 space-y-5 ${colorMap[report.color]}`}>
            <div>
              <p className={`text-base font-bold ${textMap[report.color]}`}>
                {report.icon} {report.title}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {report.fields.length} columns included
              </p>
            </div>

            {/* All Fields Preview */}
            <div className="bg-white rounded-xl p-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">Columns included in this report:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                {report.fields.map((f, i) => (
                  <div key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="text-green-500 font-bold">{i + 1}.</span>
                    {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Date Range */}
            {selectedReport !== 'clinics' && selectedReport !== 'lenders' && selectedReport !== 'schemes' && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-700">Select Date Range</p>
                <div className="flex flex-wrap gap-2">
                  {DATE_PRESETS.map(d => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setDatePreset(d.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        datePreset === d.value
                          ? 'border-gray-800 bg-gray-800 text-white'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {datePreset === 'custom' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                      <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                      <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Format */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Download Format</p>
              <div className="flex gap-3">
                {(['xlsx', 'csv'] as const).map(f => (
                  <button key={f} type="button" onClick={() => setFormat(f)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      format === f
                        ? 'border-gray-800 bg-gray-800 text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                    }`}>
                    {f === 'xlsx' ? '📊 Excel (.xlsx)' : '📄 CSV (.csv)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Download Button */}
            <button
              onClick={downloadReport}
              disabled={downloading}
              className={`w-full py-3 text-white font-semibold rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 ${btnMap[report.color]}`}
            >
              {downloading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Generating Report...
                </>
              ) : (
                <>
                  ⬇ Download {report.title}
                </>
              )}
            </button>
          </div>
        )}

        {!selectedReport && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-sm font-medium text-gray-600">Select a report type above</p>
            <p className="text-xs text-gray-400 mt-1">Then choose a date range and format to download</p>
          </div>
        )}
      </div>
    </div>
  )
}
