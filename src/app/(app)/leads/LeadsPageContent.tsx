'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTabSession } from '@/contexts/TabSessionContext'

import { LeadTable } from '@/components/leads/LeadTable'
import { LeadForm } from '@/components/leads/LeadForm'
import { LeadReportTable, exportLeadReport, type ReportLead } from '@/components/leads/LeadReportTable'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const STATUSES = ['', 'PENDING', 'APPROVED', 'DISBURSED', 'REJECTED', 'CANCELLED']

interface StatusModalState {
  lead: { id: string; applicantName: string; amount: number; approvedAmount: number | null }
  newStatus: 'APPROVED' | 'DISBURSED' | 'REJECTED' | 'CANCELLED'
}

export function LeadsPageContent() {
  const searchParams = useSearchParams()
  const { user: session } = useTabSession()
  const [leads, setLeads] = useState<unknown[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(searchParams.get('status') ?? '')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editLead, setEditLead] = useState<unknown>(null)
  const [viewMode, setViewMode] = useState<'table' | 'report'>('table')
  const [sortBy, setSortBy] = useState('applicationDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [statusModal, setStatusModal] = useState<StatusModalState | null>(null)
  const [lenderId, setLenderId] = useState('')
  const [regionId, setRegionId] = useState('')
  const [lenders, setLenders] = useState<{ id: string; name: string }[]>([])
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([])

  const role = session?.role ?? ''
  const canCreate = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'].includes(role)
  const canEdit = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER'].includes(role)
  const canDelete = ['SUPER_ADMIN', 'ADMIN'].includes(role)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (search) p.set('search', search)
      if (status) p.set('status', status)
      if (dateFrom) p.set('dateFrom', dateFrom)
      if (dateTo) p.set('dateTo', dateTo)
      if (lenderId) p.set('lenderId', lenderId)
      if (regionId) p.set('regionId', regionId)
      const res = await fetch(`/api/leads?${p}`)
      if (!res.ok) throw new Error('Failed to load leads')
      const data = await res.json()
      setLeads(data.data ?? [])
      setTotal(data.total ?? 0)
    } catch {
      toast.error('Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [page, search, status, dateFrom, dateTo, lenderId, regionId])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  useEffect(() => {
    fetch('/api/lenders').then(r => r.json()).then(d => setLenders(d.data ?? []))
    fetch('/api/regions').then(r => r.json()).then(d => setRegions(d.data ?? []))
  }, [])

  function handleStatusUpdate(lead: { id: string; applicantName: string; amount: number; approvedAmount: number | null }, newStatus: string) {
    setStatusModal({ lead, newStatus: newStatus as StatusModalState['newStatus'] })
  }

  async function confirmStatusUpdate(fields: Record<string, unknown>) {
    if (!statusModal) return
    const res = await fetch(`/api/leads/${statusModal.lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: statusModal.newStatus, ...fields }),
    })
    if (res.ok) {
      toast.success(`Lead ${statusModal.newStatus.toLowerCase()}`)
      setStatusModal(null)
      fetchLeads()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Update failed')
    }
  }

  async function handleDelete(lead: { id: string; applicantName: string }) {
    if (!confirm(`Delete lead for "${lead.applicantName}"? This cannot be undone.`)) return
    const res = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Lead deleted')
      fetchLeads()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to delete lead')
    }
  }

  async function handleExport() {
    const p = new URLSearchParams({ type: 'leads' })
    if (status) p.set('status', status)
    if (dateFrom) p.set('dateFrom', dateFrom)
    if (dateTo) p.set('dateTo', dateTo)
    const res = await fetch(`/api/export?${p}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `leads-${new Date().toISOString().split('T')[0]}.xlsx`
    a.click(); URL.revokeObjectURL(url)
  }

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortOrder('asc')
    }
  }

  function handleReportExport() {
    exportLeadReport(leads as ReportLead[])
  }

  function sortedLeads(): ReportLead[] {
    const arr = [...(leads as ReportLead[])]
    arr.sort((a, b) => {
      let av: string | number = ''
      let bv: string | number = ''
      switch (sortBy) {
        case 'applicantName': av = a.applicantName; bv = b.applicantName; break
        case 'applicationDate': av = a.applicationDate; bv = b.applicationDate; break
        case 'status': av = a.status; bv = b.status; break
        case 'amount': av = a.amount; bv = b.amount; break
        default: av = a.applicationDate; bv = b.applicationDate
      }
      if (av < bv) return sortOrder === 'asc' ? -1 : 1
      if (av > bv) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }

  const pageCount = Math.ceil(total / 20)

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-6 space-y-4">
        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${viewMode === 'table' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Table View
          </button>
          <button
            onClick={() => setViewMode('report')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition ${viewMode === 'report' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Detailed Report
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Search</label>
              <input type="text" placeholder="Applicant name..." value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 w-48" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Status</label>
              <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            {regions.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Region</label>
                <select value={regionId} onChange={e => { setRegionId(e.target.value); setPage(1) }}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                  <option value="">All Regions</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}
            {lenders.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Lender</label>
                <select value={lenderId} onChange={e => { setLenderId(e.target.value); setPage(1) }}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                  <option value="">All Lenders</option>
                  {lenders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            )}
            {canCreate && viewMode === 'table' && (
              <button onClick={() => { setEditLead(null); setShowForm(true) }}
                className="ml-auto px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Lead
              </button>
            )}
            {viewMode === 'report' ? (
              <button onClick={handleReportExport}
                className="ml-auto px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Report
              </button>
            ) : (
              <button onClick={handleExport}
                className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-semibold text-gray-800">{editLead ? 'Edit Lead' : 'Add New Lead'}</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <LeadForm
                initial={editLead as Parameters<typeof LeadForm>[0]['initial']}
                onSuccess={() => { setShowForm(false); fetchLeads() }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
          </div>
        ) : viewMode === 'report' ? (
          <LeadReportTable
            leads={sortedLeads()}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
        ) : (
          <LeadTable
            leads={leads as Parameters<typeof LeadTable>[0]['leads']}
            onEdit={canEdit ? (l) => { setEditLead(l); setShowForm(true) } : undefined}
            onStatusUpdate={canEdit ? (handleStatusUpdate as unknown as Parameters<typeof LeadTable>[0]['onStatusUpdate']) : undefined}
            onDelete={canDelete ? (handleDelete as unknown as Parameters<typeof LeadTable>[0]['onDelete']) : undefined}
            canEdit={!!canEdit}
            canDelete={!!canDelete}
          />
        )}

        {pageCount > 1 && (
          <div className="flex justify-center items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
            <span className="text-sm text-gray-600">Page {page} of {pageCount} ({total} total)</span>
            <button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
          </div>
        )}
      </div>

      {statusModal && (
        <StatusUpdateModal
          lead={statusModal.lead}
          newStatus={statusModal.newStatus}
          onConfirm={confirmStatusUpdate}
          onCancel={() => setStatusModal(null)}
        />
      )}
    </div>
  )
}

function StatusUpdateModal({ lead, newStatus, onConfirm, onCancel }: {
  lead: StatusModalState['lead']
  newStatus: StatusModalState['newStatus']
  onConfirm: (fields: Record<string, unknown>) => Promise<void>
  onCancel: () => void
}) {
  const [amount, setAmount] = useState(
    newStatus === 'APPROVED' ? String(lead.approvedAmount ?? lead.amount) :
    newStatus === 'DISBURSED' ? String(lead.approvedAmount ?? lead.amount) : ''
  )
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)

  const needsAmount = newStatus === 'APPROVED' || newStatus === 'DISBURSED'
  const label = newStatus === 'APPROVED' ? 'Approved Amount' : newStatus === 'DISBURSED' ? 'Disbursed Amount' : ''
  const dateLabel = newStatus === 'APPROVED' ? 'Approval Date' : newStatus === 'DISBURSED' ? 'Disbursal Date' : 'Date'

  const STATUS_COLORS: Record<string, string> = {
    APPROVED: 'text-blue-700 bg-blue-50 border-blue-200',
    DISBURSED: 'text-green-700 bg-green-50 border-green-200',
    REJECTED: 'text-red-700 bg-red-50 border-red-200',
    CANCELLED: 'text-gray-700 bg-gray-50 border-gray-200',
  }

  async function handleSubmit() {
    if (needsAmount && (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) {
      return
    }
    setSaving(true)
    const fields: Record<string, unknown> = { remarks: remarks || undefined }
    if (newStatus === 'APPROVED') {
      fields.approvedAmount = parseFloat(amount)
      fields.approvalDate = date
    } else if (newStatus === 'DISBURSED') {
      fields.disbursedAmount = parseFloat(amount)
      fields.disbursalDate = date
    }
    await onConfirm(fields)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">Update Lead Status</h3>
          <p className="text-sm text-gray-500 mt-0.5">{lead.applicantName}</p>
        </div>

        <div className={`px-3 py-2 rounded-lg border text-sm font-semibold ${STATUS_COLORS[newStatus] ?? 'bg-gray-50'}`}>
          → {newStatus}
        </div>

        {needsAmount && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label} (₹) *</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Enter actual amount from lender"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <p className="text-xs text-gray-400 mt-1">Requested: ₹{lead.amount.toLocaleString('en-IN')}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{dateLabel}</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (optional)</label>
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            rows={2}
            placeholder="Any notes..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving || (needsAmount && !amount)}
            className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Saving...' : `Confirm ${newStatus}`}
          </button>
        </div>
      </div>
    </div>
  )
}
