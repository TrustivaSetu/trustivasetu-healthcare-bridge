'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { formatDate, formatLakhs, cn } from '@/lib/utils'

const TIMELINE_STEPS = ['PENDING', 'APPROVED', 'DISBURSED'] as const
const STATUS_ORDER: Record<string, number> = { PENDING: 0, APPROVED: 1, DISBURSED: 2, REJECTED: -1, CANCELLED: -1 }

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
  approvedAmount: number | null
  disbursedAmount: number | null
  status: string
  applicationDate: string
  approvalDate: string | null
  disbursalDate: string | null
  utrNumber: string | null
  rejectionReason: string | null
  remarks: string | null
  treatmentName: string | null
  lender: { id: string; name: string; code: string } | null
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <span className="text-sm text-gray-800 mt-0.5">{value || '—'}</span>
    </div>
  )
}

export default function ClinicLeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/clinic/leads/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.data) setLead(d.data)
        else setError(d.error ?? 'Not found')
        setLoading(false)
      })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Lead Details" />
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error || !lead) {
    return (
      <div className="flex flex-col min-h-full">
        <Header title="Lead Details" />
        <div className="p-6 text-red-600">{error || 'Lead not found'}</div>
      </div>
    )
  }

  const currentStep = STATUS_ORDER[lead.status] ?? 0
  const isRejectedOrCancelled = lead.status === 'REJECTED' || lead.status === 'CANCELLED'

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Lead Details" subtitle={lead.applicantName} />

      <div className="flex-1 p-6 space-y-5">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/dashboard/clinic/leads" className="hover:text-blue-600">My Leads</Link>
          <span>/</span>
          <span className="text-gray-800">{lead.applicantName}</span>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-3">
          <span className={cn('px-3 py-1 rounded-full text-sm font-semibold', STATUS_BADGE[lead.status] ?? 'bg-gray-100 text-gray-700')}>
            {lead.status}
          </span>
          {isRejectedOrCancelled && lead.rejectionReason && (
            <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
              Reason: {lead.rejectionReason}
            </span>
          )}
        </div>

        {/* Progress timeline */}
        {!isRejectedOrCancelled && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Application Progress</h3>
            <div className="flex items-center gap-0">
              {TIMELINE_STEPS.map((step, i) => {
                const done = currentStep >= i
                const active = currentStep === i
                return (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center gap-1">
                      <div className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2',
                        done ? 'bg-trustiva-navy border-trustiva-navy text-white' : 'bg-gray-100 border-gray-300 text-gray-400'
                      )}>
                        {done ? '✓' : i + 1}
                      </div>
                      <span className={cn('text-[10px] font-medium text-center', active ? 'text-trustiva-navy' : done ? 'text-gray-600' : 'text-gray-400')}>
                        {step}
                      </span>
                    </div>
                    {i < TIMELINE_STEPS.length - 1 && (
                      <div className={cn('flex-1 h-0.5 mx-1 -mt-4', currentStep > i ? 'bg-trustiva-navy' : 'bg-gray-200')} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Patient & Loan details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Patient Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Name" value={lead.applicantName} />
              <InfoRow label="Phone" value={lead.phone} />
              <InfoRow label="Email" value={lead.email} />
              <InfoRow label="Treatment" value={lead.treatmentName} />
              <InfoRow label="Applied On" value={formatDate(lead.applicationDate)} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Loan Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Applied Amount" value={formatLakhs(lead.amount)} />
              <InfoRow label="Approved Amount" value={lead.approvedAmount ? formatLakhs(lead.approvedAmount) : null} />
              <InfoRow label="Disbursed Amount" value={lead.disbursedAmount ? formatLakhs(lead.disbursedAmount) : null} />
              <InfoRow label="Lender" value={lead.lender?.name} />
              {lead.approvalDate && <InfoRow label="Approval Date" value={formatDate(lead.approvalDate)} />}
              {lead.disbursalDate && <InfoRow label="Disbursal Date" value={formatDate(lead.disbursalDate)} />}
            </div>
          </div>
        </div>

        {/* Disbursal info */}
        {lead.status === 'DISBURSED' && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Disbursal Information</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <InfoRow label="UTR Number" value={lead.utrNumber} />
              <InfoRow label="Disbursed Amount" value={lead.disbursedAmount ? formatLakhs(lead.disbursedAmount) : null} />
              <InfoRow label="Disbursal Date" value={lead.disbursalDate ? formatDate(lead.disbursalDate) : null} />
              <InfoRow label="Lender" value={lead.lender?.name} />
            </div>
          </div>
        )}

        {lead.remarks && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-yellow-800 mb-1">Remarks</p>
            <p className="text-sm text-yellow-700">{lead.remarks}</p>
          </div>
        )}
      </div>
    </div>
  )
}
