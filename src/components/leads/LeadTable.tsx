'use client'

import Link from 'next/link'
import { formatDate, formatLakhs, cn, getStatusColor, formatLeadId } from '@/lib/utils'

interface Lead {
  id: string
  leadNumber: number
  applicantName: string
  phone: string | null
  amount: number
  status: string
  approvedAmount: number | null
  disbursedAmount: number | null
  applicationDate: string
  approvalDate: string | null
  disbursalDate: string | null
  clinic: { id: string; name: string; region: { name: string } }
  lender: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
  remarks: string | null
}

interface Props {
  leads: Lead[]
  onEdit?: (lead: Lead) => void
  onStatusUpdate?: (lead: Lead, status: string) => void
  onDelete?: (lead: Lead) => void
  canEdit?: boolean
  canDelete?: boolean
}

export function LeadTable({ leads, onEdit, onStatusUpdate, onDelete, canEdit, canDelete }: Props) {
  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <p className="text-gray-500">No leads found</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Lead ID', 'Applicant', 'Channel Partner', 'Region', 'Lender', 'Applied Amt', 'Status', 'Approved Amt', 'Disbursed Amt', 'Applied On', 'Disbursal Date', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {leads.map(lead => (
              <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    {formatLeadId(lead.leadNumber)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-brand-700 hover:text-brand-900 hover:underline">
                    {lead.applicantName}
                  </Link>
                  {lead.phone && <p className="text-xs text-gray-500">{lead.phone}</p>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{lead.clinic.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{lead.clinic.region.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{lead.lender?.name ?? '—'}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{formatLakhs(lead.amount)}</td>
                <td className="px-4 py-3">
                  <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium', getStatusColor(lead.status))}>
                    {lead.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-blue-700">{lead.approvedAmount ? formatLakhs(lead.approvedAmount) : '—'}</td>
                <td className="px-4 py-3 text-sm text-green-700">{lead.disbursedAmount ? formatLakhs(lead.disbursedAmount) : '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatDate(lead.applicationDate)}</td>
                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{lead.disbursalDate ? formatDate(lead.disbursalDate) : '—'}</td>
                <td className="px-4 py-3">
                  {canEdit && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {onEdit && !['DISBURSED', 'REJECTED', 'CANCELLED'].includes(lead.status) && (
                        <button onClick={() => onEdit(lead)}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium">Edit</button>
                      )}
                      {onStatusUpdate && (lead.status === 'PENDING' || lead.status === 'DOCS_PENDING') && (
                        <>
                          <button onClick={() => onStatusUpdate(lead, 'APPROVED')}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium">Approve</button>
                          <button onClick={() => onStatusUpdate(lead, 'REJECTED')}
                            className="text-xs text-red-500 hover:text-red-700 font-medium">Reject</button>
                        </>
                      )}
                      {onStatusUpdate && lead.status === 'APPROVED' && (
                        <>
                          <button onClick={() => onStatusUpdate(lead, 'DISBURSED')}
                            className="text-xs text-green-600 hover:text-green-800 font-medium">Disburse</button>
                          <button onClick={() => onStatusUpdate(lead, 'REJECTED')}
                            className="text-xs text-red-500 hover:text-red-700 font-medium">Reject</button>
                        </>
                      )}
                      {canDelete && onDelete && (
                        <button onClick={() => onDelete(lead)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium border-l border-gray-200 pl-2 ml-1">
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
