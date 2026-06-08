'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { INDIA_HOLIDAYS_2025_26, type IndiaHoliday } from '@/lib/hr/india-holidays-2025-26'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeaveRequest {
  id: string
  type: string
  fromDate: string
  toDate: string
  reason: string
  status: string
  user: { id: string; name: string; email: string }
  createdAt: string
}

interface AttendanceRecord {
  id: string
  date: string
  attendanceType: string
  workingType: string
  leaveType: string | null
  outstationCity: string | null
  notes: string | null
  user: { id: string; name: string; email: string }
}

interface ExpenseRecord {
  id: string
  title: string
  totalAmount: number
  periodStart: string
  periodEnd: string
  status: string
  items: unknown[]
  user: { id: string; name: string }
}

type Tab = 'leaves' | 'attendance' | 'expenses'

const MANDATORY_EXTRA_NAMES = ['Holika Dahan', 'Dhanteras', 'Bhai Dooj']

function classifyHoliday(h: IndiaHoliday): 'mandatory' | 'optional' {
  if (h.type === 'gazetted') return 'mandatory'
  if (MANDATORY_EXTRA_NAMES.some(n => h.name.includes(n))) return 'mandatory'
  return 'optional'
}

function getHolidaysInRange(fromDate: string, toDate: string) {
  const from = fromDate.split('T')[0]
  const to = toDate.split('T')[0]
  return INDIA_HOLIDAYS_2025_26.filter(h => h.date >= from && h.date <= to)
}

const LEAVE_LABELS: Record<string, string> = {
  PL: 'Paid Leave', CL: 'Casual Leave', MEDICAL: 'Medical Leave', UNPLANNED: 'Unplanned Leave',
}

// ── Approve/Reject button pair ────────────────────────────────────────────────

function ActionButtons({
  id,
  processingId,
  userName,
  onApprove,
  onReject,
}: {
  id: string
  processingId: string | null
  userName: string
  onApprove: (id: string) => void
  onReject: (id: string, reason: string) => void
}) {
  const busy = processingId === id
  return (
    <div className="flex gap-2 shrink-0">
      <button
        onClick={() => onApprove(id)}
        disabled={busy}
        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
      >
        {busy ? '...' : 'Approve'}
      </button>
      <button
        onClick={() => {
          const reason = window.prompt(`Rejection reason for ${userName} (optional):`) ?? ''
          onReject(id, reason)
        }}
        disabled={busy}
        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg border border-red-200 transition disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const { user: session } = useTabSession()
  const [tab, setTab] = useState<Tab>('leaves')
  const [leaves, setLeaves] = useState<LeaveRequest[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const role = session?.role ?? ''
  const canApprove = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER'].includes(role)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [lRes, aRes, eRes] = await Promise.all([
      fetch('/api/leaves?pending=true'),
      fetch('/api/hr/attendance?pending=true'),
      fetch('/api/expenses?status=SUBMITTED&all=1'),
    ])
    const [lData, aData, eData] = await Promise.all([lRes.json(), aRes.json(), eRes.json()])
    setLeaves(lData.data ?? [])
    setAttendance(aData.data ?? [])
    setExpenses(eData.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { if (canApprove) fetchAll() }, [fetchAll, canApprove])

  // ── Leave actions ─────────────────────────────────────────────────────────

  async function approveLeave(id: string) {
    setProcessingId(id)
    const res = await fetch(`/api/leaves/${id}/approve`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    if (res.ok) { toast.success('Leave approved'); fetchAll() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
    setProcessingId(null)
  }

  async function rejectLeave(id: string, comment: string) {
    setProcessingId(id)
    const res = await fetch(`/api/leaves/${id}/approve`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', comment }),
    })
    if (res.ok) { toast.success('Leave rejected'); fetchAll() }
    else toast.error('Failed')
    setProcessingId(null)
  }

  // ── Attendance actions ────────────────────────────────────────────────────

  async function approveAttendance(id: string) {
    setProcessingId(id)
    const res = await fetch('/api/hr/attendance/approve', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceId: id, action: 'approve' }),
    })
    if (res.ok) { toast.success('Attendance approved'); fetchAll() }
    else toast.error('Failed')
    setProcessingId(null)
  }

  async function rejectAttendance(id: string, reason: string) {
    setProcessingId(id)
    const res = await fetch('/api/hr/attendance/approve', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceId: id, action: 'reject', reason }),
    })
    if (res.ok) { toast.success('Attendance rejected'); fetchAll() }
    else toast.error('Failed')
    setProcessingId(null)
  }

  // ── Expense actions ───────────────────────────────────────────────────────

  async function approveExpense(id: string) {
    setProcessingId(id)
    const res = await fetch(`/api/expenses/${id}/approve`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    if (res.ok) { toast.success('Expense approved'); fetchAll() }
    else toast.error('Failed')
    setProcessingId(null)
  }

  async function rejectExpense(id: string, reason: string) {
    setProcessingId(id)
    const res = await fetch(`/api/expenses/${id}/approve`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', reason }),
    })
    if (res.ok) { toast.success('Expense rejected'); fetchAll() }
    else toast.error('Failed')
    setProcessingId(null)
  }

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!canApprove) {
    return (
      <div className="p-6 text-center">
        <p className="text-2xl mb-3">🔒</p>
        <p className="text-gray-500 text-sm">You don&apos;t have permission to access the approvals dashboard.</p>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'leaves',     label: 'Leave Requests', count: leaves.length },
    { key: 'attendance', label: 'Attendance',      count: attendance.length },
    { key: 'expenses',   label: 'Expenses',        count: expenses.length },
  ]

  const totalPending = leaves.length + attendance.length + expenses.length

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Approvals</h1>
          <p className="text-sm text-gray-500">Review and act on pending requests from your team</p>
        </div>
        {totalPending > 0 && (
          <span className="px-3 py-1.5 bg-amber-100 text-amber-800 text-sm font-bold rounded-full">
            {totalPending} pending
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2 text-sm font-medium rounded-xl transition flex items-center gap-1.5',
              tab === t.key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}>
            {t.label}
            {t.count > 0 && (
              <span className={cn('text-xs font-bold rounded-full px-1.5 py-0.5 leading-none',
                tab === t.key ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

          {/* ── Leave Requests ───────────────────────────────────────── */}
          {tab === 'leaves' && (
            leaves.length === 0
              ? <p className="text-center py-12 text-sm text-gray-400">No pending leave requests 🎉</p>
              : <div className="divide-y divide-gray-100">
                  {leaves.map(leave => {
                    const from = format(new Date(leave.fromDate), 'dd MMM')
                    const to = format(new Date(leave.toDate), 'dd MMM yyyy')
                    const range = leave.fromDate.split('T')[0] === leave.toDate.split('T')[0] ? to : `${from} – ${to}`
                    const rangeHols = getHolidaysInRange(leave.fromDate, leave.toDate)
                    const mandatoryHols = rangeHols.filter(h => classifyHoliday(h) === 'mandatory')
                    const optionalHols  = rangeHols.filter(h => classifyHoliday(h) === 'optional')
                    return (
                      <div key={leave.id} className="flex items-start gap-3 px-4 py-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{leave.user.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {LEAVE_LABELS[leave.type] ?? leave.type} · {range}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{leave.reason}</p>
                          {(mandatoryHols.length > 0 || optionalHols.length > 0) && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {mandatoryHols.map(h => (
                                <span key={h.date} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-semibold rounded-full border border-red-100">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                                  {h.name}
                                </span>
                              ))}
                              {optionalHols.map(h => (
                                <span key={h.date} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold rounded-full border border-amber-100">
                                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                                  {h.name}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-[11px] text-gray-400 mt-0.5">Submitted {format(new Date(leave.createdAt), 'dd MMM')}</p>
                        </div>
                        <ActionButtons
                          id={leave.id} processingId={processingId} userName={leave.user.name}
                          onApprove={approveLeave} onReject={rejectLeave}
                        />
                      </div>
                    )
                  })}
                </div>
          )}

          {/* ── Attendance ───────────────────────────────────────────── */}
          {tab === 'attendance' && (
            attendance.length === 0
              ? <p className="text-center py-12 text-sm text-gray-400">No pending attendance records 🎉</p>
              : <div className="divide-y divide-gray-100">
                  {attendance.map(rec => {
                    const dateStr = format(new Date(rec.date), 'EEE, dd MMM yyyy')
                    const typeLabel = rec.attendanceType === 'LEAVE'
                      ? (LEAVE_LABELS[rec.leaveType ?? ''] ?? 'Leave')
                      : rec.attendanceType === 'OUTSTATION'
                      ? `Outstation${rec.outstationCity ? ` — ${rec.outstationCity}` : ''}`
                      : rec.workingType === 'HALF_DAY' ? 'Present — Half Day' : 'Present — Full Day'
                    return (
                      <div key={rec.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{rec.user.name}</p>
                          <p className="text-xs text-gray-500">{dateStr} · {typeLabel}</p>
                          {rec.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{rec.notes}</p>}
                        </div>
                        <ActionButtons
                          id={rec.id} processingId={processingId} userName={rec.user.name}
                          onApprove={approveAttendance} onReject={rejectAttendance}
                        />
                      </div>
                    )
                  })}
                </div>
          )}

          {/* ── Expenses ─────────────────────────────────────────────── */}
          {tab === 'expenses' && (
            expenses.length === 0
              ? <p className="text-center py-12 text-sm text-gray-400">No pending expense submissions 🎉</p>
              : <div className="divide-y divide-gray-100">
                  {expenses.map(exp => (
                    <div key={exp.id} className="flex items-center gap-3 px-4 py-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{exp.user.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {exp.title} · {format(new Date(exp.periodStart), 'MMM yyyy')}
                          {' · '}{exp.items.length} item{exp.items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-gray-900 mr-2">
                        ₹{exp.totalAmount.toLocaleString('en-IN')}
                      </p>
                      <ActionButtons
                        id={exp.id} processingId={processingId} userName={exp.user.name}
                        onApprove={approveExpense} onReject={rejectExpense}
                      />
                    </div>
                  ))}
                </div>
          )}
        </div>
      )}
    </div>
  )
}
