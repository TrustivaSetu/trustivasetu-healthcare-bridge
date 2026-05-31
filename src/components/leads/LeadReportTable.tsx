'use client'

import { formatDate, formatLakhs, cn, getStatusColor } from '@/lib/utils'
import * as XLSX from 'xlsx'

interface LeadMeta {
  address?: string
  pincode?: string
  companyAddress?: string
  officePincode?: string
  aadhaarNumber?: string
  panNumber?: string
  monthlyIncome?: number | string
  cibilScore?: number | string
  foir?: number | string
  agreementSigned?: boolean | string
  nachDone?: boolean | string
  utrDetails?: string
  [key: string]: unknown
}

export interface ReportLead {
  id: string
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
  metadata: LeadMeta | null
  clinic: { id: string; name: string; region: { name: string } }
  lender: { id: string; name: string } | null
  createdBy: { id: string; name: string } | null
}

interface Props {
  leads: ReportLead[]
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onSort: (col: string) => void
}

function calcTAT(from: string | null, to: string | null): string {
  if (!from || !to) return '—'
  const hours = Math.round((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60))
  if (hours < 0) return '—'
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

function formatTime(dt: string | null): string {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function yesNo(val: unknown): string {
  if (val === true || val === 'true' || val === 'yes' || val === '1') return 'Yes'
  if (val === false || val === 'false' || val === 'no' || val === '0') return 'No'
  return '—'
}

const COLUMNS = [
  { key: 'id', label: 'Lead ID' },
  { key: 'applicantName', label: 'Customer Name' },
  { key: 'phone', label: 'Contact No.' },
  { key: 'email', label: 'Mail ID' },
  { key: 'address', label: 'Address' },
  { key: 'pincode', label: 'PIN Code' },
  { key: 'companyAddress', label: 'Company Address' },
  { key: 'officePincode', label: 'Company PIN' },
  { key: 'applicationDate', label: 'Date Punched' },
  { key: 'applicationTime', label: 'Time Punched' },
  { key: 'aadhaar', label: 'Aadhar No.' },
  { key: 'pan', label: 'PAN No.' },
  { key: 'income', label: 'Income' },
  { key: 'cibil', label: 'CIBIL' },
  { key: 'foir', label: 'FOIR' },
  { key: 'status', label: 'Decision' },
  { key: 'disbursed', label: 'Disbursed' },
  { key: 'disbursalPending', label: 'Disbursal Pending' },
  { key: 'tatApproval', label: 'TAT to Approval' },
  { key: 'tatDisbursal', label: 'TAT to Disbursal' },
  { key: 'agreementSigned', label: 'Agreement Signed' },
  { key: 'nachDone', label: 'NACH Done' },
  { key: 'utr', label: 'UTR' },
  { key: 'rejectionReason', label: 'Rejection Reason' },
]

function SortIcon({ col, sortBy, sortOrder }: { col: string; sortBy: string; sortOrder: 'asc' | 'desc' }) {
  if (sortBy !== col) return <span className="text-gray-300 ml-1">↕</span>
  return <span className="text-blue-600 ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
}

export function LeadReportTable({ leads, sortBy, sortOrder, onSort }: Props) {
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
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead className="bg-gray-50">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  className="px-3 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                >
                  {col.label}
                  <SortIcon col={col.key} sortBy={sortBy} sortOrder={sortOrder} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {leads.map(lead => {
              const meta = lead.metadata ?? {}
              const isDisbursed = lead.status === 'DISBURSED'
              const isPendingDisbursal = lead.status === 'APPROVED'
              return (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">
                    {lead.id.slice(-8).toUpperCase()}
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{lead.applicantName}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{lead.phone ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{lead.email ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate">{String(meta.address ?? '—')}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{String(meta.pincode ?? '—')}</td>
                  <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate">{String(meta.companyAddress ?? '—')}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{String(meta.officePincode ?? '—')}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDate(lead.applicationDate)}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatTime(lead.applicationDate)}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{String(meta.aadhaarNumber ?? '—')}</td>
                  <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{String(meta.panNumber ?? '—')}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                    {meta.monthlyIncome ? `₹${Number(meta.monthlyIncome).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{String(meta.cibilScore ?? '—')}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{String(meta.foir ?? '—')}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', getStatusColor(lead.status))}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', isDisbursed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                      {isDisbursed ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', isPendingDisbursal ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600')}>
                      {isPendingDisbursal ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                    {calcTAT(lead.applicationDate, lead.approvalDate)}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                    {calcTAT(lead.approvalDate, lead.disbursalDate)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                      yesNo(meta.agreementSigned) === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {yesNo(meta.agreementSigned)}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium',
                      yesNo(meta.nachDone) === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                      {yesNo(meta.nachDone)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{String(meta.utrDetails ?? '—')}</td>
                  <td className="px-3 py-2 text-red-600 max-w-[160px] truncate">
                    {lead.status === 'REJECTED' ? (lead.remarks ?? '—') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function exportLeadReport(leads: ReportLead[]) {
  const rows = leads.map(lead => {
    const meta = lead.metadata ?? {}
    return {
      'Lead ID': lead.id.slice(-8).toUpperCase(),
      'Customer Name': lead.applicantName,
      'Contact No.': lead.phone ?? '',
      'Mail ID': lead.email ?? '',
      'Address': String(meta.address ?? ''),
      'PIN Code': String(meta.pincode ?? ''),
      'Company Address': String(meta.companyAddress ?? ''),
      'Company PIN': String(meta.officePincode ?? ''),
      'Date Punched': formatDate(lead.applicationDate),
      'Time Punched': formatTime(lead.applicationDate),
      'Aadhar No.': String(meta.aadhaarNumber ?? ''),
      'PAN No.': String(meta.panNumber ?? ''),
      'Income': meta.monthlyIncome ? Number(meta.monthlyIncome) : '',
      'CIBIL': meta.cibilScore ? Number(meta.cibilScore) : '',
      'FOIR': meta.foir ? Number(meta.foir) : '',
      'Decision': lead.status,
      'Disbursed': lead.status === 'DISBURSED' ? 'Yes' : 'No',
      'Disbursal Pending': lead.status === 'APPROVED' ? 'Yes' : 'No',
      'TAT to Approval': calcTAT(lead.applicationDate, lead.approvalDate),
      'TAT to Disbursal': calcTAT(lead.approvalDate, lead.disbursalDate),
      'Agreement Signed': yesNo(meta.agreementSigned),
      'NACH Done': yesNo(meta.nachDone),
      'UTR': String(meta.utrDetails ?? ''),
      'Rejection Reason': lead.status === 'REJECTED' ? (lead.remarks ?? '') : '',
      'Approved Amount': lead.approvedAmount ?? '',
      'Disbursed Amount': lead.disbursedAmount ?? '',
      'Clinic': lead.clinic.name,
      'Region': lead.clinic.region.name,
      'Lender': lead.lender?.name ?? '',
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Lead Report')
  XLSX.writeFile(wb, `lead-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
