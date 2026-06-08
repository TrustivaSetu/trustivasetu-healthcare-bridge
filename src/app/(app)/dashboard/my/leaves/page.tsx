'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { INDIA_HOLIDAYS_2025_26, type IndiaHoliday } from '@/lib/hr/india-holidays-2025-26'

type LeaveType = 'PL' | 'CL' | 'MEDICAL' | 'UNPLANNED'
type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

interface LeaveRequest {
  id: string
  type: LeaveType
  fromDate: string
  toDate: string
  reason: string
  status: ApprovalStatus
  approverComment: string | null
  createdAt: string
  approvedBy: { name: string } | null
}

const LEAVE_TYPES: { value: LeaveType; label: string; icon: string; desc: string }[] = [
  { value: 'PL',       label: 'Paid Leave',    icon: '🏖', desc: 'Deducted from PL balance (12/year)' },
  { value: 'CL',       label: 'Casual Leave',  icon: '🏠', desc: 'Deducted from CL balance (6/year)' },
  { value: 'MEDICAL',  label: 'Medical / Sick',icon: '🏥', desc: 'Deducted from medical balance (6/year)' },
  { value: 'UNPLANNED',label: 'Unplanned',     icon: '⚡', desc: 'Unpaid — deducted from salary' },
]

const STATUS_STYLE: Record<ApprovalStatus, string> = {
  PENDING:  'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

const MANDATORY_EXTRA_NAMES = ['Holika Dahan', 'Dhanteras', 'Bhai Dooj']

function classifyHoliday(h: IndiaHoliday): 'mandatory' | 'optional' {
  if (h.type === 'gazetted') return 'mandatory'
  if (MANDATORY_EXTRA_NAMES.some(n => h.name.includes(n))) return 'mandatory'
  return 'optional'
}

function formatRange(from: string, to: string) {
  const f = format(new Date(from), 'dd MMM')
  const t = format(new Date(to), 'dd MMM yyyy')
  return from.split('T')[0] === to.split('T')[0] ? t : `${f} – ${t}`
}

export default function MyLeavesPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const today = format(new Date(), 'yyyy-MM-dd')

  const [form, setForm] = useState({
    type: 'PL' as LeaveType,
    fromDate: today,
    toDate: today,
    reason: '',
  })

  const fetchLeaves = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/leaves')
    const data = await res.json()
    setLeaves(data.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchLeaves() }, [fetchLeaves])

  async function submitLeave() {
    if (!form.reason.trim()) { toast.error('Please enter a reason'); return }
    if (form.toDate < form.fromDate) { toast.error('End date must be after start date'); return }
    setSubmitting(true)
    const res = await fetch('/api/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      toast.success('Leave request submitted!')
      setShowForm(false)
      setForm({ type: 'PL', fromDate: today, toDate: today, reason: '' })
      fetchLeaves()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to submit leave request')
    }
    setSubmitting(false)
  }

  const pendingCount = leaves.filter(l => l.status === 'PENDING').length

  // Upcoming holidays — next 60 days
  const todayMs = new Date(today + 'T00:00:00Z').getTime()
  const upcomingHolidays = INDIA_HOLIDAYS_2025_26.filter(h => {
    const ms = new Date(h.date + 'T00:00:00Z').getTime()
    return ms >= todayMs && ms <= todayMs + 60 * 24 * 60 * 60 * 1000
  }).slice(0, 10)

  // Holidays inside the currently selected date range (for modal preview)
  const holidaysInRange = INDIA_HOLIDAYS_2025_26.filter(h => h.date >= form.fromDate && h.date <= form.toDate)
  const mandatoryInRange = holidaysInRange.filter(h => classifyHoliday(h) === 'mandatory')
  const optionalInRange  = holidaysInRange.filter(h => classifyHoliday(h) === 'optional')

  function requestOptionalHoliday(h: IndiaHoliday) {
    setForm({ type: 'CL', fromDate: h.date, toDate: h.date, reason: `Optional Holiday: ${h.name}` })
    setShowForm(true)
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Leaves</h1>
          <p className="text-sm text-gray-500">Submit and track leave requests</p>
        </div>
        <button
          onClick={() => { setForm({ type: 'PL', fromDate: today, toDate: today, reason: '' }); setShowForm(true) }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Apply Leave
        </button>
      </div>

      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-800">
          <span className="text-base">⏳</span>
          {pendingCount} request{pendingCount > 1 ? 's' : ''} awaiting approval from your manager
        </div>
      )}

      {/* Upcoming holidays */}
      {upcomingHolidays.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-700">Upcoming Holidays <span className="text-gray-400 font-normal">(next 60 days)</span></p>
          </div>
          <div className="divide-y divide-gray-100">
            {upcomingHolidays.map(h => {
              const hClass = classifyHoliday(h)
              const d = new Date(h.date + 'T00:00:00Z')
              const dayLabel = d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' })
              const isSun = d.getUTCDay() === 0
              return (
                <div key={h.date} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', hClass === 'mandatory' ? 'bg-red-500' : 'bg-yellow-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {h.name}
                      {isSun && <span className="ml-1.5 text-[10px] text-orange-600 font-semibold">⚠️ Sun</span>}
                    </p>
                    <p className="text-xs text-gray-400">{dayLabel} · {hClass === 'mandatory' ? 'Mandatory' : 'Optional'} · {h.religion}</p>
                  </div>
                  {hClass === 'optional' ? (
                    <button
                      onClick={() => requestOptionalHoliday(h)}
                      className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition"
                    >
                      Request
                    </button>
                  ) : (
                    <span className="flex-shrink-0 text-xs font-semibold px-2.5 py-1 bg-red-100 text-red-600 rounded-lg">Off</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
        </div>
      ) : leaves.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-4xl mb-3">🌴</p>
          <p className="text-gray-500 text-sm">No leave requests yet</p>
          <button onClick={() => setShowForm(true)}
            className="mt-3 text-sm text-blue-600 hover:underline font-medium">
            Apply for leave
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {leaves.map(leave => {
            const lt = LEAVE_TYPES.find(t => t.value === leave.type)
            return (
              <div key={leave.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">{lt?.icon} {lt?.label}</p>
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', STATUS_STYLE[leave.status])}>
                        {leave.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{formatRange(leave.fromDate, leave.toDate)}</p>
                    <p className="text-xs text-gray-600 mt-1">{leave.reason}</p>
                    {leave.approverComment && (
                      <p className="text-xs text-gray-400 mt-1.5 italic bg-gray-50 rounded-lg px-2 py-1">
                        &ldquo;{leave.approverComment}&rdquo;
                        {leave.approvedBy ? ` — ${leave.approvedBy.name}` : ''}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 flex-shrink-0">{format(new Date(leave.createdAt), 'dd MMM')}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Apply Leave Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Apply for Leave</h2>
                <p className="text-xs text-gray-500 mt-0.5">Your manager will receive a notification to approve</p>
              </div>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 text-lg">✕</button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Leave Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {LEAVE_TYPES.map(lt => (
                    <button key={lt.value} type="button"
                      onClick={() => setForm(f => ({ ...f, type: lt.value }))}
                      className={cn('py-2.5 px-3 text-xs font-semibold rounded-xl border-2 transition text-left',
                        form.type === lt.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      )}>
                      {lt.icon} {lt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  {LEAVE_TYPES.find(t => t.value === form.type)?.desc}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">From Date</label>
                  <input type="date" value={form.fromDate}
                    onChange={e => setForm(f => ({
                      ...f,
                      fromDate: e.target.value,
                      toDate: e.target.value > f.toDate ? e.target.value : f.toDate,
                    }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">To Date</label>
                  <input type="date" value={form.toDate} min={form.fromDate}
                    onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>

              {/* Holidays in selected range */}
              {(mandatoryInRange.length > 0 || optionalInRange.length > 0) && (
                <div className="rounded-xl border overflow-hidden text-xs">
                  {mandatoryInRange.length > 0 && (
                    <div className="bg-red-50 border-b border-red-100 px-3 py-2">
                      <p className="font-semibold text-red-700 mb-1">Mandatory holidays in this range — already off:</p>
                      {mandatoryInRange.map(h => (
                        <p key={h.date} className="text-red-600">• {h.name} ({new Date(h.date + 'T00:00:00Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })})</p>
                      ))}
                    </div>
                  )}
                  {optionalInRange.length > 0 && (
                    <div className="bg-amber-50 px-3 py-2">
                      <p className="font-semibold text-amber-700 mb-1">Optional holidays in this range:</p>
                      {optionalInRange.map(h => (
                        <p key={h.date} className="text-amber-600">• {h.name} ({new Date(h.date + 'T00:00:00Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })})</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reason *</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3}
                  placeholder="Brief reason for your leave..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                Your manager will be notified and can approve or reject this request.
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={submitLeave} disabled={submitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-3 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
