'use client'

import { useState, useEffect } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import { useParams, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { COMPANY, TERMS } from '@/lib/hr/appointment-letter'

interface SalaryBreakdown {
  grossSalary: number; basic: number; hra: number; specialAllowance: number
  conveyance: number; medicalAllowance: number; lta: number; bonus: number
  employeePF: number; employerPF: number; gratuity: number
  professionalTax: number; tds: number; netSalary: number; totalCTC: number
}

interface Letter {
  id: string; letterNumber: string; version: number; status: string
  employeeName: string; designation: string | null; department: string | null
  dateOfJoining: string | null; employmentType: string
  reportingManagerName: string | null; reportingManagerDesignation: string | null
  workLocation: string | null; grossSalary: number | null
  salaryBreakdown: SalaryBreakdown | null; travelRatePerKm: number | null
  monthlyExpenseCap: number | null; acknowledgedAt: string | null
  createdAt: string; user: { id: string; name: string; email: string }
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
const fmtDate = (d: string | Date | null) =>
  d ? format(new Date(d), 'dd MMMM yyyy') : '—'

export default function AppointmentLetterPage() {
  const { user: session } = useTabSession()
  const params = useParams()
  const router = useRouter()
  const [letter, setLetter] = useState<Letter | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAckConfirm, setShowAckConfirm] = useState(false)
  const [acknowledging, setAcknowledging] = useState(false)

  const isAdmin = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN'
  const isSelf = letter?.user?.id === session?.id

  useEffect(() => {
    fetch(`/api/hr/appointment-letter/${params.id}`)
      .then(r => r.json())
      .then(d => { if (d.data) setLetter(d.data); else toast.error(d.error ?? 'Not found') })
      .finally(() => setLoading(false))
  }, [params.id])

  async function acknowledge() {
    setAcknowledging(true)
    const res = await fetch(`/api/hr/appointment-letter/${params.id}/acknowledge`, { method: 'POST' })
    const d = await res.json()
    if (res.ok) {
      toast.success('Letter acknowledged! A copy has been sent to your email.')
      setLetter(prev => prev ? { ...prev, status: 'ACKNOWLEDGED', acknowledgedAt: d.data.acknowledgedAt } : prev)
      setShowAckConfirm(false)
    } else {
      toast.error(d.error ?? 'Failed')
    }
    setAcknowledging(false)
  }

  async function resend() {
    const res = await fetch(`/api/hr/appointment-letter/${params.id}/resend`, { method: 'POST' })
    if (res.ok) toast.success('Email resent successfully')
    else toast.error('Failed to resend')
  }

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
    </div>
  )
  if (!letter) return <div className="p-8 text-center text-gray-500">Letter not found.</div>

  const bd = letter.salaryBreakdown

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      {/* Action bar — hidden on print */}
      <div className="max-w-4xl mx-auto mb-4 flex items-center justify-between flex-wrap gap-3 px-4 print:hidden">
        <button onClick={() => router.back()} className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
          ← Back
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('px-3 py-1 rounded-full text-xs font-bold',
            letter.status === 'ACKNOWLEDGED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          )}>
            {letter.status === 'ACKNOWLEDGED' ? '✓ Acknowledged' : '⏳ Pending Acknowledgement'}
          </span>
          {isAdmin && (
            <button onClick={resend} className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-lg transition">
              Resend Email
            </button>
          )}
          <button onClick={() => window.print()} className="px-4 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium rounded-lg transition flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Download PDF
          </button>
          {isSelf && letter.status === 'PENDING_ACKNOWLEDGEMENT' && (
            <button onClick={() => setShowAckConfirm(true)}
              className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition">
              Acknowledge & Accept
            </button>
          )}
        </div>
      </div>

      {/* ── LETTER DOCUMENT ── */}
      <div className="max-w-4xl mx-auto bg-white shadow-xl print:shadow-none print:max-w-none" id="appointment-letter">

        {/* Letterhead */}
        <div className="border-b-4 border-gray-900 px-12 py-8 print:px-10 print:py-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-2xl font-black text-gray-900 tracking-wide">{COMPANY.name}</p>
              <p className="text-xs text-gray-600 mt-0.5 font-medium">{COMPANY.fullName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{COMPANY.address}</p>
              <p className="text-xs text-gray-500">{COMPANY.website} | {COMPANY.email}</p>
            </div>
            <div className="text-right text-xs text-gray-600 space-y-1">
              <p><span className="font-semibold">Letter No:</span> {letter.letterNumber}</p>
              <p><span className="font-semibold">Date:</span> {fmtDate(letter.createdAt)}</p>
              {letter.version > 1 && <p className="text-amber-600 font-semibold">Version {letter.version}</p>}
            </div>
          </div>
        </div>

        <div className="px-12 py-8 print:px-10 print:py-6 space-y-6 text-sm text-gray-800">

          {/* Title */}
          <div className="text-center">
            <h1 className="text-xl font-black tracking-widest text-gray-900 uppercase">Appointment Letter</h1>
            <div className="w-24 h-0.5 bg-gray-900 mx-auto mt-2" />
          </div>

          {/* Salutation */}
          <p>Dear <strong>{letter.employeeName}</strong>,</p>
          <p className="leading-relaxed">
            We are pleased to appoint you at <strong>{COMPANY.fullName}</strong> on the following terms and conditions:
          </p>

          {/* Employee Details */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">1. Employee Details</h2>
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Name', letter.employeeName],
                  ['Designation', letter.designation ?? '—'],
                  ['Department', letter.department ?? '—'],
                  ['Date of Joining', fmtDate(letter.dateOfJoining)],
                  ['Employment Type', letter.employmentType === 'PROBATION' ? 'Probation (3 months)' : 'Full Time'],
                  ['Reporting Manager', letter.reportingManagerName ? `${letter.reportingManagerName}${letter.reportingManagerDesignation ? ` (${letter.reportingManagerDesignation})` : ''}` : '—'],
                  ['Work Location', letter.workLocation ?? '—'],
                ].map(([label, value]) => (
                  <tr key={label} className="border-b border-gray-100">
                    <td className="py-1.5 pr-4 text-gray-500 font-medium w-44">{label}</td>
                    <td className="py-1.5 font-semibold">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Salary Structure */}
          {bd && letter.grossSalary && (
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">2. Salary Structure (Monthly)</h2>
              <table className="w-full text-sm border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Component</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700">Monthly (₹)</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700">Annual (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[
                    { label: 'Basic Salary (40% of Gross)', val: bd.basic },
                    { label: 'HRA (20% of Gross)', val: bd.hra },
                    { label: 'Special Allowance', val: bd.specialAllowance },
                    { label: 'Conveyance Allowance', val: bd.conveyance },
                    { label: 'Medical Allowance', val: bd.medicalAllowance },
                    { label: 'LTA (8.33% of Basic)', val: bd.lta },
                  ].map(r => (
                    <tr key={r.label}>
                      <td className="px-3 py-1.5 text-gray-600">{r.label}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(r.val)}</td>
                      <td className="px-3 py-1.5 text-right text-gray-500">{fmt(r.val * 12)}</td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 font-bold">
                    <td className="px-3 py-2">Gross Salary</td>
                    <td className="px-3 py-2 text-right">{fmt(letter.grossSalary)}</td>
                    <td className="px-3 py-2 text-right">{fmt(letter.grossSalary * 12)}</td>
                  </tr>
                </tbody>
                <tbody className="divide-y divide-gray-100 bg-red-50/30">
                  <tr>
                    <td className="px-3 py-1.5 text-red-700">(-) Employee PF (12% of Basic)</td>
                    <td className="px-3 py-1.5 text-right text-red-700">({fmt(bd.employeePF)})</td>
                    <td className="px-3 py-1.5 text-right text-red-600">({fmt(bd.employeePF * 12)})</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 text-red-700">(-) Professional Tax</td>
                    <td className="px-3 py-1.5 text-right text-red-700">(₹200)</td>
                    <td className="px-3 py-1.5 text-right text-red-600">(₹2,400)</td>
                  </tr>
                </tbody>
                <tbody>
                  <tr className="bg-green-50 font-bold border-t-2 border-green-300">
                    <td className="px-3 py-2 text-green-800">Net Take Home Salary</td>
                    <td className="px-3 py-2 text-right text-green-800">{fmt(bd.netSalary)}</td>
                    <td className="px-3 py-2 text-right text-green-700">{fmt(bd.netSalary * 12)}</td>
                  </tr>
                  <tr className="bg-blue-50 font-bold">
                    <td className="px-3 py-2 text-blue-800">Annual CTC (incl. Employer PF + Gratuity)</td>
                    <td className="px-3 py-2 text-right text-blue-700">{fmt(bd.totalCTC)}</td>
                    <td className="px-3 py-2 text-right text-blue-800">{fmt(bd.totalCTC * 12)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Expense Entitlement */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">3. Expense Entitlement</h2>
            <ul className="space-y-1.5 text-sm text-gray-700">
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span>
                <span>Travel Allowance: <strong>₹{letter.travelRatePerKm ?? 5}/km</strong> for official travel (as per designation)</span>
              </li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span>
                <span>Monthly Travel Expense Cap: <strong>{letter.monthlyExpenseCap ? fmt(letter.monthlyExpenseCap) : '—'}</strong></span>
              </li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span>
                <span>Outstation Travel: Hotel accommodation and flight tickets arranged and paid by the company. Local conveyance during outstation travel reimbursed on actuals with bills.</span>
              </li>
              <li className="flex gap-2"><span className="text-gray-400 flex-shrink-0">•</span>
                <span>All expense claims to be submitted via the employee portal within 30 days with supporting bills and manager approval.</span>
              </li>
            </ul>
          </div>

          {/* Terms & Conditions */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-300 pb-1 mb-3">4. Terms & Conditions</h2>
            <ol className="space-y-2 text-sm text-gray-700">
              {TERMS.map((term, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="flex-shrink-0 font-bold text-gray-500">{i + 1}.</span>
                  <span className="leading-relaxed">{term}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Signature */}
          <div className="pt-4">
            <div className="grid grid-cols-2 gap-8 mt-6">
              {/* Company signature */}
              <div>
                <p className="text-sm text-gray-600 mb-8">For {COMPANY.fullName}</p>
                <div className="border-b border-gray-400 w-48 mb-1" />
                <p className="text-sm font-semibold text-gray-800">Authorized Signatory</p>
                <p className="text-xs text-gray-500">CEO, {COMPANY.name}</p>
              </div>

              {/* Employee acknowledgement */}
              <div>
                {letter.status === 'ACKNOWLEDGED' && letter.acknowledgedAt ? (
                  <div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                      <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">✓ Acknowledged & Accepted</p>
                      <p className="text-sm font-semibold text-green-800">{letter.employeeName}</p>
                      <p className="text-xs text-green-600">Date: {fmtDate(letter.acknowledgedAt)}</p>
                    </div>
                    <div className="border-b border-gray-400 w-48 mb-1" />
                    <p className="text-sm font-semibold text-gray-800">{letter.employeeName}</p>
                    <p className="text-xs text-gray-500">Employee Signature</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-600 mb-8">Employee Acknowledgement:</p>
                    <div className="border-b border-gray-400 w-48 mb-1" />
                    <p className="text-sm text-gray-700">{letter.employeeName}</p>
                    <p className="text-xs text-gray-400">Date: _______________</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 border-t border-gray-200 pt-4 mt-6">
            This is a computer-generated appointment letter. | {COMPANY.fullName}
          </p>
        </div>
      </div>

      {/* Acknowledgement confirmation modal */}
      {showAckConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-gray-900 mb-3">Acknowledge Appointment Letter</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
              <p className="text-sm text-amber-800 leading-relaxed">
                By clicking <strong>Confirm & Accept</strong>, you acknowledge receipt and acceptance of this appointment letter (Letter No: <strong>{letter.letterNumber}</strong>) and agree to all terms and conditions mentioned herein.
              </p>
              <p className="text-xs text-amber-600 mt-2">A copy will be emailed to your registered email address.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={acknowledge} disabled={acknowledging}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-60">
                {acknowledging ? 'Processing...' : 'Confirm & Accept'}
              </button>
              <button onClick={() => setShowAckConfirm(false)}
                className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
