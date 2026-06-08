'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { format, getDaysInMonth, startOfMonth, getDay, addDays, parseISO } from 'date-fns'
import { INDIA_HOLIDAYS_2025_26, type IndiaHoliday } from '@/lib/hr/india-holidays-2025-26'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string
  userId: string
  date: string
  attendanceType: 'PRESENT' | 'LEAVE' | 'OUTSTATION'
  leaveType: 'PL' | 'CL' | 'MEDICAL' | 'UNPLANNED' | null
  workingType: 'FULL_DAY' | 'HALF_DAY'
  outstationCity: string | null
  timeIn: string | null
  latitude: number | null
  longitude: number | null
  locationName: string | null
  notes: string | null
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason: string | null
}

interface Holiday { id: string; name: string; date: string }

// ── Holiday classification (from static data) ──────────────────────────────────

const MANDATORY_EXTRA_NAMES = ['Holika Dahan', 'Dhanteras', 'Bhai Dooj']

function getStaticHoliday(dateStr: string): IndiaHoliday | null {
  return INDIA_HOLIDAYS_2025_26.find(h => h.date === dateStr) ?? null
}

function classifyHoliday(h: IndiaHoliday): 'mandatory' | 'optional' {
  if (h.type === 'gazetted') return 'mandatory'
  if (MANDATORY_EXTRA_NAMES.some(n => h.name.includes(n))) return 'mandatory'
  return 'optional'
}

// ── Color scheme ───────────────────────────────────────────────────────────────

type DayStatus = 'PRESENT_FULL' | 'PRESENT_HALF' | 'OUTSTATION' | 'LEAVE' | 'ABSENT' | 'WEEKEND' | 'HOLIDAY_MANDATORY' | 'HOLIDAY_OPTIONAL' | 'FUTURE'

function getDayStatus(
  rec: AttendanceRecord | undefined,
  isWeekend: boolean,
  staticHoliday: IndiaHoliday | null,
  isPast: boolean,
  isToday: boolean,
): DayStatus {
  if (isWeekend) return 'WEEKEND'
  if (staticHoliday) return classifyHoliday(staticHoliday) === 'mandatory' ? 'HOLIDAY_MANDATORY' : 'HOLIDAY_OPTIONAL'
  if (!isPast && !isToday) return 'FUTURE'
  if (!rec) return isPast || isToday ? 'ABSENT' : 'FUTURE'
  if (rec.attendanceType === 'PRESENT') return rec.workingType === 'HALF_DAY' ? 'PRESENT_HALF' : 'PRESENT_FULL'
  if (rec.attendanceType === 'OUTSTATION') return 'OUTSTATION'
  return 'LEAVE'
}

const STATUS_STYLE: Record<DayStatus, { bar: string; bg: string; label: string; labelColor: string }> = {
  PRESENT_FULL:     { bar: 'bg-green-500',  bg: 'bg-green-50',  label: 'Present',   labelColor: 'text-green-700' },
  PRESENT_HALF:     { bar: 'bg-yellow-400', bg: 'bg-yellow-50', label: 'Half Day',  labelColor: 'text-yellow-700' },
  OUTSTATION:       { bar: 'bg-orange-500', bg: 'bg-orange-50', label: 'Outstation',labelColor: 'text-orange-700' },
  LEAVE:            { bar: 'bg-blue-500',   bg: 'bg-blue-50',   label: 'Leave',     labelColor: 'text-blue-700' },
  ABSENT:           { bar: 'bg-red-400',    bg: 'bg-red-50',    label: 'Absent',    labelColor: 'text-red-600' },
  WEEKEND:          { bar: '',              bg: 'bg-gray-50',   label: 'Weekend',   labelColor: 'text-gray-400' },
  HOLIDAY_MANDATORY:{ bar: 'bg-red-500',   bg: 'bg-red-50',    label: 'Holiday',   labelColor: 'text-red-600' },
  HOLIDAY_OPTIONAL: { bar: 'bg-yellow-400',bg: 'bg-amber-50',  label: 'Optional',  labelColor: 'text-amber-700' },
  FUTURE:           { bar: '',              bg: '',              label: '',          labelColor: '' },
}

const LEAVE_LABELS: Record<string, string> = {
  PL: 'Paid Leave', CL: 'Casual Leave', MEDICAL: 'Medical Leave', UNPLANNED: 'Unplanned Leave',
}

// ── Main component ─────────────────────────────────────────────────────────────

interface PendingRecord {
  id: string
  userId: string
  date: string
  attendanceType: 'PRESENT' | 'LEAVE' | 'OUTSTATION'
  leaveType: 'PL' | 'CL' | 'MEDICAL' | 'UNPLANNED' | null
  workingType: 'FULL_DAY' | 'HALF_DAY'
  outstationCity: string | null
  notes: string | null
  user: { id: string; name: string; email: string }
}

export default function AttendancePage() {
  const { user: session } = useTabSession()
  const isAdmin = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN'
  const isManager = session?.role === 'REGIONAL_MANAGER'

  const now = new Date()
  const todayStr = format(now, 'yyyy-MM-dd')
  const currentTime = format(now, 'HH:mm')

  const [viewDate, setViewDate] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  // Pending approvals for admins and managers
  const [pendingRecords, setPendingRecords] = useState<PendingRecord[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)

  // Modal state
  const [showPunch, setShowPunch] = useState(false)
  const [showLeave, setShowLeave] = useState(false)

  // Punch form
  const [punch, setPunch] = useState({
    date: todayStr,
    timeIn: currentTime,
    workingType: 'FULL_DAY' as 'FULL_DAY' | 'HALF_DAY',
    isOutstation: false,
    outstationCity: '',
    latitude: null as number | null,
    longitude: null as number | null,
    locationName: '',
    notes: '',
  })
  const [locating, setLocating] = useState(false)
  const [submittingPunch, setSubmittingPunch] = useState(false)

  // Leave form
  const [leave, setLeave] = useState({
    leaveType: 'PL' as 'PL' | 'CL' | 'MEDICAL' | 'UNPLANNED',
    fromDate: todayStr,
    toDate: todayStr,
    reason: '',
  })
  const [submittingLeave, setSubmittingLeave] = useState(false)

  // Holiday popup
  const [holidayPopup, setHolidayPopup] = useState<{ holiday: IndiaHoliday; dateStr: string } | null>(null)

  const monthKey = `${viewDate.year}-${String(viewDate.month).padStart(2, '0')}`

  const fetchPending = useCallback(async () => {
    if (!isAdmin && !isManager) return
    const res = await fetch('/api/hr/attendance?pending=true')
    const data = await res.json()
    setPendingRecords(data.data ?? [])
  }, [isAdmin, isManager])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [attRes, holRes] = await Promise.all([
      fetch(`/api/hr/attendance?month=${monthKey}`),
      fetch(`/api/hr/holidays?year=${viewDate.year}`),
    ])
    const [attData, holData] = await Promise.all([attRes.json(), holRes.json()])
    setRecords(attData.data ?? [])
    setHolidays(holData.data ?? [])
    setLoading(false)
  }, [monthKey, viewDate.year])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { fetchPending() }, [fetchPending])

  const holidayDates = new Set(holidays.map(h => h.date.split('T')[0]))
  const recordMap = new Map(records.map(r => [r.date.split('T')[0], r]))
  const todayRecord = recordMap.get(todayStr)

  // ── GPS ──────────────────────────────────────────────────────────────────────

  function captureGPS() {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        setPunch(p => ({ ...p, latitude, longitude }))
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          const d = await r.json()
          const city = d.address?.city || d.address?.town || d.address?.village || `${latitude.toFixed(3)},${longitude.toFixed(3)}`
          setPunch(p => ({ ...p, locationName: city }))
        } catch { /* ignore */ }
        setLocating(false)
      },
      () => { toast.error('Location access denied'); setLocating(false) }
    )
  }

  // ── Submit punch ─────────────────────────────────────────────────────────────

  async function submitPunch() {
    setSubmittingPunch(true)
    const payload = {
      date: punch.date,
      attendanceType: punch.isOutstation ? 'OUTSTATION' : 'PRESENT',
      leaveType: null,
      workingType: punch.isOutstation ? 'FULL_DAY' : punch.workingType,
      outstationCity: punch.isOutstation ? punch.outstationCity || null : null,
      timeIn: punch.timeIn || null,
      latitude: punch.latitude,
      longitude: punch.longitude,
      locationName: punch.locationName || null,
      notes: punch.notes || null,
    }
    const res = await fetch('/api/hr/attendance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast.success('Attendance punched successfully!')
      setShowPunch(false)
      fetchData()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to punch attendance')
    }
    setSubmittingPunch(false)
  }

  // ── Submit leave ──────────────────────────────────────────────────────────────

  async function submitLeave() {
    setSubmittingLeave(true)
    const from = parseISO(leave.fromDate)
    const to = parseISO(leave.toDate)

    if (to < from) { toast.error('To date must be on or after From date'); setSubmittingLeave(false); return }

    // Collect working days in range (skip weekends + holidays)
    const dates: string[] = []
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const dow = d.getDay()
      if (dow === 0 || dow === 6) continue
      const ds = format(d, 'yyyy-MM-dd')
      if (holidayDates.has(ds)) continue
      dates.push(ds)
    }

    if (dates.length === 0) { toast.error('No working days in selected range'); setSubmittingLeave(false); return }

    const results = await Promise.all(dates.map(date =>
      fetch('/api/hr/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          attendanceType: 'LEAVE',
          leaveType: leave.leaveType,
          workingType: 'FULL_DAY',
          notes: leave.reason || null,
        }),
      })
    ))

    const failed = results.filter(r => !r.ok).length
    if (failed === 0) {
      toast.success(`Leave applied for ${dates.length} day${dates.length > 1 ? 's' : ''}`)
      setShowLeave(false)
      fetchData()
    } else {
      toast.error(`${failed} day(s) failed — some may be locked after approval`)
    }
    setSubmittingLeave(false)
  }

  // ── Approve / reject team attendance ─────────────────────────────────────────

  async function handleApprove(attendanceId: string, action: 'approve' | 'reject', reason?: string) {
    setApprovingId(attendanceId)
    try {
      const res = await fetch('/api/hr/attendance/approve', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceId, action, reason }),
      })
      if (res.ok) {
        toast.success(action === 'approve' ? 'Attendance approved' : 'Attendance rejected')
        fetchPending()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Action failed')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setApprovingId(null)
    }
  }

  // ── Excel download ────────────────────────────────────────────────────────────

  async function downloadExcel() {
    setDownloading(true)
    const res = await fetch(`/api/hr/attendance/export?month=${monthKey}`)
    if (!res.ok) { toast.error('Failed to download'); setDownloading(false); return }
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Attendance_${monthKey}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
    setDownloading(false)
  }

  // ── Calendar helpers ──────────────────────────────────────────────────────────

  const daysInMonth = getDaysInMonth(new Date(viewDate.year, viewDate.month - 1))
  const firstDow = getDay(startOfMonth(new Date(viewDate.year, viewDate.month - 1)))
  const isCurrentMonth = now.getFullYear() === viewDate.year && now.getMonth() + 1 === viewDate.month
  const isFutureMonth = viewDate.year > now.getFullYear() || (viewDate.year === now.getFullYear() && viewDate.month > now.getMonth() + 1)

  function prevMonth() {
    setViewDate(v => { const d = new Date(v.year, v.month - 2); return { year: d.getFullYear(), month: d.getMonth() + 1 } })
  }
  function nextMonth() {
    setViewDate(v => { const d = new Date(v.year, v.month); return { year: d.getFullYear(), month: d.getMonth() + 1 } })
  }

  // ── Today status ──────────────────────────────────────────────────────────────

  function getTodayStatusLabel() {
    if (!todayRecord) return { label: 'Not Marked Yet', sub: 'Tap "Punch Attendance" to mark today', color: 'bg-gray-100 border-gray-200 text-gray-700', icon: '⏰' }
    if (todayRecord.approvalStatus === 'REJECTED') return { label: 'Rejected', sub: todayRecord.rejectionReason ?? 'Contact your manager', color: 'bg-red-50 border-red-200 text-red-700', icon: '✗' }
    if (todayRecord.attendanceType === 'PRESENT') {
      if (todayRecord.workingType === 'HALF_DAY') return { label: 'Present — Half Day', sub: `Checked in at ${todayRecord.timeIn ?? '—'}`, color: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: '🌤' }
      return { label: 'Present — Full Day', sub: `Checked in at ${todayRecord.timeIn ?? '—'}`, color: 'bg-green-50 border-green-200 text-green-800', icon: '✓' }
    }
    if (todayRecord.attendanceType === 'OUTSTATION') return { label: `Outstation${todayRecord.outstationCity ? ` — ${todayRecord.outstationCity}` : ''}`, sub: 'Travel day marked', color: 'bg-orange-50 border-orange-200 text-orange-800', icon: '✈' }
    if (todayRecord.attendanceType === 'LEAVE') return { label: `On Leave — ${LEAVE_LABELS[todayRecord.leaveType ?? ''] ?? 'Leave'}`, sub: todayRecord.approvalStatus === 'APPROVED' ? 'Approved' : 'Pending approval', color: 'bg-blue-50 border-blue-200 text-blue-800', icon: '🏖' }
    return { label: 'Marked', sub: '', color: 'bg-gray-50 border-gray-200 text-gray-700', icon: '•' }
  }

  const todayStatus = getTodayStatusLabel()

  // ── Monthly summary ───────────────────────────────────────────────────────────

  const present   = records.filter(r => r.attendanceType === 'PRESENT' && r.workingType === 'FULL_DAY').length
  const half      = records.filter(r => r.attendanceType === 'PRESENT' && r.workingType === 'HALF_DAY').length
  const outsta    = records.filter(r => r.attendanceType === 'OUTSTATION').length
  const leaves    = records.filter(r => r.attendanceType === 'LEAVE').length
  const approved  = records.filter(r => r.approvalStatus === 'APPROVED').length
  const pending   = records.filter(r => r.approvalStatus === 'PENDING').length

  // ── Holiday stats (from static data) ─────────────────────────────────────────

  const monthHolidays  = INDIA_HOLIDAYS_2025_26.filter(h => h.date.startsWith(monthKey))
  const mandatoryHols  = monthHolidays.filter(h => classifyHoliday(h) === 'mandatory')
  const optionalHols   = monthHolidays.filter(h => classifyHoliday(h) === 'optional')

  const weekendCount = Array.from({ length: daysInMonth }, (_, i) => {
    const dow = (firstDow + i) % 7
    return dow === 0 || dow === 6 ? 1 : 0
  }).reduce((a: number, b: number) => a + b, 0)
  const workingDaysCount = Math.max(0, daysInMonth - weekendCount - mandatoryHols.length)

  // Substitute holidays: mandatory holiday on Sunday → badge Monday (if in same month)
  const substituteDates = new Set<string>()
  mandatoryHols.forEach(h => {
    const d = new Date(h.date + 'T00:00:00Z')
    if (d.getUTCDay() === 0) {
      const mon = new Date(h.date + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 1)
      const monStr = mon.toISOString().split('T')[0]
      if (monStr.startsWith(monthKey)) substituteDates.add(monStr)
    }
  })

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500">{format(now, 'EEEE, dd MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button onClick={downloadExcel} disabled={downloading}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition disabled:opacity-60 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloading ? 'Exporting...' : 'Export Excel'}
            </button>
          )}
        </div>
      </div>

      {/* Today's status banner */}
      <div className={cn('flex items-center justify-between gap-4 border rounded-xl px-4 py-3', todayStatus.color)}>
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">{todayStatus.icon}</span>
          <div>
            <p className="font-semibold text-sm">{todayStatus.label}</p>
            <p className="text-xs opacity-75">{todayStatus.sub}</p>
          </div>
        </div>
        {!todayRecord && (
          <button onClick={() => { setPunch(p => ({ ...p, date: todayStr, timeIn: format(new Date(), 'HH:mm') })); setShowPunch(true) }}
            className="flex-shrink-0 px-3 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 transition">
            Punch Now
          </button>
        )}
        {todayRecord && todayRecord.approvalStatus === 'PENDING' && (
          <span className="flex-shrink-0 text-xs font-medium px-2 py-1 bg-amber-100 text-amber-700 rounded-full">Awaiting Approval</span>
        )}
        {todayRecord && todayRecord.approvalStatus === 'APPROVED' && (
          <span className="flex-shrink-0 text-xs font-medium px-2 py-1 bg-green-100 text-green-700 rounded-full">Approved</span>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setPunch(p => ({ ...p, date: todayStr, timeIn: format(new Date(), 'HH:mm'), isOutstation: false, outstationCity: '', locationName: '', latitude: null, longitude: null, notes: '' })); setShowPunch(true) }}
          className="flex items-center justify-center gap-2 py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-xl transition shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Punch Attendance
        </button>
        <button
          onClick={() => { setLeave(l => ({ ...l, fromDate: todayStr, toDate: todayStr, reason: '' })); setShowLeave(true) }}
          className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Apply Leave
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-bold text-gray-800">
          {format(new Date(viewDate.year, viewDate.month - 1), 'MMMM yyyy')}
        </span>
        <button onClick={nextMonth} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {([
          ['PRESENT_FULL', 'Present'], ['PRESENT_HALF', 'Half Day'], ['OUTSTATION', 'Outstation'],
          ['LEAVE', 'Leave'], ['ABSENT', 'Absent'],
          ['HOLIDAY_MANDATORY', 'Mandatory Holiday'], ['HOLIDAY_OPTIONAL', 'Optional Holiday'], ['WEEKEND', 'Weekend'],
        ] as [DayStatus, string][]).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={cn('w-2.5 h-2.5 rounded-sm', STATUS_STYLE[key].bar || 'bg-gray-200')} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-2 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wide">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells before month start */}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`e${i}`} className="h-[72px] border-b border-r border-gray-100 bg-gray-50/50" />
            ))}

            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${viewDate.year}-${String(viewDate.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dow = (firstDow + day - 1) % 7
              const isWeekend = dow === 0 || dow === 6
              const rec = recordMap.get(dateStr)
              const isToday = isCurrentMonth && day === now.getDate()
              const isPast = isFutureMonth ? false : isCurrentMonth ? day < now.getDate() : true
              const isFuture = isFutureMonth || (isCurrentMonth && day > now.getDate())
              const staticHoliday = getStaticHoliday(dateStr)
              const holidayClass = staticHoliday ? classifyHoliday(staticHoliday) : null
              const isSubstitute = substituteDates.has(dateStr)
              const status = getDayStatus(rec, isWeekend, staticHoliday, isPast, isToday)
              const style = STATUS_STYLE[status]
              const isClickable = !!staticHoliday || (!isWeekend && !isFuture)

              return (
                <button
                  key={day}
                  disabled={!isClickable}
                  onClick={() => {
                    if (staticHoliday) {
                      setHolidayPopup({ holiday: staticHoliday, dateStr })
                      return
                    }
                    if (!isClickable) return
                    if (rec?.approvalStatus === 'APPROVED' && !isAdmin) {
                      toast.error('Locked — approved by manager'); return
                    }
                    setPunch(p => ({
                      ...p,
                      date: dateStr,
                      timeIn: rec?.timeIn ?? '09:00',
                      workingType: rec?.workingType ?? 'FULL_DAY',
                      isOutstation: rec?.attendanceType === 'OUTSTATION',
                      outstationCity: rec?.outstationCity ?? '',
                      locationName: rec?.locationName ?? '',
                      latitude: rec?.latitude ?? null,
                      longitude: rec?.longitude ?? null,
                      notes: rec?.notes ?? '',
                    }))
                    setShowPunch(true)
                  }}
                  className={cn(
                    'h-[72px] border-b border-r border-gray-100 p-1.5 flex flex-col items-start text-left transition-all',
                    style.bg,
                    isClickable && 'hover:brightness-95 cursor-pointer',
                    !isClickable && 'cursor-default',
                    isToday && 'ring-2 ring-inset ring-brand-500',
                  )}
                >
                  {/* Date number */}
                  <span className={cn(
                    'text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full leading-none',
                    isToday ? 'bg-brand-600 text-white' : style.labelColor || 'text-gray-500',
                  )}>
                    {day}
                  </span>

                  {/* Color bar */}
                  {style.bar && <div className={cn('mt-1 w-full h-1 rounded-full', style.bar)} />}

                  {/* Label */}
                  <span className={cn('text-[9px] font-semibold leading-tight mt-0.5 truncate w-full', style.labelColor)}>
                    {staticHoliday ? staticHoliday.name :
                     isSubstitute ? 'Sub Holiday' :
                     status === 'OUTSTATION' && rec?.outstationCity ? rec.outstationCity :
                     status === 'LEAVE' ? (LEAVE_LABELS[rec?.leaveType ?? ''] ?? 'Leave') :
                     status !== 'FUTURE' && status !== 'WEEKEND' ? style.label : ''}
                  </span>

                  {/* Optional badge */}
                  {holidayClass === 'optional' && (
                    <span className="text-[8px] font-bold text-amber-600 leading-none">tap to request</span>
                  )}

                  {/* Substitute holiday badge */}
                  {isSubstitute && !staticHoliday && (
                    <span className="text-[8px] font-bold text-orange-600 leading-none">Sub Hol</span>
                  )}

                  {/* Approval badge */}
                  {rec && !isWeekend && !staticHoliday && (
                    <span className={cn('text-[8px] font-bold leading-none',
                      rec.approvalStatus === 'APPROVED' ? 'text-green-600' :
                      rec.approvalStatus === 'REJECTED' ? 'text-red-600' : 'text-amber-500'
                    )}>
                      {rec.approvalStatus === 'APPROVED' ? '✓ Approved' :
                       rec.approvalStatus === 'REJECTED' ? '✗ Rejected' : '• Pending'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Holiday summary widget */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
          Holiday Summary — {format(new Date(viewDate.year, viewDate.month - 1), 'MMMM yyyy')}
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center bg-red-50">
            <p className="text-xl font-bold leading-none text-red-700">{mandatoryHols.length}</p>
            <p className="text-[11px] font-medium mt-1 text-red-600">Mandatory Holidays</p>
          </div>
          <div className="rounded-xl p-3 text-center bg-amber-50">
            <p className="text-xl font-bold leading-none text-amber-700">{optionalHols.length}</p>
            <p className="text-[11px] font-medium mt-1 text-amber-600">Optional Holidays</p>
          </div>
          <div className="rounded-xl p-3 text-center bg-green-50">
            <p className="text-xl font-bold leading-none text-green-700">{workingDaysCount}</p>
            <p className="text-[11px] font-medium mt-1 text-green-600">Working Days</p>
          </div>
        </div>
        {mandatoryHols.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {mandatoryHols.map(h => (
              <button
                key={h.date}
                onClick={() => setHolidayPopup({ holiday: h, dateStr: h.date })}
                className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium hover:bg-red-200 transition"
              >
                {h.name}
              </button>
            ))}
          </div>
        )}
        {optionalHols.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {optionalHols.map(h => (
              <button
                key={h.date}
                onClick={() => setHolidayPopup({ holiday: h, dateStr: h.date })}
                className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium hover:bg-amber-200 transition"
              >
                {h.name}
              </button>
            ))}
          </div>
        )}
        {monthHolidays.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-2">No holidays this month</p>
        )}
      </div>

      {/* Monthly summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Monthly Summary</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: 'Present', value: present,  color: 'bg-green-50 text-green-700' },
            { label: 'Half Day', value: half,    color: 'bg-yellow-50 text-yellow-700' },
            { label: 'Outstation', value: outsta,color: 'bg-orange-50 text-orange-700' },
            { label: 'Leave', value: leaves,     color: 'bg-blue-50 text-blue-700' },
            { label: 'Approved', value: approved,color: 'bg-emerald-50 text-emerald-700' },
            { label: 'Pending', value: pending,  color: 'bg-amber-50 text-amber-700' },
          ].map(s => (
            <div key={s.label} className={cn('rounded-xl p-3 text-center', s.color)}>
              <p className="text-xl font-bold leading-none">{s.value}</p>
              <p className="text-[11px] font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pending Approvals Panel (admins and managers) ─────────────────────── */}
      {(isAdmin || isManager) && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-gray-800">Pending Approvals</p>
              {pendingRecords.length > 0 && (
                <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {pendingRecords.length}
                </span>
              )}
            </div>
          </div>
          {pendingRecords.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              No pending approvals
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingRecords.map(rec => {
                const dateStr = format(new Date(rec.date), 'dd MMM yyyy')
                const typeLabel = rec.attendanceType === 'LEAVE'
                  ? `${LEAVE_LABELS[rec.leaveType ?? ''] ?? 'Leave'}`
                  : rec.attendanceType === 'OUTSTATION'
                  ? `Outstation${rec.outstationCity ? ` — ${rec.outstationCity}` : ''}`
                  : rec.workingType === 'HALF_DAY' ? 'Present — Half Day' : 'Present — Full Day'
                const isProcessing = approvingId === rec.id
                return (
                  <div key={rec.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{rec.user.name}</p>
                      <p className="text-xs text-gray-500">{dateStr} · {typeLabel}</p>
                      {rec.notes && <p className="text-xs text-gray-400 truncate mt-0.5">{rec.notes}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(rec.id, 'approve')}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
                      >
                        {isProcessing ? '...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => {
                          const reason = window.prompt(`Reason for rejecting ${rec.user.name}'s attendance on ${dateStr} (optional):`) ?? ''
                          handleApprove(rec.id, 'reject', reason)
                        }}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg border border-red-200 transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Punch Attendance Modal ───────────────────────────────────────────── */}
      {showPunch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPunch(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white flex justify-between items-center px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Punch Attendance</h2>
                <p className="text-xs text-gray-500 mt-0.5">Mark your presence for a day</p>
              </div>
              <button onClick={() => setShowPunch(false)} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition text-lg">✕</button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
                <input type="date" value={punch.date}
                  max={todayStr}
                  onChange={e => setPunch(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>

              {/* Time */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Day Started At</label>
                <input type="time" value={punch.timeIn}
                  onChange={e => setPunch(p => ({ ...p, timeIn: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>

              {/* Full / Half Day */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Working</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['FULL_DAY', 'HALF_DAY'] as const).map(w => (
                    <button key={w} type="button"
                      disabled={punch.isOutstation}
                      onClick={() => setPunch(p => ({ ...p, workingType: w }))}
                      className={cn('py-2.5 text-sm font-semibold rounded-xl border-2 transition',
                        punch.workingType === w && !punch.isOutstation
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                        punch.isOutstation && 'opacity-40 cursor-not-allowed',
                      )}>
                      {w === 'FULL_DAY' ? '☀ Full Day' : '🌤 Half Day'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Outstation toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Outstation / Travel</p>
                  <p className="text-xs text-gray-400">Working from outside office</p>
                </div>
                <button type="button"
                  onClick={() => setPunch(p => ({ ...p, isOutstation: !p.isOutstation, workingType: 'FULL_DAY' }))}
                  className={cn('relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
                    punch.isOutstation ? 'bg-orange-500' : 'bg-gray-200'
                  )}>
                  <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                    punch.isOutstation && 'translate-x-5'
                  )} />
                </button>
              </div>

              {punch.isOutstation && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">City / Destination *</label>
                  <input value={punch.outstationCity}
                    onChange={e => setPunch(p => ({ ...p, outstationCity: e.target.value }))}
                    placeholder="e.g. Mumbai, Delhi"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                </div>
              )}

              {/* GPS Location */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Location</label>
                <button type="button" onClick={captureGPS} disabled={locating}
                  className={cn('w-full px-3 py-2.5 border-2 border-dashed rounded-lg text-sm transition flex items-center gap-2 justify-center',
                    punch.locationName ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-300',
                    locating && 'opacity-60 cursor-not-allowed',
                  )}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {locating ? 'Getting location...' : punch.locationName ? `📍 ${punch.locationName}` : 'Capture GPS Location'}
                </button>
                {punch.locationName && (
                  <button type="button" onClick={() => setPunch(p => ({ ...p, locationName: '', latitude: null, longitude: null }))}
                    className="text-xs text-gray-400 hover:text-gray-600 mt-1">Clear location</button>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes (optional)</label>
                <textarea value={punch.notes} onChange={e => setPunch(p => ({ ...p, notes: e.target.value }))} rows={2}
                  placeholder="Any additional info..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={submitPunch} disabled={submittingPunch || (punch.isOutstation && !punch.outstationCity)}
                className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                {submittingPunch ? 'Submitting...' : 'Submit Attendance'}
              </button>
              <button onClick={() => setShowPunch(false)}
                className="px-4 py-3 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Holiday Detail Popup ────────────────────────────────────────────── */}
      {holidayPopup && (() => {
        const { holiday, dateStr } = holidayPopup
        const hClass = classifyHoliday(holiday)
        const d = new Date(dateStr + 'T00:00:00Z')
        const dateLabel = d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
        const isSun = d.getUTCDay() === 0
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setHolidayPopup(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className={cn(
                'flex items-center gap-3 px-5 pt-5 pb-4 rounded-t-2xl',
                hClass === 'mandatory' ? 'bg-red-50' : 'bg-amber-50'
              )}>
                <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0',
                  hClass === 'mandatory' ? 'bg-red-100' : 'bg-amber-100'
                )}>
                  {hClass === 'mandatory' ? '🔴' : '🟡'}
                </div>
                <div className="min-w-0">
                  <p className={cn('font-bold text-sm leading-tight', hClass === 'mandatory' ? 'text-red-800' : 'text-amber-800')}>
                    {holiday.name}
                  </p>
                  <p className={cn('text-xs mt-0.5', hClass === 'mandatory' ? 'text-red-600' : 'text-amber-600')}>
                    {hClass === 'mandatory' ? 'Mandatory Holiday' : 'Optional Holiday'}
                  </p>
                </div>
                <button onClick={() => setHolidayPopup(null)} className="ml-auto w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-white/60 text-lg flex-shrink-0">✕</button>
              </div>

              <div className="px-5 py-4 space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <span className="text-gray-400 w-20 flex-shrink-0 text-xs font-semibold pt-0.5">DATE</span>
                  <span className="text-gray-800 font-medium">{dateLabel}</span>
                </div>
                {isSun && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 w-20 flex-shrink-0 text-xs font-semibold"></span>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">⚠️ Falls on Sunday — substitute holiday may apply on Monday</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 w-20 flex-shrink-0 text-xs font-semibold">CATEGORY</span>
                  <span className="text-gray-700">{holiday.religion}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400 w-20 flex-shrink-0 text-xs font-semibold">TYPE</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold',
                    holiday.type === 'gazetted' ? 'bg-green-100 text-green-700' :
                    holiday.type === 'restricted' ? 'bg-yellow-100 text-yellow-700' :
                    holiday.type === 'festival' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  )}>
                    {holiday.type.charAt(0).toUpperCase() + holiday.type.slice(1)}
                  </span>
                </div>
                {holiday.note && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-gray-400 w-20 flex-shrink-0 text-xs font-semibold pt-0.5">NOTE</span>
                    <span className="text-gray-500 text-xs leading-relaxed">{holiday.note}</span>
                  </div>
                )}
                {holiday.state && (
                  <div className="flex items-start gap-2 text-sm">
                    <span className="text-gray-400 w-20 flex-shrink-0 text-xs font-semibold pt-0.5">REGION</span>
                    <span className="text-gray-500 text-xs">{holiday.state}</span>
                  </div>
                )}
              </div>

              <div className="px-5 pb-5 flex gap-3">
                {hClass === 'optional' && (
                  <button
                    onClick={() => {
                      setLeave(l => ({ ...l, fromDate: dateStr, toDate: dateStr, reason: `Optional Holiday: ${holiday.name}` }))
                      setHolidayPopup(null)
                      setShowLeave(true)
                    }}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl transition"
                  >
                    Request Optional Holiday →
                  </button>
                )}
                <button
                  onClick={() => setHolidayPopup(null)}
                  className={cn(
                    'py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition',
                    hClass === 'optional' ? 'px-4' : 'flex-1'
                  )}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Apply Leave Modal ────────────────────────────────────────────────── */}
      {showLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowLeave(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Apply Leave</h2>
                <p className="text-xs text-gray-500 mt-0.5">Send leave request to your manager</p>
              </div>
              <button onClick={() => setShowLeave(false)} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition text-lg">✕</button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Leave type */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Leave Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {([['PL', 'Paid Leave'], ['CL', 'Casual Leave'], ['MEDICAL', 'Medical Leave'], ['UNPLANNED', 'Unplanned']] as const).map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setLeave(l => ({ ...l, leaveType: val }))}
                      className={cn('py-2.5 px-3 text-xs font-semibold rounded-xl border-2 transition text-left',
                        leave.leaveType === val
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      )}>
                      {val === 'PL' && '🏖 '}{val === 'CL' && '🏠 '}{val === 'MEDICAL' && '🏥 '}{val === 'UNPLANNED' && '⚡ '}{label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  {leave.leaveType === 'PL' && 'Planned paid leave — deducted from PL balance (12/year)'}
                  {leave.leaveType === 'CL' && 'Casual leave — deducted from CL balance (6/year)'}
                  {leave.leaveType === 'MEDICAL' && 'Medical leave — deducted from medical balance (6/year)'}
                  {leave.leaveType === 'UNPLANNED' && 'Unpaid leave — will be deducted from salary'}
                </p>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">From Date</label>
                  <input type="date" value={leave.fromDate}
                    onChange={e => setLeave(l => ({ ...l, fromDate: e.target.value, toDate: e.target.value >= l.toDate ? e.target.value : l.toDate }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">To Date</label>
                  <input type="date" value={leave.toDate} min={leave.fromDate}
                    onChange={e => setLeave(l => ({ ...l, toDate: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reason</label>
                <textarea value={leave.reason} onChange={e => setLeave(l => ({ ...l, reason: e.target.value }))} rows={3}
                  placeholder="Brief reason for leave..."
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                <strong>Note:</strong> Weekends and holidays are automatically excluded. Your manager will receive an email to approve or reject this request.
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={submitLeave} disabled={submittingLeave}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50">
                {submittingLeave ? 'Submitting...' : 'Submit Leave Request'}
              </button>
              <button onClick={() => setShowLeave(false)}
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
