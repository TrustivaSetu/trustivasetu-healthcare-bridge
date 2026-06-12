'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTabSession } from '@/contexts/TabSessionContext'

import { LeadTable } from '@/components/leads/LeadTable'
import { LeadForm } from '@/components/leads/LeadForm'
import { LeadReportTable, exportLeadReport, type ReportLead } from '@/components/leads/LeadReportTable'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const STATUSES = [
  '', 'PENDING', 'DOCS_PENDING', 'KYC_PENDING', 'KYC_APPROVED',
  'MARKUP_PENDING', 'PROCESSING', 'APPROVED', 'DISBURSED', 'REJECTED', 'CANCELLED',
]

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  DOCS_PENDING: 'Docs Pending',
  KYC_PENDING: 'KYC Pending',
  KYC_APPROVED: 'KYC Approved',
  MARKUP_PENDING: 'Markup Pending',
  PROCESSING: 'Processing',
  APPROVED: 'Approved',
  DISBURSED: 'Disbursed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
}

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
  const [deleteConfirmLead, setDeleteConfirmLead] = useState<{ id: string; applicantName: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [lenderId, setLenderId] = useState('')
  const [regionId, setRegionId] = useState('')
  const [clinicId, setClinicId] = useState('')
  const [rmId, setRmId] = useState('')
  const [leadIdSearch, setLeadIdSearch] = useState('')
  const [lenders, setLenders] = useState<{ id: string; name: string }[]>([])
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([])
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([])
  const [rms, setRms] = useState<{ id: string; name: string }[]>([])

  const role = session?.role ?? ''
  const canCreate = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'].includes(role)
  const canEdit = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'].includes(role)
  const canDelete = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'].includes(role)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ page: String(page), pageSize: '20' })
      if (search) p.set('search', search)
      if (leadIdSearch) p.set('leadId', leadIdSearch)
      if (status) p.set('status', status)
      if (dateFrom) p.set('dateFrom', dateFrom)
      if (dateTo) p.set('dateTo', dateTo)
      if (lenderId) p.set('lenderId', lenderId)
      if (regionId) p.set('regionId', regionId)
      if (clinicId) p.set('clinicId', clinicId)
      if (rmId) p.set('rmId', rmId)
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
  }, [page, search, leadIdSearch, status, dateFrom, dateTo, lenderId, regionId, clinicId, rmId])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  useEffect(() => {
    fetch('/api/lenders').then(r => r.json()).then(d => setLenders(d.data ?? []))
    fetch('/api/regions').then(r => r.json()).then(d => setRegions(d.data ?? []))
    fetch('/api/clinics?minimal=1&pageSize=200').then(r => r.json()).then(d => setClinics(d.data ?? []))
    Promise.all([
      fetch('/api/users?role=TEAM_MEMBER&minimal=1').then(r => r.json()),
      fetch('/api/users?role=REGIONAL_MANAGER&minimal=1').then(r => r.json()),
    ]).then(([tm, rm]) => {
      const combined = [...(tm.data ?? []), ...(rm.data ?? [])].sort((a, b) => a.name.localeCompare(b.name))
      setRms(combined)
    })
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

  function handleDelete(lead: { id: string; applicantName: string }) {
    setDeleteConfirmLead(lead)
  }

  async function confirmDelete() {
    if (!deleteConfirmLead) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/leads/${deleteConfirmLead.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Lead deleted successfully')
        setDeleteConfirmLead(null)
        fetchLeads()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleExport() {
    const p = new URLSearchParams({ type: 'leads' })
    if (status) p.set('status', status)
    if (dateFrom) p.set('dateFrom', dateFrom)
    if (dateTo) p.set('dateTo', dateTo)
    if (lenderId) p.set('lenderId', lenderId)
    if (regionId) p.set('regionId', regionId)
    if (clinicId) p.set('clinicId', clinicId)
    if (search) p.set('search', search)
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
              <label className="text-xs font-medium text-gray-600">Lead ID</label>
              <input type="text" placeholder="e.g. ABC12345" value={leadIdSearch}
                onChange={e => { setLeadIdSearch(e.target.value.toUpperCase()); setPage(1) }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 w-28 font-mono" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Patient Name</label>
              <input type="text" placeholder="Patient name..." value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Status</label>
              <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
                {STATUSES.map(s => <option key={s} value={s}>{s ? (STATUS_LABELS[s] ?? s) : 'All Statuses'}</option>)}
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
            {clinics.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Clinic</label>
                <select value={clinicId} onChange={e => { setClinicId(e.target.value); setPage(1) }}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white w-40">
                  <option value="">All Clinics</option>
                  {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
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
            {rms.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">RM</label>
                <select value={rmId} onChange={e => { setRmId(e.target.value); setPage(1) }}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white w-36">
                  <option value="">All RMs</option>
                  {rms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
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

      {deleteConfirmLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Delete Lead</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Are you sure you want to delete <span className="font-medium text-gray-700">{deleteConfirmLead.applicantName}</span>?
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setDeleteConfirmLead(null)} disabled={deleting}
                className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-60">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-60">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
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
