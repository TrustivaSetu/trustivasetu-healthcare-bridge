'use client'

import Link from 'next/link'
import { formatDate, formatLakhs, formatPercent, getGrowthColor, cn } from '@/lib/utils'

interface Clinic {
  id: string
  name: string
  address: string
  contactPerson: string
  contactNumber: string
  region: { id: string; name: string }
  assignedRM: { id: string; name: string } | null
  totalLeads: number
  mtdLeads: number
  lmtdLeads: number
  totalDisbursalValue: number
  mtdDisbursalValue: number
  lmtdDisbursalValue: number
  leadsGrowth: number
  disbursalGrowth: number
  onboardedAt: string
  businessPotential: number | null
  portalAccessSent?: boolean
  email?: string | null
  portalEmailStatus?: string | null
  lastPasswordGenAt?: string | null
}

interface Props {
  clinics: Clinic[]
  onEdit?: (clinic: Clinic) => void
  onDelete?: (clinic: Clinic) => void
  canDelete?: boolean
  onGenerateCredentials?: (clinicId: string, clinicName: string) => void
}

export function ClinicTable({ clinics, onEdit, onDelete, canDelete, onGenerateCredentials }: Props) {
  if (clinics.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <p className="text-gray-500">No clinics found</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Clinic / Centre', 'Region', 'Assigned RM', 'Total Leads', 'MTD Leads', 'LMTD Leads', 'Lead Growth', 'MTD Disbursal', 'LMTD Disbursal', 'Disb Growth', 'Portal', 'Onboarded', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {clinics.map(clinic => (
              <tr key={clinic.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/clinics/${clinic.id}`} className="font-medium text-brand-600 hover:text-brand-800 hover:underline text-sm">
                    {clinic.name}
                  </Link>
                  <p className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate">{clinic.address}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{clinic.region.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{clinic.assignedRM?.name ?? '—'}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{clinic.totalLeads}</td>
                <td className="px-4 py-3 text-sm font-medium text-blue-700">{clinic.mtdLeads}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{clinic.lmtdLeads}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={cn('font-medium', getGrowthColor(clinic.leadsGrowth))}>
                    {formatPercent(clinic.leadsGrowth)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-green-700">{formatLakhs(clinic.mtdDisbursalValue)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{formatLakhs(clinic.lmtdDisbursalValue)}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={cn('font-medium', getGrowthColor(clinic.disbursalGrowth))}>
                    {formatPercent(clinic.disbursalGrowth)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1.5 min-w-[110px]">
                    {clinic.portalEmailStatus === 'SENT' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Sent
                      </span>
                    ) : clinic.portalEmailStatus === 'FAILED' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Failed
                      </span>
                    ) : clinic.portalEmailStatus === 'NOT_SENT' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />Not Sent
                      </span>
                    ) : clinic.portalAccessSent ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />None
                      </span>
                    )}
                    {onGenerateCredentials && (
                      <button
                        onClick={() => onGenerateCredentials(clinic.id, clinic.name)}
                        className={cn(
                          'text-[11px] font-medium px-2 py-0.5 rounded border transition whitespace-nowrap',
                          clinic.portalEmailStatus === 'SENT'
                            ? 'text-gray-500 border-gray-200 bg-white hover:bg-gray-50'
                            : 'text-orange-700 border-orange-200 bg-orange-50 hover:bg-orange-100'
                        )}
                      >
                        🔑 {clinic.portalEmailStatus === 'SENT' ? 'Regen' : 'Generate'}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatDate(clinic.onboardedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/clinics/${clinic.id}`}
                      className="text-xs text-brand-600 hover:text-brand-800 font-medium">View</Link>
                    {onEdit && (
                      <button onClick={() => onEdit(clinic)}
                        className="text-xs text-gray-500 hover:text-gray-700 font-medium">Edit</button>
                    )}
                    {canDelete && onDelete && (
                      <button onClick={() => onDelete(clinic)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
