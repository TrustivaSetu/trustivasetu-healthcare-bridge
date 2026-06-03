'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatLakhs, cn } from '@/lib/utils'

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
  email: string | null
  amount: number
  status: string
  approvedAmount: number | null
  disbursedAmount: number | null
  disbursalDate: string | null
  approvalDate: string | null
  applicationDate: string
  utrNumber: string | null
  rejectionReason: string | null
  remarks: string | null
  treatmentName: string | null
  lender: { id: string; name: string; code: string } | null
  clinic: { id: string; name: string }
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 w-40 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value ?? '—'}</span>
    </div>
  )
}

const STATUS_TIMELINE: { status: string; label: string }[] = [
  { status: 'PENDING', label: 'Applied' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'DISBURSED', label: 'Disbursed' },
]

export default function ClinicLeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/clinic/leads/${id}`)
      .then(r => r.json())
      .then(d => { setLead(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="px-6 py-4 border-b bg-white"><h1 className="text-lg font-bold text-gray-900">Lead Details</h1></div>
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" /></div>
      </div>
    )
  }

  if (!lead) return <div className="p-6 text-red-600">Lead not found</div>

  const isRejected = lead.status === 'REJECTED' || lead.status === 'CANCELLED'
  const timelineStep = isRejected ? -1 : STATUS_TIMELINE.findIndex(s => s.status === lead.status)

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/dashboard/clinic/leads" className="hover:text-blue-600">Leads</Link>
          <span>/</span>
          <span className="text-gray-800">{lead.applicantName}</span>
        </div>
        <h1 className="text-lg font-bold text-gray-900">{lead.applicantName}</h1>
      </div>

      <div className="flex-1 p-6 space-y-5">
        {/* Status Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Status</h3>
          {isRejected ? (
            <div className="flex items-center gap-2">
              <span className={cn('px-3 py-1 rounded-full text-sm font-semibold', STATUS_BADGE[lead.status])}>
                {lead.status}
              </span>
              {lead.rejectionReason && <span className="text-sm text-gray-500">— {lead.rejectionReason}</span>}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {STATUS_TIMELINE.map((step, idx) => (
                <div key={step.status} className="flex items-center gap-2">
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                    idx <= timelineStep ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                  )}>
                    {idx <= timelineStep ? '✓' : idx + 1}
                  </div>
                  <span className={cn('text-xs', idx <= timelineStep ? 'text-gray-800 font-semibold' : 'text-gray-400')}>{step.label}</span>
                  {idx < STATUS_TIMELINE.length - 1 && <div className={cn('h-0.5 w-8', idx < timelineStep ? 'bg-green-400' : 'bg-gray-200')} />}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Patient Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Patient Information</h3>
            <InfoRow label="Patient Name" value={lead.applicantName} />
            <InfoRow label="Phone" value={lead.phone} />
            <InfoRow label="Email" value={lead.email} />
            <InfoRow label="Treatment" value={lead.treatmentName} />
            <InfoRow label="Applied Amount" value={formatLakhs(lead.amount)} />
            <InfoRow label="Applied On" value={formatDate(lead.applicationDate)} />
            <InfoRow label="Remarks" value={lead.remarks} />
          </div>

          {/* Lender Decision */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Lender Decision</h3>
            <InfoRow label="Lender" value={lead.lender?.name} />
            <InfoRow label="Approved Amount" value={lead.approvedAmount != null ? formatLakhs(lead.approvedAmount) : null} />
            <InfoRow label="Approval Date" value={lead.approvalDate ? formatDate(lead.approvalDate) : null} />
            <InfoRow label="Disbursed Amount" value={lead.disbursedAmount != null ? formatLakhs(lead.disbursedAmount) : null} />
            <InfoRow label="Disbursal Date" value={lead.disbursalDate ? formatDate(lead.disbursalDate) : null} />
            <InfoRow label="UTR Number" value={lead.utrNumber} />
          </div>
        </div>
      </div>
    </div>
  )
}
