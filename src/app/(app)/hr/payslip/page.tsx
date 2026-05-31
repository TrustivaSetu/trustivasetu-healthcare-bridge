'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { generateMonthOptions, getRoleLabel, cn } from '@/lib/utils'
import { formatINR } from '@/lib/hr/salary'
import { format } from 'date-fns'

interface PayslipData {
  user: { id: string; name: string; email: string; role: string; employeeProfile: { designation: string | null; department: string | null; dateOfJoining: string | null } | null }
  year: number; month: number; workingDays: number; payableDays: number
  salary: {
    grossSalary: number; basic: number; hra: number; specialAllowance: number
    conveyance: number; medicalAllowance: number; lta: number; bonus: number
    employeePF: number; employerPF: number; gratuity: number; professionalTax: number; tds: number
    netSalary: number; totalCTC: number
  } | null
  actualPayable: number | null
  leaveSummary: { pl: number; cl: number; medical: number; unplanned: number; outstation: number; present: number; halfDay: number }
}

interface User { id: string; name: string; role: string }

export default function PayslipPage() {
  const { data: session } = useSession()
  const [monthOptions] = useState(() => generateMonthOptions(24))
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value)
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [payslip, setPayslip] = useState<PayslipData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'ADMIN'

  useEffect(() => {
    if (isAdmin) {
      fetch('/api/users?minimal=1').then(r => r.json()).then(d => setUsers(d.data ?? []))
    }
    if (session?.user?.id) setSelectedUserId(session.user.id)
  }, [session, isAdmin])

  useEffect(() => {
    if (!selectedUserId || !selectedMonth) return
    setLoading(true); setError(''); setPayslip(null)
    fetch(`/api/hr/payslip/${selectedUserId}/${selectedMonth}`)
      .then(r => r.json())
      .then(d => { if (d.data) setPayslip(d.data); else setError(d.error ?? 'Failed') })
      .catch(() => setError('Failed to load payslip'))
      .finally(() => setLoading(false))
  }, [selectedUserId, selectedMonth])

  const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label ?? ''

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payslip</h1>
          <p className="text-sm text-gray-500">Monthly salary statement</p>
        </div>
        <button onClick={() => window.print()}
          className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 print:hidden flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / Download PDF
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 print:hidden">
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
          {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {isAdmin && (
          <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 min-w-[180px]">
            <option value={session?.user?.id ?? ''}>My Payslip</option>
            {users.filter(u => u.id !== session?.user?.id).map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading && <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{error}</div>}

      {payslip && !loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden print:shadow-none print:border-0" id="payslip-document">
          {/* Header */}
          <div className="bg-trustiva-panel text-white px-6 py-5 print:bg-gray-900">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 bg-trustiva-lime rounded-md flex items-center justify-center text-trustiva-navy font-bold text-sm">T</div>
                  <span className="font-bold text-lg">Trustiva Setu</span>
                </div>
                <p className="text-xs text-slate-300">Payslip for {monthLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{payslip.user.name}</p>
                <p className="text-xs text-slate-300">{payslip.user.email}</p>
                <p className="text-xs text-slate-300">{getRoleLabel(payslip.user.role)}</p>
                {payslip.user.employeeProfile?.designation && (
                  <p className="text-xs text-slate-300">{payslip.user.employeeProfile.designation}</p>
                )}
              </div>
            </div>
          </div>

          {/* Attendance summary */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-4 md:grid-cols-7 gap-3 text-center">
              {[
                { label: 'Working Days', value: payslip.workingDays },
                { label: 'Present', value: payslip.leaveSummary.present },
                { label: 'Half Day', value: payslip.leaveSummary.halfDay },
                { label: 'Outstation', value: payslip.leaveSummary.outstation },
                { label: 'PL', value: payslip.leaveSummary.pl },
                { label: 'CL', value: payslip.leaveSummary.cl },
                { label: 'Unpaid', value: payslip.leaveSummary.unplanned },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-lg px-2 py-2 border border-gray-200">
                  <p className="text-base font-bold text-gray-800">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {!payslip.salary ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              No salary structure set for this employee. Contact Admin.
            </div>
          ) : (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Earnings */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Earnings</p>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {[
                        ['Basic Salary', payslip.salary.basic],
                        ['HRA', payslip.salary.hra],
                        ['Special Allowance', payslip.salary.specialAllowance],
                        ['Conveyance', payslip.salary.conveyance],
                        ['Medical Allowance', payslip.salary.medicalAllowance],
                        ['LTA', payslip.salary.lta],
                        ['Bonus / Variable', payslip.salary.bonus],
                      ].map(([label, value]) => (
                        <tr key={label as string}>
                          <td className="py-1.5 text-gray-600">{label}</td>
                          <td className="py-1.5 text-right font-medium text-gray-800">{formatINR(value as number)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300">
                        <td className="pt-2 font-bold text-gray-800">Gross Salary</td>
                        <td className="pt-2 text-right font-bold text-gray-800">{formatINR(payslip.salary.grossSalary)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {/* Deductions */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Deductions</p>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {[
                        ['Employee PF', payslip.salary.employeePF],
                        ['Professional Tax', payslip.salary.professionalTax],
                        ['TDS', payslip.salary.tds],
                      ].map(([label, value]) => (
                        <tr key={label as string}>
                          <td className="py-1.5 text-gray-600">{label}</td>
                          <td className="py-1.5 text-right font-medium text-red-600">— {formatINR(value as number)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300">
                        <td className="pt-2 font-bold text-gray-800">Net Salary</td>
                        <td className="pt-2 text-right font-bold text-green-700">{formatINR(payslip.salary.netSalary)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Actual payable */}
              <div className={cn('mt-6 rounded-xl p-4 text-center', payslip.actualPayable !== null ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200')}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Actual Amount Payable for {monthLabel}
                </p>
                <p className="text-3xl font-bold text-green-700">
                  {payslip.actualPayable !== null ? formatINR(payslip.actualPayable) : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Based on {payslip.payableDays} paid day{payslip.payableDays !== 1 ? 's' : ''} out of {payslip.workingDays} working days
                </p>
              </div>
            </div>
          )}

          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-400 text-center">
            Generated on {format(new Date(), 'dd MMM yyyy')} · Trustiva Setu LMS · This is a computer-generated payslip
          </div>
        </div>
      )}
    </div>
  )
}
