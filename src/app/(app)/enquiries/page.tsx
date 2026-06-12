'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import { formatDate, cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PatientEnquiry {
  id: string
  source: string
  applicantName: string | null
  mobile: string | null
  email: string | null
  hospitalName: string | null
  clinicId: string | null
  treatmentName: string | null
  loanAmount: number | null
  panNumber: string | null
  panVerified: boolean
  aadharNumber: string | null
  employmentType: string | null
  monthlyIncome: number | null
  companyName: string | null
  currentHouseNo: string | null
  currentStreet: string | null
  currentLandmark: string | null
  currentPinCode: string | null
  currentCity: string | null
  currentState: string | null
  permanentSameAsCurrent: boolean
  permanentPinCode: string | null
  permanentCity: string | null
  permanentState: string | null
  assignedRegion: string | null
  assignedRmId: string | null
  assignedRmName: string | null
  assignedManagerId: string | null
  status: string
  convertedLeadId: string | null
  notes: string | null
  createdAt: string
}

interface ProviderEnquiry {
  id: string
  source: string
  clinicName: string | null
  contactPerson: string | null
  mobile: string | null
  email: string | null
  address: string | null
  pinCode: string | null
  city: string | null
  state: string | null
  region: string | null
  treatmentTypes: string | null
  ifscCode: string | null
  bankName: string | null
  branchName: string | null
  accountNumber: string | null
  assignedRegion: string | null
  assignedRmId: string | null
  assignedRmName: string | null
  assignedManagerId: string | null
  status: string
  convertedClinicId: string | null
  notes: string | null
  createdAt: string
}

interface RmUser {
  id: string
  name: string
  email: string
  regionName: string | null
  managerId: string | null
  managerName: string | null
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  CONVERTED: 'bg-green-100 text-green-800',
  DROPPED: 'bg-gray-100 text-gray-500',
}

function StatusBadge({ status, unassigned }: { status: string; unassigned?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700')}>
        {status.replace('_', ' ')}
      </span>
      {unassigned && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
          UNASSIGNED
        </span>
      )}
    </span>
  )
}

// ── Modal / Drawer primitives ──────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="bg-white w-full max-w-lg h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ── Field components ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

// ── PatientTab ─────────────────────────────────────────────────────────────────

function PatientTab({ userRole: _userRole }: { userRole: string }) {
  const [enquiries, setEnquiries] = useState<PatientEnquiry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showConverted, setShowConverted] = useState(false)

  const [assignModal, setAssignModal] = useState<PatientEnquiry | null>(null)
  const [editDrawer, setEditDrawer] = useState<PatientEnquiry | null>(null)
  const [convertDialog, setConvertDialog] = useState<PatientEnquiry | null>(null)
  const [dropTarget, setDropTarget] = useState<PatientEnquiry | null>(null)

  const pageSize = 20

  const fetchEnquiries = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (sourceFilter) params.set('source', sourceFilter)
      if (regionFilter) params.set('region', regionFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (showConverted) params.set('showConverted', '1')
      params.set('page', String(pg))
      params.set('pageSize', String(pageSize))
      const res = await fetch(`/api/enquiries/patient?${params}`)
      const json = await res.json()
      setEnquiries(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch {
      toast.error('Failed to load patient enquiries')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, sourceFilter, regionFilter, dateFrom, dateTo, showConverted])

  useEffect(() => {
    setPage(1)
    fetchEnquiries(1)
  }, [fetchEnquiries])

  const totalPages = Math.ceil(total / pageSize)

  async function handleExport() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '9999' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (sourceFilter) params.set('source', sourceFilter)
      if (regionFilter) params.set('region', regionFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (showConverted) params.set('showConverted', '1')
      const res = await fetch(`/api/enquiries/patient?${params}`)
      const json = await res.json()
      const rows = (json.data ?? []).map((e: PatientEnquiry) => ({
        'Name': e.applicantName ?? '',
        'Mobile': e.mobile ?? '',
        'Email': e.email ?? '',
        'Hospital': e.hospitalName ?? '',
        'Treatment': e.treatmentName ?? '',
        'Loan Amount': e.loanAmount ?? '',
        'PAN': e.panNumber ?? '',
        'Employment': e.employmentType ?? '',
        'Monthly Income': e.monthlyIncome ?? '',
        'Region': e.assignedRegion ?? '',
        'Assigned RM': e.assignedRmName ?? '',
        'Source': e.source,
        'Status': e.status,
        'Converted Lead ID': e.convertedLeadId ? e.convertedLeadId.slice(-8).toUpperCase() : '',
        'Created At': formatDate(e.createdAt),
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = Object.keys(rows[0] ?? {}).map(() => ({ wch: 20 }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Patient Enquiries')
      XLSX.writeFile(wb, `patient-enquiries-${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success(`Exported ${rows.length} records`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search name / mobile..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="NEW">New</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="CONVERTED">Converted</option>
          <option value="DROPPED">Dropped</option>
        </select>
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Sources</option>
          <option value="WEBSITE_FORM">Website Form</option>
          <option value="INCOMPLETE_LEAD">Incomplete Lead</option>
        </select>
        <input
          type="text"
          placeholder="Region..."
          value={regionFilter}
          onChange={e => setRegionFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showConverted}
            onChange={e => setShowConverted(e.target.checked)}
            className="rounded"
          />
          Show converted
        </label>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="ml-auto px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-60 transition flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {exporting ? 'Exporting...' : 'Download'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              {['#', 'Name', 'Mobile', 'Email', 'Hospital', 'Treatment', 'Amount', 'Source', 'Assigned RM', 'Region', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-gray-400">Loading...</td>
              </tr>
            ) : enquiries.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-gray-400">No enquiries found</td>
              </tr>
            ) : (
              enquiries.map((enq, i) => (
                <tr key={enq.id} className="hover:bg-gray-50 transition">
                  <td className="px-3 py-2.5 text-gray-400 text-xs">{(page - 1) * pageSize + i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[140px] truncate">{enq.applicantName ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{enq.mobile ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[160px] truncate">{enq.email ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[140px] truncate">{enq.hospitalName ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[120px] truncate">{enq.treatmentName ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                    {enq.loanAmount ? `₹${enq.loanAmount.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {enq.source.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[120px] truncate">{enq.assignedRmName ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[100px] truncate">{enq.assignedRegion ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge
                      status={enq.status}
                      unassigned={!enq.assignedRmId && enq.status === 'NEW'}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{formatDate(enq.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditDrawer(enq)}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setAssignModal(enq)}
                        className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition"
                      >
                        Assign
                      </button>
                      {enq.status !== 'CONVERTED' && enq.status !== 'DROPPED' && (
                        <>
                          <button
                            onClick={() => setConvertDialog(enq)}
                            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition"
                          >
                            Convert
                          </button>
                          <button
                            onClick={() => setDropTarget(enq)}
                            className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 transition"
                          >
                            Drop
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>{total} total</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPage(p => p - 1); fetchEnquiries(page - 1) }}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition"
            >
              Prev
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => { setPage(p => p + 1); fetchEnquiries(page + 1) }}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {assignModal && (
        <PatientAssignModal
          enquiry={assignModal}
          onClose={() => setAssignModal(null)}
          onDone={() => { setAssignModal(null); fetchEnquiries(page) }}
        />
      )}
      {editDrawer && (
        <PatientEditDrawer
          enquiry={editDrawer}
          onClose={() => setEditDrawer(null)}
          onDone={() => { setEditDrawer(null); fetchEnquiries(page) }}
        />
      )}
      {convertDialog && (
        <PatientConvertDialog
          enquiry={convertDialog}
          onClose={() => setConvertDialog(null)}
          onDone={() => { setConvertDialog(null); fetchEnquiries(page) }}
        />
      )}
      {dropTarget && (
        <DropConfirmDialog
          label={dropTarget.applicantName ?? 'this enquiry'}
          onClose={() => setDropTarget(null)}
          onConfirm={async () => {
            try {
              await fetch(`/api/enquiries/patient/${dropTarget.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'DROPPED' }),
              })
              toast.success('Enquiry dropped')
              setDropTarget(null)
              fetchEnquiries(page)
            } catch {
              toast.error('Failed to drop enquiry')
            }
          }}
        />
      )}
    </div>
  )
}

// ── Patient Assign Modal ───────────────────────────────────────────────────────

function PatientAssignModal({ enquiry, onClose, onDone }: { enquiry: PatientEnquiry; onClose: () => void; onDone: () => void }) {
  const [rms, setRms] = useState<RmUser[]>([])
  const [selectedRmId, setSelectedRmId] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/enquiries/users')
      .then(r => r.json())
      .then(d => setRms(d.data ?? []))
      .catch(() => {})
  }, [])

  const selectedRm = rms.find(r => r.id === selectedRmId)

  const handleAssign = async () => {
    if (!selectedRmId) return toast.error('Select an RM')
    setLoading(true)
    try {
      const res = await fetch(`/api/enquiries/patient/${enquiry.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rmId: selectedRmId }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Assigned to ${selectedRm?.name}${selectedRm?.regionName ? ` — ${selectedRm.regionName}` : ''}`)
      onDone()
    } catch {
      toast.error('Failed to assign')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Assign Enquiry" onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        Assigning: <strong>{enquiry.applicantName ?? 'Unknown'}</strong>
      </p>
      <Field label="Select RM">
        <select
          value={selectedRmId}
          onChange={e => setSelectedRmId(e.target.value)}
          className={inputCls}
        >
          <option value="">— Choose RM —</option>
          {rms.map(rm => (
            <option key={rm.id} value={rm.id}>
              {rm.name}{rm.regionName ? ` — ${rm.regionName}` : ''}
            </option>
          ))}
        </select>
      </Field>
      {selectedRm && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
          <div>
            <span className="text-gray-500 text-xs">Region: </span>
            <span className="font-medium">{selectedRm.regionName ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Manager: </span>
            <span className="font-medium">{selectedRm.managerName ?? '—'}</span>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
          Cancel
        </button>
        <button
          onClick={handleAssign}
          disabled={loading || !selectedRmId}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? 'Assigning...' : 'Assign'}
        </button>
      </div>
    </Modal>
  )
}

// ── Patient Edit Drawer ────────────────────────────────────────────────────────

function PatientEditDrawer({ enquiry, onClose, onDone }: { enquiry: PatientEnquiry; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    applicantName: enquiry.applicantName ?? '',
    mobile: enquiry.mobile ?? '',
    email: enquiry.email ?? '',
    hospitalName: enquiry.hospitalName ?? '',
    treatmentName: enquiry.treatmentName ?? '',
    loanAmount: enquiry.loanAmount?.toString() ?? '',
    panNumber: enquiry.panNumber ?? '',
    employmentType: enquiry.employmentType ?? '',
    monthlyIncome: enquiry.monthlyIncome?.toString() ?? '',
    notes: enquiry.notes ?? '',
  })
  const [loading, setLoading] = useState(false)

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/enquiries/patient/${enquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          loanAmount: form.loanAmount ? parseFloat(form.loanAmount) : null,
          monthlyIncome: form.monthlyIncome ? parseFloat(form.monthlyIncome) : null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Saved')
      onDone()
    } catch {
      toast.error('Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Drawer title="Edit Patient Enquiry" onClose={onClose}>
      <div className="text-xs text-gray-400 mb-4 space-y-0.5">
        <div>Status: <span className="font-medium text-gray-700">{enquiry.status}</span></div>
        <div>Created: <span className="font-medium text-gray-700">{formatDate(enquiry.createdAt)}</span></div>
        {enquiry.assignedRegion && <div>Region: <span className="font-medium text-gray-700">{enquiry.assignedRegion}</span></div>}
        {enquiry.assignedRmName && <div>Assigned RM: <span className="font-medium text-gray-700">{enquiry.assignedRmName}</span></div>}
      </div>
      <Field label="Applicant Name">
        <input type="text" value={form.applicantName} onChange={set('applicantName')} className={inputCls} />
      </Field>
      <Field label="Mobile">
        <input type="text" value={form.mobile} onChange={set('mobile')} className={inputCls} />
      </Field>
      <Field label="Email">
        <input type="email" value={form.email} onChange={set('email')} className={inputCls} />
      </Field>
      <Field label="Hospital Name">
        <input type="text" value={form.hospitalName} onChange={set('hospitalName')} className={inputCls} />
      </Field>
      <Field label="Treatment">
        <input type="text" value={form.treatmentName} onChange={set('treatmentName')} className={inputCls} />
      </Field>
      <Field label="Loan Amount (₹ L)">
        <input type="number" value={form.loanAmount} onChange={set('loanAmount')} className={inputCls} step="0.01" />
      </Field>
      <Field label="PAN Number">
        <input type="text" value={form.panNumber} onChange={set('panNumber')} className={inputCls} />
      </Field>
      <Field label="Employment Type">
        <select value={form.employmentType} onChange={set('employmentType')} className={inputCls}>
          <option value="">— Select —</option>
          <option value="SALARIED">Salaried</option>
          <option value="SELF_EMPLOYED">Self Employed</option>
          <option value="BUSINESS">Business</option>
          <option value="OTHER">Other</option>
        </select>
      </Field>
      <Field label="Monthly Income (₹)">
        <input type="number" value={form.monthlyIncome} onChange={set('monthlyIncome')} className={inputCls} />
      </Field>
      <Field label="Notes">
        <textarea value={form.notes} onChange={set('notes')} rows={3} className={inputCls} />
      </Field>
      <div className="flex justify-end gap-2 pt-4 border-t mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Drawer>
  )
}

// ── Patient Convert Dialog ─────────────────────────────────────────────────────

function PatientConvertDialog({ enquiry, onClose, onDone }: { enquiry: PatientEnquiry; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false)

  const missing: string[] = []
  if (!enquiry.applicantName) missing.push('Applicant Name')
  if (!enquiry.mobile) missing.push('Mobile')
  if (!enquiry.loanAmount) missing.push('Loan Amount')
  if (!enquiry.clinicId && !enquiry.hospitalName) missing.push('Clinic / Hospital')

  const handleConvert = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/enquiries/patient/${enquiry.id}/convert`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Conversion failed')
      toast.success('Converted to Lead')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Conversion failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Convert to Lead" onClose={onClose}>
      {missing.length > 0 ? (
        <div>
          <p className="text-sm text-red-600 font-medium mb-2">Cannot convert — missing required fields:</p>
          <ul className="list-disc pl-5 text-sm text-red-500 space-y-1">
            {missing.map(f => <li key={f}>{f}</li>)}
          </ul>
          <p className="text-xs text-gray-500 mt-3">Please edit the enquiry to fill in these fields first.</p>
          <div className="flex justify-end mt-5">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              Close
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-600 mb-4">Converting this patient enquiry to a lead:</p>
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1.5">
            <div><span className="text-gray-500">Patient:</span> <span className="font-medium">{enquiry.applicantName}</span></div>
            <div><span className="text-gray-500">Hospital:</span> <span className="font-medium">{enquiry.hospitalName ?? '—'}</span></div>
            <div><span className="text-gray-500">Region:</span> <span className="font-medium">{enquiry.assignedRegion ?? '—'}</span></div>
            <div><span className="text-gray-500">Assigned RM:</span> <span className="font-medium">{enquiry.assignedRmName ?? '—'}</span></div>
            <div><span className="text-gray-500">Amount:</span> <span className="font-medium">{enquiry.loanAmount ? `₹${enquiry.loanAmount.toLocaleString('en-IN')}` : '—'}</span></div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={handleConvert}
              disabled={loading}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
            >
              {loading ? 'Converting...' : 'Yes, Convert to Lead'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── ProviderTab ────────────────────────────────────────────────────────────────

function ProviderTab({ userRole: _userRole }: { userRole: string }) {
  const [enquiries, setEnquiries] = useState<ProviderEnquiry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showConverted, setShowConverted] = useState(false)

  const [assignModal, setAssignModal] = useState<ProviderEnquiry | null>(null)
  const [editDrawer, setEditDrawer] = useState<ProviderEnquiry | null>(null)
  const [convertDialog, setConvertDialog] = useState<ProviderEnquiry | null>(null)
  const [dropTarget, setDropTarget] = useState<ProviderEnquiry | null>(null)

  const pageSize = 20

  const fetchEnquiries = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (sourceFilter) params.set('source', sourceFilter)
      if (regionFilter) params.set('region', regionFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (showConverted) params.set('showConverted', '1')
      params.set('page', String(pg))
      params.set('pageSize', String(pageSize))
      const res = await fetch(`/api/enquiries/provider?${params}`)
      const json = await res.json()
      setEnquiries(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch {
      toast.error('Failed to load provider enquiries')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, sourceFilter, regionFilter, dateFrom, dateTo, showConverted])

  useEffect(() => {
    setPage(1)
    fetchEnquiries(1)
  }, [fetchEnquiries])

  const totalPages = Math.ceil(total / pageSize)

  async function handleExport() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '9999' })
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (sourceFilter) params.set('source', sourceFilter)
      if (regionFilter) params.set('region', regionFilter)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (showConverted) params.set('showConverted', '1')
      const res = await fetch(`/api/enquiries/provider?${params}`)
      const json = await res.json()
      const rows = (json.data ?? []).map((e: ProviderEnquiry) => ({
        'Clinic Name': e.clinicName ?? '',
        'Contact Person': e.contactPerson ?? '',
        'Mobile': e.mobile ?? '',
        'Email': e.email ?? '',
        'Address': e.address ?? '',
        'City': e.city ?? '',
        'State': e.state ?? '',
        'PIN Code': e.pinCode ?? '',
        'Treatment Types': e.treatmentTypes ?? '',
        'IFSC Code': e.ifscCode ?? '',
        'Bank Name': e.bankName ?? '',
        'Account Number': e.accountNumber ?? '',
        'Region': e.assignedRegion ?? e.region ?? '',
        'Assigned RM': e.assignedRmName ?? '',
        'Source': e.source,
        'Status': e.status,
        'Converted Clinic ID': e.convertedClinicId ?? '',
        'Created At': formatDate(e.createdAt),
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = Object.keys(rows[0] ?? {}).map(() => ({ wch: 20 }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Provider Enquiries')
      XLSX.writeFile(wb, `provider-enquiries-${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast.success(`Exported ${rows.length} records`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search clinic / contact..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          <option value="NEW">New</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="CONVERTED">Converted</option>
          <option value="DROPPED">Dropped</option>
        </select>
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Sources</option>
          <option value="WEBSITE_FORM">Website Form</option>
          <option value="MANUAL">Manual</option>
        </select>
        <input
          type="text"
          placeholder="Region..."
          value={regionFilter}
          onChange={e => setRegionFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showConverted}
            onChange={e => setShowConverted(e.target.checked)}
            className="rounded"
          />
          Show converted
        </label>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="ml-auto px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-60 transition flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {exporting ? 'Exporting...' : 'Download'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              {['#', 'Clinic Name', 'Contact', 'Mobile', 'Email', 'City', 'State', 'Region', 'Assigned RM', 'Source', 'Status', 'Created', 'Actions'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-gray-400">Loading...</td>
              </tr>
            ) : enquiries.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-gray-400">No enquiries found</td>
              </tr>
            ) : (
              enquiries.map((enq, i) => (
                <tr key={enq.id} className="hover:bg-gray-50 transition">
                  <td className="px-3 py-2.5 text-gray-400 text-xs">{(page - 1) * pageSize + i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[160px] truncate">{enq.clinicName ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[120px] truncate">{enq.contactPerson ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{enq.mobile ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[160px] truncate">{enq.email ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[100px] truncate">{enq.city ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[100px] truncate">{enq.state ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[100px] truncate">{enq.assignedRegion ?? enq.region ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-[120px] truncate">{enq.assignedRmName ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {enq.source.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge
                      status={enq.status}
                      unassigned={!enq.assignedRmId && enq.status === 'NEW'}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{formatDate(enq.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditDrawer(enq)}
                        className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setAssignModal(enq)}
                        className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition"
                      >
                        Assign
                      </button>
                      {enq.status !== 'CONVERTED' && enq.status !== 'DROPPED' && (
                        <>
                          <button
                            onClick={() => setConvertDialog(enq)}
                            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 transition"
                          >
                            Convert
                          </button>
                          <button
                            onClick={() => setDropTarget(enq)}
                            className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 transition"
                          >
                            Drop
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>{total} total</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPage(p => p - 1); fetchEnquiries(page - 1) }}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition"
            >
              Prev
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => { setPage(p => p + 1); fetchEnquiries(page + 1) }}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {assignModal && (
        <ProviderAssignModal
          enquiry={assignModal}
          onClose={() => setAssignModal(null)}
          onDone={() => { setAssignModal(null); fetchEnquiries(page) }}
        />
      )}
      {editDrawer && (
        <ProviderEditDrawer
          enquiry={editDrawer}
          onClose={() => setEditDrawer(null)}
          onDone={() => { setEditDrawer(null); fetchEnquiries(page) }}
        />
      )}
      {convertDialog && (
        <ProviderConvertDialog
          enquiry={convertDialog}
          onClose={() => setConvertDialog(null)}
          onDone={() => { setConvertDialog(null); fetchEnquiries(page) }}
        />
      )}
      {dropTarget && (
        <DropConfirmDialog
          label={dropTarget.clinicName ?? 'this enquiry'}
          onClose={() => setDropTarget(null)}
          onConfirm={async () => {
            try {
              await fetch(`/api/enquiries/provider/${dropTarget.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'DROPPED' }),
              })
              toast.success('Enquiry dropped')
              setDropTarget(null)
              fetchEnquiries(page)
            } catch {
              toast.error('Failed to drop enquiry')
            }
          }}
        />
      )}
    </div>
  )
}

// ── Provider Assign Modal ──────────────────────────────────────────────────────

function ProviderAssignModal({ enquiry, onClose, onDone }: { enquiry: ProviderEnquiry; onClose: () => void; onDone: () => void }) {
  const [rms, setRms] = useState<RmUser[]>([])
  const [selectedRmId, setSelectedRmId] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/enquiries/users')
      .then(r => r.json())
      .then(d => setRms(d.data ?? []))
      .catch(() => {})
  }, [])

  const selectedRm = rms.find(r => r.id === selectedRmId)

  const handleAssign = async () => {
    if (!selectedRmId) return toast.error('Select an RM')
    setLoading(true)
    try {
      const res = await fetch(`/api/enquiries/provider/${enquiry.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rmId: selectedRmId }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Assigned to ${selectedRm?.name}${selectedRm?.regionName ? ` — ${selectedRm.regionName}` : ''}`)
      onDone()
    } catch {
      toast.error('Failed to assign')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Assign Enquiry" onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        Assigning: <strong>{enquiry.clinicName ?? 'Unknown'}</strong>
      </p>
      <Field label="Select RM">
        <select
          value={selectedRmId}
          onChange={e => setSelectedRmId(e.target.value)}
          className={inputCls}
        >
          <option value="">— Choose RM —</option>
          {rms.map(rm => (
            <option key={rm.id} value={rm.id}>
              {rm.name}{rm.regionName ? ` — ${rm.regionName}` : ''}
            </option>
          ))}
        </select>
      </Field>
      {selectedRm && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-1 text-sm">
          <div>
            <span className="text-gray-500 text-xs">Region: </span>
            <span className="font-medium">{selectedRm.regionName ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs">Manager: </span>
            <span className="font-medium">{selectedRm.managerName ?? '—'}</span>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
          Cancel
        </button>
        <button
          onClick={handleAssign}
          disabled={loading || !selectedRmId}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? 'Assigning...' : 'Assign'}
        </button>
      </div>
    </Modal>
  )
}

// ── Provider Edit Drawer ───────────────────────────────────────────────────────

function ProviderEditDrawer({ enquiry, onClose, onDone }: { enquiry: ProviderEnquiry; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    clinicName: enquiry.clinicName ?? '',
    contactPerson: enquiry.contactPerson ?? '',
    mobile: enquiry.mobile ?? '',
    email: enquiry.email ?? '',
    address: enquiry.address ?? '',
    city: enquiry.city ?? '',
    state: enquiry.state ?? '',
    pinCode: enquiry.pinCode ?? '',
    treatmentTypes: enquiry.treatmentTypes ?? '',
    ifscCode: enquiry.ifscCode ?? '',
    bankName: enquiry.bankName ?? '',
    branchName: enquiry.branchName ?? '',
    accountNumber: enquiry.accountNumber ?? '',
    notes: enquiry.notes ?? '',
  })
  const [loading, setLoading] = useState(false)

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/enquiries/provider/${enquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success('Saved')
      onDone()
    } catch {
      toast.error('Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Drawer title="Edit Provider Enquiry" onClose={onClose}>
      <div className="text-xs text-gray-400 mb-4 space-y-0.5">
        <div>Status: <span className="font-medium text-gray-700">{enquiry.status}</span></div>
        <div>Created: <span className="font-medium text-gray-700">{formatDate(enquiry.createdAt)}</span></div>
        {(enquiry.assignedRegion ?? enquiry.region) && <div>Region: <span className="font-medium text-gray-700">{enquiry.assignedRegion ?? enquiry.region}</span></div>}
        {enquiry.assignedRmName && <div>Assigned RM: <span className="font-medium text-gray-700">{enquiry.assignedRmName}</span></div>}
      </div>
      <Field label="Clinic Name">
        <input type="text" value={form.clinicName} onChange={set('clinicName')} className={inputCls} />
      </Field>
      <Field label="Contact Person">
        <input type="text" value={form.contactPerson} onChange={set('contactPerson')} className={inputCls} />
      </Field>
      <Field label="Mobile">
        <input type="text" value={form.mobile} onChange={set('mobile')} className={inputCls} />
      </Field>
      <Field label="Email">
        <input type="email" value={form.email} onChange={set('email')} className={inputCls} />
      </Field>
      <Field label="Address">
        <input type="text" value={form.address} onChange={set('address')} className={inputCls} />
      </Field>
      <Field label="City">
        <input type="text" value={form.city} onChange={set('city')} className={inputCls} />
      </Field>
      <Field label="State">
        <input type="text" value={form.state} onChange={set('state')} className={inputCls} />
      </Field>
      <Field label="PIN Code">
        <input type="text" value={form.pinCode} onChange={set('pinCode')} className={inputCls} />
      </Field>
      <Field label="Treatment Types">
        <input type="text" value={form.treatmentTypes} onChange={set('treatmentTypes')} className={inputCls} placeholder="e.g. Ortho, Dental" />
      </Field>
      <Field label="IFSC Code">
        <input type="text" value={form.ifscCode} onChange={set('ifscCode')} className={inputCls} />
      </Field>
      <Field label="Bank Name">
        <input type="text" value={form.bankName} onChange={set('bankName')} className={inputCls} />
      </Field>
      <Field label="Branch Name">
        <input type="text" value={form.branchName} onChange={set('branchName')} className={inputCls} />
      </Field>
      <Field label="Account Number">
        <input type="text" value={form.accountNumber} onChange={set('accountNumber')} className={inputCls} />
      </Field>
      <Field label="Notes">
        <textarea value={form.notes} onChange={set('notes')} rows={3} className={inputCls} />
      </Field>
      <div className="flex justify-end gap-2 pt-4 border-t mt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </Drawer>
  )
}

// ── Provider Convert Dialog ────────────────────────────────────────────────────

function ProviderConvertDialog({ enquiry, onClose, onDone }: { enquiry: ProviderEnquiry; onClose: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false)

  const missing: string[] = []
  if (!enquiry.clinicName) missing.push('Clinic Name')
  if (!enquiry.mobile && !enquiry.email) missing.push('Mobile or Email')
  if (!enquiry.city && !enquiry.pinCode) missing.push('City or PIN Code')
  if (!enquiry.assignedRegion && !enquiry.region) missing.push('Region (assign first)')

  const handleConvert = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/enquiries/provider/${enquiry.id}/convert`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Conversion failed')
      toast.success('Converted to Centre')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Conversion failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="Convert to Centre" onClose={onClose}>
      {missing.length > 0 ? (
        <div>
          <p className="text-sm text-red-600 font-medium mb-2">Cannot convert — missing required fields:</p>
          <ul className="list-disc pl-5 text-sm text-red-500 space-y-1">
            {missing.map(f => <li key={f}>{f}</li>)}
          </ul>
          <p className="text-xs text-gray-500 mt-3">Please edit the enquiry to fill in these fields first.</p>
          <div className="flex justify-end mt-5">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              Close
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-600 mb-4">Converting this provider enquiry to a clinic/centre:</p>
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1.5">
            <div><span className="text-gray-500">Clinic:</span> <span className="font-medium">{enquiry.clinicName}</span></div>
            <div><span className="text-gray-500">Contact:</span> <span className="font-medium">{enquiry.contactPerson ?? '—'}</span></div>
            <div><span className="text-gray-500">City:</span> <span className="font-medium">{enquiry.city ?? '—'}</span></div>
            <div><span className="text-gray-500">Region:</span> <span className="font-medium">{enquiry.assignedRegion ?? enquiry.region ?? '—'}</span></div>
            <div><span className="text-gray-500">Assigned RM:</span> <span className="font-medium">{enquiry.assignedRmName ?? '—'}</span></div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={handleConvert}
              disabled={loading}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
            >
              {loading ? 'Converting...' : 'Yes, Convert to Centre'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Drop Confirm Dialog ────────────────────────────────────────────────────────

function DropConfirmDialog({ label, onClose, onConfirm }: { label: string; onClose: () => void; onConfirm: () => void }) {
  const [loading, setLoading] = useState(false)

  return (
    <Modal title="Drop Enquiry" onClose={onClose}>
      <p className="text-sm text-gray-700 mb-1">
        Are you sure you want to drop:
      </p>
      <p className="text-sm font-semibold text-gray-900 mb-4">{label}</p>
      <p className="text-xs text-gray-500 mb-5">This will mark the enquiry as DROPPED. You can still view it by selecting that status filter.</p>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
          Cancel
        </button>
        <button
          onClick={async () => {
            setLoading(true)
            await onConfirm()
            setLoading(false)
          }}
          disabled={loading}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
        >
          {loading ? 'Dropping...' : 'Drop'}
        </button>
      </div>
    </Modal>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EnquiriesPage() {
  const { user } = useTabSession()
  const [activeTab, setActiveTab] = useState<'patient' | 'provider'>('patient')

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const tabCls = (tab: 'patient' | 'provider') =>
    cn(
      'px-5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition',
      activeTab === tab
        ? 'border-blue-600 text-blue-600 bg-white'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
    )

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Enquiry Management</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage patient and provider enquiries, assign to RMs, and convert to leads or centres.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 gap-1">
        <button className={tabCls('patient')} onClick={() => setActiveTab('patient')}>
          Patient Enquiries
        </button>
        <button className={tabCls('provider')} onClick={() => setActiveTab('provider')}>
          Provider Enquiries
        </button>
      </div>

      {activeTab === 'patient' ? (
        <PatientTab userRole={user.role} />
      ) : (
        <ProviderTab userRole={user.role} />
      )}
    </div>
  )
}
