'use client'

import { Header } from '@/components/layout/Header'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { useTabSession } from '@/contexts/TabSessionContext'

import { PageLoader } from '@/components/ui/LoadingSpinner'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { formatDate, formatLakhs, getStatusColor, getTaskStatusColor, cn } from '@/lib/utils'

interface AddressData {
  houseNo?: string
  street?: string
  landmark?: string
  pincode?: string
  city?: string
}

interface LeadMeta {
  utrNumber?: string
  nachDone?: boolean
  agreementSigned?: boolean
  panNumber?: string
  aadhaarVerified?: boolean
  panVerified?: boolean
  employmentType?: string
  monthlyIncome?: number | string
  treatmentCategory?: string
  schemeType?: string
  tenure?: number
  emi?: number
  processingFeePct?: number
  processingFeeAmount?: number
  downPayment?: number
  currentAddress?: AddressData
  permanentAddress?: AddressData
  [key: string]: unknown
}

interface LeadDetail {
  id: string
  externalId: string | null
  applicantName: string
  phone: string | null
  email: string | null
  amount: number
  status: string
  approvedAmount: number | null
  disbursedAmount: number | null
  applicationDate: string
  approvalDate: string | null
  disbursalDate: string | null
  remarks: string | null
  treatmentName: string | null
  treatmentCategory: string | null
  utrNumber: string | null
  nachStatus: string | null
  agreementSigned: boolean
  rejectionReason: string | null
  metadata: LeadMeta | null
  clinic: { id: string; name: string; address: string; region: { name: string } }
  lender: { id: string; name: string; code: string } | null
  createdBy: { id: string; name: string } | null
}

interface LeadTask {
  id: string
  title: string
  description: string | null
  status: string
  dueDate: string | null
  createdBy: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

interface LeadAgreement {
  id: string
  version: number
  agreementUrl: string
  fileName: string | null
  isActive: boolean
  notes: string | null
  uploadedBy: { id: string; name: string } | null
  createdAt: string
}

const STATUS_TRANSITIONS: Record<string, { label: string; next: string; color: string }[]> = {
  PENDING: [
    { label: 'Collect Docs', next: 'DOCS_PENDING', color: 'bg-orange-500 hover:bg-orange-600 text-white' },
    { label: 'Approve', next: 'APPROVED', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { label: 'Reject', next: 'REJECTED', color: 'bg-red-50 border border-red-300 text-red-700 hover:bg-red-100' },
    { label: 'Cancel', next: 'CANCELLED', color: 'bg-gray-100 border border-gray-300 text-gray-600 hover:bg-gray-200' },
  ],
  DOCS_PENDING: [
    { label: 'Start KYC', next: 'KYC_PENDING', color: 'bg-purple-600 hover:bg-purple-700 text-white' },
    { label: 'Approve', next: 'APPROVED', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { label: 'Reject', next: 'REJECTED', color: 'bg-red-50 border border-red-300 text-red-700 hover:bg-red-100' },
  ],
  KYC_PENDING: [
    { label: 'KYC Approved', next: 'KYC_APPROVED', color: 'bg-violet-600 hover:bg-violet-700 text-white' },
    { label: 'Reject', next: 'REJECTED', color: 'bg-red-50 border border-red-300 text-red-700 hover:bg-red-100' },
  ],
  KYC_APPROVED: [
    { label: 'Send for Markup', next: 'MARKUP_PENDING', color: 'bg-sky-600 hover:bg-sky-700 text-white' },
    { label: 'Reject', next: 'REJECTED', color: 'bg-red-50 border border-red-300 text-red-700 hover:bg-red-100' },
  ],
  MARKUP_PENDING: [
    { label: 'Send to Lender', next: 'PROCESSING', color: 'bg-cyan-600 hover:bg-cyan-700 text-white' },
    { label: 'Reject', next: 'REJECTED', color: 'bg-red-50 border border-red-300 text-red-700 hover:bg-red-100' },
  ],
  PROCESSING: [
    { label: 'Approve', next: 'APPROVED', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { label: 'Reject', next: 'REJECTED', color: 'bg-red-50 border border-red-300 text-red-700 hover:bg-red-100' },
  ],
  APPROVED: [
    { label: 'Disburse', next: 'DISBURSED', color: 'bg-green-600 hover:bg-green-700 text-white' },
    { label: 'Reject', next: 'REJECTED', color: 'bg-red-50 border border-red-300 text-red-700 hover:bg-red-100' },
  ],
}

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

const CAN_TAKE_ACTION = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER']

export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user: session } = useTabSession()

  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<{ type: 'status'; next: string } | { type: 'ops' } | { type: 'task' } | { type: 'agreement' } | null>(null)
  const [tasks, setTasks] = useState<LeadTask[]>([])
  const [agreements, setAgreements] = useState<LeadAgreement[]>([])
  const [uploading, setUploading] = useState(false)

  const canAct = CAN_TAKE_ACTION.includes(session?.role ?? '')
  const actions = lead ? STATUS_TRANSITIONS[lead.status] ?? [] : []

  const fetchLead = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leads/${params.id}`)
      if (!res.ok) throw new Error('Lead not found')
      const json = await res.json()
      setLead(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lead')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/leads/${params.id}/tasks`)
    if (res.ok) { const j = await res.json(); setTasks(j.data ?? []) }
  }, [params.id])

  const fetchAgreements = useCallback(async () => {
    const res = await fetch(`/api/leads/${params.id}/agreements`)
    if (res.ok) { const j = await res.json(); setAgreements(j.data ?? []) }
  }, [params.id])

  useEffect(() => { fetchLead() }, [fetchLead])
  useEffect(() => { fetchTasks() }, [fetchTasks])
  useEffect(() => { fetchAgreements() }, [fetchAgreements])

  async function patchLead(data: Record<string, unknown>) {
    const res = await fetch(`/api/leads/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error ?? 'Update failed')
    }
    return res.json()
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Lead Details" subtitle={lead?.applicantName} />

      <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-5">
        <button type="button" onClick={() => router.back()}
          className="text-sm text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1">
          ← Back to leads
        </button>

        {error && <ErrorAlert message={error} />}
        {loading && <PageLoader />}

        {!loading && lead && (
          <>
            {/* Status + Action bar */}
            <div className="flex items-center justify-between flex-wrap gap-3 bg-white rounded-xl border border-gray-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className={cn('px-3 py-1 rounded-full text-sm font-semibold', getStatusColor(lead.status))}>
                  {STATUS_LABELS[lead.status] ?? lead.status}
                </span>
                <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded">
                  {lead.id.slice(-8).toUpperCase()}
                </span>
                {lead.externalId && <span className="text-xs text-gray-400 font-mono">{lead.externalId}</span>}
              </div>
              {canAct && actions.length > 0 && (
                <div className="flex items-center gap-2">
                  {actions.map(a => (
                    <button key={a.next} onClick={() => setModal({ type: 'status', next: a.next })}
                      className={cn('px-4 py-1.5 rounded-lg text-sm font-semibold transition', a.color)}>
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Address Information */}
            {lead.metadata?.currentAddress && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Address Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <AddressCard title="Current Address" address={lead.metadata.currentAddress} />
                  <AddressCard
                    title="Permanent Address"
                    address={lead.metadata.permanentAddress}
                    sameAs={
                      lead.metadata.permanentAddress?.pincode === lead.metadata.currentAddress.pincode &&
                      lead.metadata.permanentAddress?.houseNo === lead.metadata.currentAddress.houseNo
                    }
                  />
                </div>
              </div>
            )}

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Patient & Loan */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Patient & Loan</h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div className="col-span-2">
                    <dt className="text-gray-400 text-xs">Name</dt>
                    <dd className="font-semibold text-gray-900 text-base">{lead.applicantName}</dd>
                  </div>
                  <div><dt className="text-gray-400 text-xs">Phone</dt><dd className="font-medium">{lead.phone ?? '—'}</dd></div>
                  <div><dt className="text-gray-400 text-xs">Email</dt><dd className="font-medium truncate">{lead.email ?? '—'}</dd></div>
                  <div><dt className="text-gray-400 text-xs">Requested</dt><dd className="font-semibold text-gray-800">{formatLakhs(lead.amount)}</dd></div>
                  <div><dt className="text-gray-400 text-xs">Lender</dt><dd className="font-medium">{lead.lender?.name ?? '—'}</dd></div>
                  <div>
                    <dt className="text-gray-400 text-xs">Approved</dt>
                    <dd className="font-semibold text-blue-700">{lead.approvedAmount ? formatLakhs(lead.approvedAmount) : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400 text-xs">Disbursed</dt>
                    <dd className="font-semibold text-green-700">{lead.disbursedAmount ? formatLakhs(lead.disbursedAmount) : '—'}</dd>
                  </div>
                  {lead.metadata?.tenure && (
                    <div><dt className="text-gray-400 text-xs">Tenure</dt><dd className="font-medium">{lead.metadata.tenure} months</dd></div>
                  )}
                  {lead.metadata?.emi && (
                    <div><dt className="text-gray-400 text-xs">EMI</dt><dd className="font-medium">₹{Number(lead.metadata.emi).toLocaleString('en-IN')}/mo</dd></div>
                  )}
                  {(lead.treatmentName || lead.treatmentCategory) && (
                    <div className="col-span-2">
                      <dt className="text-gray-400 text-xs">Treatment</dt>
                      <dd className="font-medium">
                        {lead.treatmentCategory ? `${lead.treatmentCategory} → ` : ''}{lead.treatmentName ?? ''}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-gray-400 text-xs">Applied On</dt>
                    <dd className="font-medium">{formatDate(lead.applicationDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400 text-xs">Created By</dt>
                    <dd className="font-medium">{lead.createdBy?.name ?? '—'}</dd>
                  </div>
                </dl>
                {(lead.metadata?.panNumber || lead.metadata?.employmentType || lead.metadata?.monthlyIncome) && (
                  <div className="pt-3 border-t border-gray-100 space-y-2.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">KYC & Employment</p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      {lead.metadata?.panNumber && (
                        <div>
                          <dt className="text-gray-400 text-xs">PAN No.</dt>
                          <dd className="font-medium font-mono text-gray-800">
                            {lead.metadata.panNumber}
                            {lead.metadata.panVerified && (
                              <span className="ml-1.5 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-sans">✓ Verified</span>
                            )}
                          </dd>
                        </div>
                      )}
                      {lead.metadata?.employmentType && (
                        <div>
                          <dt className="text-gray-400 text-xs">Employment</dt>
                          <dd className="font-medium">{String(lead.metadata.employmentType)}</dd>
                        </div>
                      )}
                      {lead.metadata?.monthlyIncome && (
                        <div>
                          <dt className="text-gray-400 text-xs">Monthly Income</dt>
                          <dd className="font-medium">₹{Number(lead.metadata.monthlyIncome).toLocaleString('en-IN')}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
                {lead.remarks && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">Remarks</p>
                    <p className="text-sm text-gray-700">{lead.remarks}</p>
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-5">
                {/* Timeline */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Timeline</h2>
                  <div className="space-y-3">
                    <TimelineRow
                      label="Application"
                      date={lead.applicationDate}
                      done
                    />
                    <TimelineRow
                      label="Approval"
                      date={lead.approvalDate}
                      done={!!lead.approvalDate}
                      amount={lead.approvedAmount}
                    />
                    <TimelineRow
                      label="Disbursal"
                      date={lead.disbursalDate}
                      done={!!lead.disbursalDate}
                      amount={lead.disbursedAmount}
                      last
                    />
                  </div>
                </div>

                {/* Operations */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Operations</h2>
                    {canAct && (
                      <button onClick={() => setModal({ type: 'ops' })}
                        className="text-xs text-brand-600 hover:text-brand-800 font-semibold">
                        Edit
                      </button>
                    )}
                  </div>
                  <dl className="space-y-2.5 text-sm">
                    <OpsRow label="UTR Number" value={lead.utrNumber ?? undefined} />
                    <OpsRow label="NACH Done" value={lead.nachStatus === 'DONE' ? 'Yes' : lead.nachStatus ? 'No' : undefined} boolean={lead.nachStatus === 'DONE'} />
                    <OpsRow label="Agreement Signed" value={lead.agreementSigned ? 'Yes' : 'No'} boolean={lead.agreementSigned} />
                  </dl>
                </div>

                {/* Clinic */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Clinic</h2>
                  <p className="font-semibold text-gray-900">{lead.clinic.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{lead.clinic.region.name}</p>
                  <p className="text-sm text-gray-600 mt-1">{lead.clinic.address}</p>
                  <Link href={`/clinics/${lead.clinic.id}`} className="inline-block mt-3 text-xs text-brand-600 font-medium hover:underline">
                    View clinic →
                  </Link>
                </div>
              </div>
            </div>

            {/* Tasks Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Tasks</h2>
                {canAct && (
                  <button onClick={() => setModal({ type: 'task' })}
                    className="text-xs text-brand-600 hover:text-brand-800 font-semibold flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Task
                  </button>
                )}
              </div>
              {tasks.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No tasks yet</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map(task => (
                    <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800">{task.title}</span>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getTaskStatusColor(task.status))}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                        {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
                        <p className="text-xs text-gray-400 mt-1">
                          {task.createdBy?.name ?? 'System'} · {formatDate(task.createdAt)}
                          {task.dueDate && ` · Due ${formatDate(task.dueDate)}`}
                        </p>
                      </div>
                      {canAct && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <select
                            value={task.status}
                            onChange={async (e) => {
                              const res = await fetch(`/api/leads/${params.id}/tasks`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ taskId: task.id, status: e.target.value }),
                              })
                              if (res.ok) { fetchTasks(); toast.success('Task updated') }
                              else toast.error('Failed to update task')
                            }}
                            className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400">
                            <option value="PENDING">Pending</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="DONE">Done</option>
                            <option value="PROCESSED">Processed</option>
                          </select>
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/leads/${params.id}/tasks?taskId=${task.id}`, { method: 'DELETE' })
                              if (res.ok) { fetchTasks(); toast.success('Task removed') }
                              else toast.error('Failed to remove task')
                            }}
                            className="text-gray-300 hover:text-red-500 transition">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Agreements Section */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Agreements
                  {agreements.length > 0 && (
                    <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-normal">
                      v{agreements[0]?.version ?? 1} current
                    </span>
                  )}
                </h2>
                {canAct && (
                  <button onClick={() => setModal({ type: 'agreement' })}
                    className="text-xs text-brand-600 hover:text-brand-800 font-semibold flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    {agreements.length === 0 ? 'Upload Agreement' : 'Re-Upload'}
                  </button>
                )}
              </div>
              {agreements.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No agreement uploaded</p>
              ) : (
                <div className="space-y-2">
                  {agreements.map(ag => (
                    <div key={ag.id} className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border',
                      ag.isActive ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50 opacity-70'
                    )}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">
                            Version {ag.version}
                          </span>
                          {ag.isActive && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {ag.uploadedBy?.name ?? 'Unknown'} · {formatDate(ag.createdAt)}
                          {ag.fileName && ` · ${ag.fileName}`}
                        </p>
                        {ag.notes && <p className="text-xs text-gray-400 mt-0.5 italic">{ag.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a href={ag.agreementUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium">
                          View
                        </a>
                        {canAct && (
                          <button
                            onClick={async () => {
                              if (!confirm('Delete this agreement version?')) return
                              const res = await fetch(`/api/leads/${params.id}/agreements?agreementId=${ag.id}`, { method: 'DELETE' })
                              if (res.ok) { fetchAgreements(); fetchLead(); toast.success('Agreement version removed') }
                              else toast.error('Failed to remove')
                            }}
                            className="text-gray-300 hover:text-red-500 transition">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Status change modal */}
      {modal?.type === 'status' && lead && (
        <StatusModal
          lead={lead}
          nextStatus={modal.next}
          onConfirm={async (fields) => {
            try {
              await patchLead({ status: modal.next, ...fields })
              toast.success(`Lead ${modal.next.toLowerCase()}`)
              setModal(null)
              fetchLead()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Failed')
            }
          }}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Operations edit modal */}
      {modal?.type === 'ops' && lead && (
        <OpsModal
          lead={lead}
          onConfirm={async (updatedFields) => {
            try {
              await patchLead(updatedFields)
              toast.success('Operations updated')
              setModal(null)
              fetchLead()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Failed')
            }
          }}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Add task modal */}
      {modal?.type === 'task' && lead && (
        <TaskModal
          leadId={lead.id}
          onConfirm={() => { setModal(null); fetchTasks() }}
          onCancel={() => setModal(null)}
        />
      )}

      {/* Upload agreement modal */}
      {modal?.type === 'agreement' && lead && (
        <AgreementUploadModal
          leadId={lead.id}
          uploading={uploading}
          setUploading={setUploading}
          onConfirm={() => { setModal(null); fetchAgreements(); fetchLead() }}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}

function AddressCard({ title, address, sameAs }: { title: string; address?: AddressData; sameAs?: boolean }) {
  const f = (v?: string) => v?.trim() || '—'
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      {sameAs ? (
        <p className="text-sm text-gray-500 italic">Same as Current Address</p>
      ) : (
        <dl className="space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="text-gray-400 w-20 flex-shrink-0">House No.</dt>
            <dd className="font-medium text-gray-800">{f(address?.houseNo)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-400 w-20 flex-shrink-0">Street</dt>
            <dd className="font-medium text-gray-800">{f(address?.street)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-400 w-20 flex-shrink-0">Landmark</dt>
            <dd className="font-medium text-gray-800">{f(address?.landmark)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-400 w-20 flex-shrink-0">PIN Code</dt>
            <dd className="font-medium text-gray-800 font-mono">{f(address?.pincode)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-gray-400 w-20 flex-shrink-0">City</dt>
            <dd className="font-medium text-gray-800">{f(address?.city)}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}

function TimelineRow({ label, date, done, amount, last }: {
  label: string; date: string | null; done: boolean; amount?: number | null; last?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
          done ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white')}>
          {done && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </div>
        {!last && <div className={cn('w-0.5 h-6 mt-1', done ? 'bg-green-300' : 'bg-gray-200')} />}
      </div>
      <div className="pb-1">
        <p className={cn('text-sm font-semibold', done ? 'text-gray-800' : 'text-gray-400')}>{label}</p>
        {date && <p className="text-xs text-gray-500">{formatDate(date)}</p>}
        {amount != null && <p className="text-xs font-semibold text-green-700 mt-0.5">{formatLakhs(amount)}</p>}
      </div>
    </div>
  )
}

function OpsRow({ label, value, boolean: boolVal }: { label: string; value?: string; boolean?: unknown }) {
  const hasValue = value !== undefined && value !== ''
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500 text-xs">{label}</dt>
      <dd className={cn('text-xs font-semibold',
        boolVal === true ? 'text-green-700' :
        boolVal === false ? 'text-gray-400' :
        hasValue ? 'text-gray-800 font-mono' : 'text-gray-300')}>
        {hasValue ? value : '—'}
      </dd>
    </div>
  )
}

function StatusModal({ lead, nextStatus, onConfirm, onCancel }: {
  lead: LeadDetail
  nextStatus: string
  onConfirm: (fields: Record<string, unknown>) => Promise<void>
  onCancel: () => void
}) {
  const needsAmount = nextStatus === 'APPROVED' || nextStatus === 'DISBURSED'
  const amountLabel = nextStatus === 'APPROVED' ? 'Approved Amount' : 'Disbursed Amount'
  const dateLabel = nextStatus === 'APPROVED' ? 'Approval Date' : nextStatus === 'DISBURSED' ? 'Disbursal Date' : 'Date'

  const defaultAmount = nextStatus === 'APPROVED'
    ? String(lead.approvedAmount ?? lead.amount)
    : String(lead.approvedAmount ?? lead.amount)

  const [amount, setAmount] = useState(defaultAmount)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)

  const STATUS_STYLES: Record<string, string> = {
    APPROVED: 'border-blue-300 bg-blue-50 text-blue-800',
    DISBURSED: 'border-green-300 bg-green-50 text-green-800',
    REJECTED: 'border-red-300 bg-red-50 text-red-800',
    CANCELLED: 'border-gray-300 bg-gray-50 text-gray-700',
  }

  async function submit() {
    if (needsAmount && (!amount || parseFloat(amount) <= 0)) {
      toast.error(`Enter a valid ${amountLabel}`)
      return
    }
    setSaving(true)
    const fields: Record<string, unknown> = { remarks: remarks || undefined }
    if (nextStatus === 'APPROVED') { fields.approvedAmount = parseFloat(amount); fields.approvalDate = date }
    if (nextStatus === 'DISBURSED') { fields.disbursedAmount = parseFloat(amount); fields.disbursalDate = date }
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

        <div className={cn('px-3 py-2 rounded-lg border text-sm font-semibold', STATUS_STYLES[nextStatus] ?? 'bg-gray-50')}>
          → {nextStatus}
        </div>

        {needsAmount && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{amountLabel} (₹) *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Enter actual amount from lender"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            <p className="text-xs text-gray-400 mt-1">Requested: ₹{lead.amount.toLocaleString('en-IN')}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{dateLabel}</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {nextStatus === 'REJECTED' ? 'Rejection Reason *' : 'Remarks (optional)'}
          </label>
          <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={2}
            placeholder={nextStatus === 'REJECTED' ? 'Reason for rejection...' : 'Any notes...'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving || (nextStatus === 'REJECTED' && !remarks)}
            className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Saving...' : `Confirm ${nextStatus}`}
          </button>
        </div>
      </div>
    </div>
  )
}

function OpsModal({ lead, onConfirm, onCancel }: {
  lead: LeadDetail
  onConfirm: (fields: Record<string, unknown>) => Promise<void>
  onCancel: () => void
}) {
  const [utr, setUtr] = useState(lead.utrNumber ?? '')
  const [nach, setNach] = useState(lead.nachStatus === 'DONE')
  const [agreement, setAgreement] = useState(lead.agreementSigned)
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    await onConfirm({
      utrNumber: utr || undefined,
      nachStatus: nach ? 'DONE' : 'PENDING',
      agreementSigned: agreement,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 className="text-base font-bold text-gray-900">Update Operations</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">UTR Number</label>
          <input value={utr} onChange={e => setUtr(e.target.value)}
            placeholder="Bank transfer UTR reference"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={nach} onChange={e => setNach(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400" />
            <span className="text-sm font-medium text-gray-700">NACH / Auto-debit mandate done</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={agreement} onChange={e => setAgreement(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400" />
            <span className="text-sm font-medium text-gray-700">Loan agreement signed</span>
          </label>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskModal({ leadId, onConfirm, onCancel }: {
  leadId: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: description || undefined, dueDate: dueDate || undefined }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      toast.success('Task added')
      onConfirm()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 className="text-base font-bold text-gray-900">Add Task</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Task title..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
            placeholder="Additional details..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving}
            className="flex-1 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60">
            {saving ? 'Saving...' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AgreementUploadModal({ leadId, uploading, setUploading, onConfirm, onCancel }: {
  leadId: string
  uploading: boolean
  setUploading: (v: boolean) => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')

  async function submit() {
    if (!file) { toast.error('Please select a file'); return }
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('folder', 'lead-agreements')
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: form })
      if (!uploadRes.ok) throw new Error('File upload failed')
      const { url } = await uploadRes.json()

      const res = await fetch(`/api/leads/${leadId}/agreements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementUrl: url, fileName: file.name, notes: notes || undefined }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      toast.success('Agreement uploaded successfully')
      onConfirm()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 className="text-base font-bold text-gray-900">Upload Agreement</h3>
        <p className="text-sm text-gray-500">Uploading a new agreement will create a new version and archive the previous one.</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Agreement File *</label>
          <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Re-signed after amendment..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} disabled={uploading} className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={uploading || !file}
            className="flex-1 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}
